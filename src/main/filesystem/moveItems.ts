// Pure move engine (SPEC.md §6.3). No electron import (SPEC.md §11.4).
// Original preservation is the top priority: on any doubt, the source is
// left intact and the item is reported as failed rather than risking loss.

import { copyFile, lstat, mkdir, readdir, rename, rm, rmdir, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { isSubPath, isSubPathReal, toComparableKey, toLongPathSafe } from './pathUtils'
import { toUserMessage } from './errorMessages'
import { nextConflictFreeName } from './nameConflict'
import type { ConflictDecision, ConflictKind, ConflictResolver, TransferItemFailure, TransferResult } from './copyItems'
import type { Stats } from 'node:fs'

export type MoveOptions = {
  sourceDir: string
  names: string[]
  destDir: string
  signal: AbortSignal
  onProgress: (currentFile: string, done: number) => void
  onConflict: ConflictResolver
}

class CancelledError extends Error {}
class ConflictCancelledError extends Error {}

// "moved": actually transferred. "skipped": user chose to skip, or every
// child of a merged directory was skipped -- neither is a failure, but
// only "moved" counts toward the operation's `succeeded` list (see A7-2 #5:
// a fully-skipped directory must not be reported as a successful move).
type EntryOutcome = 'moved' | 'skipped' | 'failed'

function errorCode(error: unknown): string {
  return (error as NodeJS.ErrnoException).code ?? 'UNKNOWN'
}

async function pathExists(path: string): Promise<'file' | 'dir' | null> {
  try {
    const stats = await lstat(toLongPathSafe(path))
    return stats.isDirectory() ? 'dir' : 'file'
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null
    throw error
  }
}

type MoveContext = {
  signal: AbortSignal
  onProgress: MoveOptions['onProgress']
  onConflict: ConflictResolver
  doneCount: { value: number }
  failed: TransferItemFailure[]
  // Keyed by conflict kind, mirroring copyItems.ts (see A7 #9): an
  // applyToAll decision for a file conflict must not silently answer a
  // later folder conflict.
  applyAll: Partial<Record<ConflictKind, ConflictDecision>>
}

async function resolveConflict(name: string, kind: ConflictKind, destDir: string, ctx: MoveContext): Promise<string | 'skip' | 'cancel' | 'error'> {
  let decision = ctx.applyAll[kind]
  if (!decision) {
    decision = await ctx.onConflict(name, kind)
    if (decision.applyToAll) ctx.applyAll[kind] = decision
  }
  if (decision.action === 'cancel') return 'cancel'
  if (decision.action === 'skip') return 'skip'
  if (decision.action === 'overwrite') return name
  try {
    return await nextConflictFreeName(name, async (candidate) => (await pathExists(join(destDir, candidate))) !== null)
  } catch (error) {
    ctx.failed.push({ name, code: 'ERENAME_EXHAUSTED', message: toUserMessage(error) })
    return 'error'
  }
}

// Best-effort removal of a partially-written destination. Failure to clean
// up is reported back (see A7 #7) instead of being silently swallowed --
// otherwise a truncated copy can linger at the destination with no trace in
// the operation result.
async function cleanupPartialCopy(path: string): Promise<boolean> {
  try {
    await rm(toLongPathSafe(path), { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

// Restores a destination that was renamed aside before an overwrite
// attempt. Safe to call from any failure/cancellation path: performMove()
// never deletes the source before its own destination write is verified,
// so the "new" content -- if not confirmed moved -- is still intact at the
// source, and putting the backup back never loses data.
async function restoreBackup(backupPath: string, originalPath: string, relativeLabel: string, ctx: MoveContext): Promise<void> {
  try {
    await rename(toLongPathSafe(backupPath), toLongPathSafe(originalPath))
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: 'ERESTORE', message: `대상 복구 실패: ${toUserMessage(error)}` })
  }
}

// Copies one file/directory tree onto a destination that is guaranteed not
// to exist yet (fresh EXDEV target or a post-rename-aside overwrite slot).
// Symlinks are excluded and recorded as failures rather than silently
// dropped (see A7 #3) -- the item is not moved unless every part of it was
// actually transferred.
async function copyTreeForMove(srcPath: string, destPath: string, isDir: boolean, relativeLabel: string, ctx: MoveContext): Promise<boolean> {
  if (ctx.signal.aborted) throw new CancelledError()

  if (!isDir) {
    try {
      await mkdir(toLongPathSafe(dirname(destPath)), { recursive: true })
      await copyFile(toLongPathSafe(srcPath), toLongPathSafe(destPath))
      return true
    } catch (error) {
      ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
      return false
    }
  }

  try {
    await mkdir(toLongPathSafe(destPath), { recursive: true })
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }

  const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
  let ok = true
  for (const child of children) {
    if (ctx.signal.aborted) throw new CancelledError()
    const childSrc = join(srcPath, child.name)
    const childLabel = `${relativeLabel}\\${child.name}`
    const childStats = await lstat(toLongPathSafe(childSrc))
    if (childStats.isSymbolicLink()) {
      ctx.failed.push({ name: childLabel, code: 'ELINK', message: '링크는 지원하지 않습니다' })
      ok = false
      continue
    }
    const childOk = await copyTreeForMove(childSrc, join(destPath, child.name), childStats.isDirectory(), childLabel, ctx)
    ok = ok && childOk
  }
  return ok
}

// Verifies every non-symlink file was actually written before the source is
// allowed to be deleted. Always stats the destination -- including for an
// empty directory -- instead of trivially returning true when there are no
// children to recurse into (A7 #4). Uses lstat() rather than stat() on the
// destination and rejects a symlink/junction there outright: this code
// never creates one, so if the destination has become one by the time
// verification runs, either it was swapped out from under us (a TOCTOU
// attack -- verifying through a junction back into the source would let a
// forged verification pass and the real source get deleted) or something
// else is very wrong. Either way, "not a plain file/directory" must fail
// verification rather than be silently followed (see A7-3 Critical #1).
async function verifyCopiedTree(srcPath: string, destPath: string, isDir: boolean): Promise<boolean> {
  if (!isDir) {
    const [srcStat, destStat] = await Promise.all([
      stat(toLongPathSafe(srcPath)),
      lstat(toLongPathSafe(destPath)).catch(() => null)
    ])
    if (!destStat || destStat.isSymbolicLink()) return false
    return destStat.size === srcStat.size
  }
  const destStat = await lstat(toLongPathSafe(destPath)).catch(() => null)
  if (!destStat || destStat.isSymbolicLink() || !destStat.isDirectory()) return false

  const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
  for (const child of children) {
    const childStat = await lstat(toLongPathSafe(join(srcPath, child.name)))
    if (childStat.isSymbolicLink()) continue // already recorded as a failure during the copy step
    const ok = await verifyCopiedTree(join(srcPath, child.name), join(destPath, child.name), childStat.isDirectory())
    if (!ok) return false
  }
  return true
}

// "dest-occupied" is the one failure mode where destPath is left holding a
// verified-complete copy of the new content: copy + verify both succeeded,
// only the final source-delete step failed. Every other failure path always
// cleans destPath back to empty before returning/throwing (see
// cleanupPartialCopy() calls below), so callers -- specifically
// moveWithOverwrite() -- can tell "safe to put the old destination back"
// apart from "the new content is already sitting there for real" (A7-3 #6:
// blindly restoring a backup over an occupied destPath collides with EEXIST
// and strands the backup).
type PerformMoveResult = 'moved' | 'failed' | 'dest-occupied'

function reportCleanupFailure(cleaned: boolean, relativeLabel: string, ctx: MoveContext): void {
  if (!cleaned) ctx.failed.push({ name: relativeLabel, code: 'ECLEANUP', message: '임시 복사본 정리에 실패했습니다' })
}

// Moves srcPath onto destPath, which must not already exist. Tries a plain
// rename() first; on EXDEV, falls back to copy -> verify -> delete-original,
// re-checking cancellation and catching every step's errors (not just
// CancelledError) so a partial copy is always cleaned up rather than left
// behind or silently propagated as an unhandled rejection (A7-2 #1 Major).
// Every cleanupPartialCopy() call's own success/failure is also reported
// (A7-3 #5 -- several of these previously discarded that return value).
async function performMove(srcPath: string, destPath: string, srcStats: Stats, relativeLabel: string, ctx: MoveContext): Promise<PerformMoveResult> {
  try {
    await rename(toLongPathSafe(srcPath), toLongPathSafe(destPath))
    ctx.doneCount.value += 1
    ctx.onProgress(relativeLabel, ctx.doneCount.value)
    return 'moved'
  } catch (error) {
    if (errorCode(error) !== 'EXDEV') {
      ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
      return 'failed'
    }
  }

  let ok: boolean
  try {
    ok = await copyTreeForMove(srcPath, destPath, srcStats.isDirectory(), relativeLabel, ctx)
  } catch (error) {
    reportCleanupFailure(await cleanupPartialCopy(destPath), relativeLabel, ctx)
    if (error instanceof CancelledError) throw error
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return 'failed'
  }
  if (!ok) {
    reportCleanupFailure(await cleanupPartialCopy(destPath), relativeLabel, ctx)
    return 'failed'
  }

  if (ctx.signal.aborted) {
    reportCleanupFailure(await cleanupPartialCopy(destPath), relativeLabel, ctx)
    throw new CancelledError()
  }

  let verified: boolean
  try {
    verified = await verifyCopiedTree(srcPath, destPath, srcStats.isDirectory())
  } catch (error) {
    reportCleanupFailure(await cleanupPartialCopy(destPath), relativeLabel, ctx)
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: `복사 검증 중 오류: ${toUserMessage(error)}` })
    return 'failed'
  }
  if (!verified) {
    const cleaned = await cleanupPartialCopy(destPath)
    ctx.failed.push({
      name: relativeLabel,
      code: 'EVERIFY',
      message: cleaned ? '복사 검증에 실패했습니다' : '복사 검증에 실패했으며 임시 복사본 정리에도 실패했습니다'
    })
    return 'failed'
  }

  if (ctx.signal.aborted) {
    // Copy is verified-complete but the source hasn't been deleted yet.
    // Deleting it now would still be safe (dest already has everything),
    // but honoring the cancellation and leaving the source untouched is
    // the more conservative choice -- a duplicate is recoverable, a wrongly
    // deleted source is not.
    reportCleanupFailure(await cleanupPartialCopy(destPath), relativeLabel, ctx)
    throw new CancelledError()
  }

  // From here on, destPath holds a verified-complete copy no matter what
  // happens next -- nothing below this point may delete or clean it up.
  try {
    if (srcStats.isDirectory()) await rm(toLongPathSafe(srcPath), { recursive: true, force: false })
    else await unlink(toLongPathSafe(srcPath))
  } catch (error) {
    ctx.failed.push({
      name: relativeLabel,
      code: errorCode(error),
      message: `이동은 완료되었으나 원본 삭제에 실패했습니다: ${toUserMessage(error)}`
    })
    return 'dest-occupied'
  }

  ctx.doneCount.value += 1
  ctx.onProgress(relativeLabel, ctx.doneCount.value)
  return 'moved'
}

// Wraps performMove() with the overwrite-backup dance: the pre-existing
// destination is renamed aside before the move attempt and only removed
// once performMove() confirms success. A plain failure (destPath left
// empty) restores the backup; "dest-occupied" (A7-3 #6) instead discards
// the now-superseded backup, since destPath already correctly holds the new
// content and restoring would either collide (EEXIST) or wrongly discard
// valid data. Any thrown exception (including cancellation) also restores
// the backup -- performMove() never throws once it has reached the
// "dest-occupied"-only zone below the last cancellation check, so an
// exception always means destPath was left empty and restoring is safe
// (A7-2 #2).
async function moveWithOverwrite(srcPath: string, rawDestPath: string, srcStats: Stats, relativeLabel: string, ctx: MoveContext): Promise<boolean> {
  const backupPath = `${rawDestPath}.__fmgr_bak_${Date.now()}_${Math.random().toString(36).slice(2)}`
  try {
    await rename(toLongPathSafe(rawDestPath), toLongPathSafe(backupPath))
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }

  let result: PerformMoveResult
  try {
    result = await performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
  } catch (error) {
    await restoreBackup(backupPath, rawDestPath, relativeLabel, ctx)
    throw error
  }

  if (result === 'dest-occupied') {
    await rm(toLongPathSafe(backupPath), { recursive: true, force: true }).catch(() => {})
    return false
  }
  if (result === 'moved') {
    await rm(toLongPathSafe(backupPath), { recursive: true, force: true }).catch(() => {})
    return true
  }
  await restoreBackup(backupPath, rawDestPath, relativeLabel, ctx)
  return false
}

async function moveEntry(srcDir: string, destDir: string, name: string, relativeLabel: string, ctx: MoveContext): Promise<EntryOutcome> {
  if (ctx.signal.aborted) throw new CancelledError()

  const srcPath = join(srcDir, name)
  const rawDestPath = join(destDir, name)

  if (isSubPath(srcPath, rawDestPath)) {
    ctx.failed.push({ name: relativeLabel, code: 'ERECURSIVE', message: '대상이 원본의 하위 폴더입니다' })
    return 'failed'
  }
  if (toComparableKey(resolve(srcPath)) === toComparableKey(resolve(rawDestPath))) {
    ctx.failed.push({ name: relativeLabel, code: 'ESAME', message: '원본과 대상이 같습니다' })
    return 'failed'
  }
  // A junction/reparse point can alias `destDir` itself to somewhere inside
  // srcPath even when the target `name` doesn't exist yet -- checking only
  // once the destination name already exists as a directory (the earlier
  // fix) misses a fresh name under an aliased destDir (A7-2 #3). destDir is
  // always a real, already-existing directory at this point.
  if (await isSubPathReal(srcPath, destDir)) {
    ctx.failed.push({ name: relativeLabel, code: 'ERECURSIVE', message: '대상이 원본의 하위 폴더입니다' })
    return 'failed'
  }

  let srcStats: Stats
  try {
    srcStats = await lstat(toLongPathSafe(srcPath))
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return 'failed'
  }
  if (srcStats.isSymbolicLink()) {
    ctx.failed.push({ name: relativeLabel, code: 'ELINK', message: '링크는 지원하지 않습니다' })
    return 'failed'
  }

  const existingKind = await pathExists(rawDestPath)

  if (existingKind === 'dir' && srcStats.isDirectory()) {
    // Directory/directory conflict merges silently, mirroring copy (SPEC.md §6.2/§6.3).
    const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
    let anyFailed = false
    let anyMoved = false
    let anySkipped = false
    for (const child of children) {
      const childOutcome = await moveEntry(srcPath, rawDestPath, child.name, `${relativeLabel}\\${child.name}`, ctx)
      if (childOutcome === 'failed') anyFailed = true
      else if (childOutcome === 'moved') anyMoved = true
      else anySkipped = true
    }
    // rmdir() is only even attempted when nothing was skipped -- a skip
    // always leaves at least one item behind, so it would fail with
    // ENOTEMPTY anyway; attempting it only for the fully-clean case avoids
    // needing to distinguish "expected ENOTEMPTY" from a real error.
    if (!anyFailed && !anySkipped) {
      try {
        await rmdir(toLongPathSafe(srcPath))
      } catch {
        // Busy or otherwise locked: leave it, not an error.
      }
    }
    if (anyFailed) return 'failed'
    // A7-3 #7 (and A7-2 #5): a directory is only reported "moved" when it
    // is *fully* at the destination and gone from the source. Any skip --
    // whether every child was skipped or just one -- leaves part of the
    // directory behind at the source, so the whole directory must not be
    // claimed as succeeded; report it as "skipped" instead (never appears
    // in `failed` either, matching how an individually skipped item behaves).
    if (anySkipped) return 'skipped'
    return anyMoved ? 'moved' : 'skipped'
  }

  if (existingKind !== null) {
    if ((existingKind === 'dir') !== srcStats.isDirectory()) {
      // A folder can never overwrite a file in place or vice versa; refuse
      // instead of attempting a doomed mkdir()/copyFile() (A7-2 #6).
      ctx.failed.push({ name: relativeLabel, code: 'ETYPE', message: '파일과 폴더는 바꿀 수 없습니다' })
      return 'failed'
    }
    const resolved = await resolveConflict(name, existingKind, destDir, ctx)
    if (resolved === 'skip') return 'skipped'
    if (resolved === 'cancel') throw new ConflictCancelledError()
    if (resolved === 'error') return 'failed'

    if (resolved === name) {
      const moved = await moveWithOverwrite(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
      return moved ? 'moved' : 'failed'
    }
    // "dest-occupied" (copy+verify succeeded, only the source delete
    // failed) still counts as an overall failure here: the source was never
    // cleaned up, so the move as a whole did not complete, even though the
    // failure message already explains the destination has a valid copy.
    const result = await performMove(srcPath, join(destDir, resolved), srcStats, relativeLabel, ctx)
    return result === 'moved' ? 'moved' : 'failed'
  }

  const result = await performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
  return result === 'moved' ? 'moved' : 'failed'
}

export async function moveItems(options: MoveOptions): Promise<TransferResult> {
  const ctx: MoveContext = {
    signal: options.signal,
    onProgress: options.onProgress,
    onConflict: options.onConflict,
    doneCount: { value: 0 },
    failed: [],
    applyAll: {}
  }
  const succeeded: string[] = []
  let cancelled = false

  for (const name of options.names) {
    if (options.signal.aborted) {
      cancelled = true
      break
    }
    try {
      const outcome = await moveEntry(options.sourceDir, options.destDir, name, name, ctx)
      if (outcome === 'moved') succeeded.push(name)
    } catch (error) {
      if (error instanceof CancelledError || error instanceof ConflictCancelledError) {
        cancelled = true
        break
      }
      throw error
    }
  }

  return { succeeded, failed: ctx.failed, cancelled }
}
