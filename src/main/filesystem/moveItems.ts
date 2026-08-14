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
// allowed to be deleted. Unlike the previous implementation, this always
// stats the destination -- including for an empty directory -- instead of
// trivially returning true when there are no children to recurse into (see
// A7 #4: an empty-directory "verification" that never touches the
// destination cannot detect a destination that vanished after creation).
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
// only ever deleting the source once the copy is confirmed complete.
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
    if (error instanceof CancelledError) {
      await cleanupPartialCopy(destPath)
    }
    throw error
  }
  if (!ok) {
    const cleaned = await cleanupPartialCopy(destPath)
    if (!cleaned) ctx.failed.push({ name: relativeLabel, code: 'ECLEANUP', message: '이동 실패 후 임시 복사본 정리에 실패했습니다' })
    return false
  }

  const verified = await verifyCopiedTree(srcPath, destPath, srcStats.isDirectory())
  if (!verified) {
    const cleaned = await cleanupPartialCopy(destPath)
    ctx.failed.push({
      name: relativeLabel,
      code: 'EVERIFY',
      message: cleaned ? '복사 검증에 실패했습니다' : '복사 검증에 실패했으며 임시 복사본 정리에도 실패했습니다'
    })
    return false
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

async function moveEntry(srcDir: string, destDir: string, name: string, relativeLabel: string, ctx: MoveContext): Promise<boolean> {
  if (ctx.signal.aborted) throw new CancelledError()

  const srcPath = join(srcDir, name)
  const rawDestPath = join(destDir, name)

  if (isSubPath(srcPath, rawDestPath)) {
    ctx.failed.push({ name: relativeLabel, code: 'ERECURSIVE', message: '대상이 원본의 하위 폴더입니다' })
    return false
  }
  if (toComparableKey(resolve(srcPath)) === toComparableKey(resolve(rawDestPath))) {
    ctx.failed.push({ name: relativeLabel, code: 'ESAME', message: '원본과 대상이 같습니다' })
    return false
  }

  let srcStats: Stats
  try {
    srcStats = await lstat(toLongPathSafe(srcPath))
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }
  if (srcStats.isSymbolicLink()) {
    ctx.failed.push({ name: relativeLabel, code: 'ELINK', message: '링크는 지원하지 않습니다' })
    return false
  }

  const existingKind = await pathExists(rawDestPath)

  if (existingKind === 'dir' && srcStats.isDirectory()) {
    // Directory/directory conflict merges silently, mirroring copy (SPEC.md
    // §6.2/§6.3). A junction can alias this "existing" directory to
    // somewhere inside srcPath even though the string paths look unrelated
    // (see A7 #5), so the guard is re-checked with realpath here.
    if (await isSubPathReal(srcPath, rawDestPath)) {
      ctx.failed.push({ name: relativeLabel, code: 'ERECURSIVE', message: '대상이 원본의 하위 폴더입니다' })
      return false
    }
    const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
    let ok = true
    for (const child of children) {
      const childOk = await moveEntry(srcPath, rawDestPath, child.name, `${relativeLabel}\\${child.name}`, ctx)
      ok = ok && childOk
    }
    if (ok) {
      try {
        await rmdir(toLongPathSafe(srcPath))
      } catch {
        // Non-empty (some children were skipped) or otherwise busy: leave it, not an error.
      }
    }
    // A7 #10 (deferred, Major): if every child in this directory was
    // individually skipped, `ok` is still true here (skip is not a failure)
    // and the parent directory is reported succeeded even though nothing
    // moved and rmdir() above silently no-ops on the non-empty directory.
    // Distinguishing "fully skipped" from "fully moved" would need a
    // separate per-directory move-count, which is deferred: skip is a
    // deliberate user choice, not data loss, and every individually skipped
    // file is still correctly absent from `succeeded`/`failed`.
    return ok
  }

  if (existingKind !== null) {
    if ((existingKind === 'dir') !== srcStats.isDirectory()) {
      ctx.failed.push({ name: relativeLabel, code: 'ETYPE', message: '파일과 폴더는 덮어쓸 수 없습니다' })
      return false
    }
    const resolved = await resolveConflict(name, existingKind, destDir, ctx)
    if (resolved === 'skip') return true
    if (resolved === 'cancel') throw new ConflictCancelledError()
    if (resolved === 'error') return false

    if (resolved === name) {
      // Overwrite: move the existing destination aside first instead of
      // deleting it outright, so it can be restored if the transfer fails
      // after this point (see A7 #2 -- an overwrite must never destroy the
      // existing destination before the replacement is confirmed).
      const backupPath = `${rawDestPath}.__fmgr_bak_${Date.now()}_${Math.random().toString(36).slice(2)}`
      try {
        await rename(toLongPathSafe(rawDestPath), toLongPathSafe(backupPath))
      } catch (error) {
        ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
        return false
      }
      const moved = await performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
      if (moved) {
        await rm(toLongPathSafe(backupPath), { recursive: true, force: true }).catch(() => {})
        return true
      }
      try {
        await rename(toLongPathSafe(backupPath), toLongPathSafe(rawDestPath))
      } catch (restoreError) {
        ctx.failed.push({ name: relativeLabel, code: 'ERESTORE', message: `대상 복구 실패: ${toUserMessage(restoreError)}` })
      }
      return false
    }

    return performMove(srcPath, join(destDir, resolved), srcStats, relativeLabel, ctx)
  }

  return performMove(srcPath, rawDestPath, srcStats, relativeLabel, ctx)
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
      const ok = await moveEntry(options.sourceDir, options.destDir, name, name, ctx)
      if (ok) succeeded.push(name)
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
