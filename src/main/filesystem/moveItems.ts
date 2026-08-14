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
// children to recurse into (A7 #4).
async function verifyCopiedTree(srcPath: string, destPath: string, isDir: boolean): Promise<boolean> {
  if (!isDir) {
    const [srcStat, destStat] = await Promise.all([
      stat(toLongPathSafe(srcPath)),
      stat(toLongPathSafe(destPath)).catch(() => null)
    ])
    return destStat !== null && destStat.size === srcStat.size
  }
  const destStat = await stat(toLongPathSafe(destPath)).catch(() => null)
  if (!destStat || !destStat.isDirectory()) return false

  const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
  for (const child of children) {
    const childStat = await lstat(toLongPathSafe(join(srcPath, child.name)))
    if (childStat.isSymbolicLink()) continue // already recorded as a failure during the copy step
    const ok = await verifyCopiedTree(join(srcPath, child.name), join(destPath, child.name), childStat.isDirectory())
    if (!ok) return false
  }
  return true
}

// Moves srcPath onto destPath, which must not already exist. Tries a plain
// rename() first; on EXDEV, falls back to copy -> verify -> delete-original,
// re-checking cancellation and catching every step's errors (not just
// CancelledError) so a partial copy is always cleaned up rather than left
// behind or silently propagated as an unhandled rejection (A7-2 #1 Major).
async function performMove(srcPath: string, destPath: string, srcStats: Stats, relativeLabel: string, ctx: MoveContext): Promise<boolean> {
  try {
    await rename(toLongPathSafe(srcPath), toLongPathSafe(destPath))
    ctx.doneCount.value += 1
    ctx.onProgress(relativeLabel, ctx.doneCount.value)
    return true
  } catch (error) {
    if (errorCode(error) !== 'EXDEV') {
      ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
      return false
    }
  }

  let ok: boolean
  try {
    ok = await copyTreeForMove(srcPath, destPath, srcStats.isDirectory(), relativeLabel, ctx)
  } catch (error) {
    await cleanupPartialCopy(destPath)
    if (error instanceof CancelledError) throw error
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }
  if (!ok) {
    const cleaned = await cleanupPartialCopy(destPath)
    if (!cleaned) ctx.failed.push({ name: relativeLabel, code: 'ECLEANUP', message: '이동 실패 후 임시 복사본 정리에 실패했습니다' })
    return false
  }

  if (ctx.signal.aborted) {
    await cleanupPartialCopy(destPath)
    throw new CancelledError()
  }

  let verified: boolean
  try {
    verified = await verifyCopiedTree(srcPath, destPath, srcStats.isDirectory())
  } catch (error) {
    await cleanupPartialCopy(destPath)
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: `복사 검증 중 오류: ${toUserMessage(error)}` })
    return false
  }
  if (!verified) {
    const cleaned = await cleanupPartialCopy(destPath)
    ctx.failed.push({
      name: relativeLabel,
      code: 'EVERIFY',
      message: cleaned ? '복사 검증에 실패했습니다' : '복사 검증에 실패했으며 임시 복사본 정리에도 실패했습니다'
    })
    return false
  }

  if (ctx.signal.aborted) {
    // Copy is verified-complete but the source hasn't been deleted yet.
    // Deleting it now would still be safe (dest already has everything),
    // but honoring the cancellation and leaving the source untouched is
    // the more conservative choice -- a duplicate is recoverable, a wrongly
    // deleted source is not.
    await cleanupPartialCopy(destPath)
    throw new CancelledError()
  }

  try {
    if (srcStats.isDirectory()) await rm(toLongPathSafe(srcPath), { recursive: true, force: false })
    else await unlink(toLongPathSafe(srcPath))
  } catch (error) {
    ctx.failed.push({
      name: relativeLabel,
      code: errorCode(error),
      message: `이동은 완료되었으나 원본 삭제에 실패했습니다: ${toUserMessage(error)}`
    })
    return false
  }

  ctx.doneCount.value += 1
  ctx.onProgress(relativeLabel, ctx.doneCount.value)
  return true
}

// Wraps performMove() with the overwrite-backup dance: the pre-existing
// destination is renamed aside before the move attempt and only removed
// once performMove() confirms success. Any failure OR exception (including
// cancellation) restores the backup before propagating -- performMove()
// only ever deletes the source after its destination write is verified, so
// at the point of any non-success outcome the source is still guaranteed
// intact and restoring the backup is always safe (A7-2 #2).
async function moveWithOverwrite(srcPath: string, rawDestPath: string, srcStats: Stats, relativeLabel: string, ctx: MoveContext): Promise<boolean> {
  const backupPath = `${rawDestPath}.__fmgr_bak_${Date.now()}_${Math.random().toString(36).slice(2)}`
  try {
    await rename(toLongPathSafe(rawDestPath), toLongPathSafe(backupPath))
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }

  let moved: boolean
  try {
    moved = await performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
  } catch (error) {
    await restoreBackup(backupPath, rawDestPath, relativeLabel, ctx)
    throw error
  }

  if (moved) {
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
    for (const child of children) {
      const childOutcome = await moveEntry(srcPath, rawDestPath, child.name, `${relativeLabel}\\${child.name}`, ctx)
      if (childOutcome === 'failed') anyFailed = true
      if (childOutcome === 'moved') anyMoved = true
    }
    if (!anyFailed && anyMoved) {
      try {
        await rmdir(toLongPathSafe(srcPath))
      } catch {
        // Not actually empty (a sibling item may exist alongside the moved
        // children) or otherwise busy: leave it, not an error.
      }
    }
    if (anyFailed) return 'failed'
    // A7-2 #5: a directory where every child was individually skipped (or
    // that had no children at all) must not be reported as "moved" -- the
    // source is genuinely unchanged.
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

    const moved =
      resolved === name
        ? await moveWithOverwrite(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
        : await performMove(srcPath, join(destDir, resolved), srcStats, relativeLabel, ctx)
    return moved ? 'moved' : 'failed'
  }

  return (await performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)) ? 'moved' : 'failed'
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
