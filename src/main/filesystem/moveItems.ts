// Pure move engine (SPEC.md §6.3). No electron import (SPEC.md §11.4).
// Original preservation is the top priority: on any doubt, the source is
// left intact and the item is reported as failed rather than risking loss.

import { copyFile, lstat, mkdir, readdir, rename, rm, rmdir, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { isSubPath, toComparableKey, toLongPathSafe } from './pathUtils'
import { toUserMessage } from './errorMessages'
import { nextConflictFreeName } from './nameConflict'
import type { ConflictDecision, ConflictKind, ConflictResolver, TransferItemFailure, TransferResult } from './copyItems'

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
  applyAll: ConflictDecision | null
}

async function resolveConflict(name: string, kind: ConflictKind, destDir: string, ctx: MoveContext): Promise<string | 'skip' | null> {
  let decision = ctx.applyAll
  if (!decision) {
    decision = await ctx.onConflict(name, kind)
    if (decision.applyToAll) ctx.applyAll = decision
  }
  if (decision.action === 'cancel') return null
  if (decision.action === 'skip') return 'skip'
  if (decision.action === 'overwrite') return name
  return nextConflictFreeName(name, async (candidate) => (await pathExists(join(destDir, candidate))) !== null)
}

async function cleanupPartialCopy(path: string): Promise<void> {
  try {
    await rm(toLongPathSafe(path), { recursive: true, force: true })
  } catch {
    // best effort only
  }
}

async function copyFresh(srcPath: string, destPath: string, isDir: boolean): Promise<void> {
  if (!isDir) {
    await mkdir(toLongPathSafe(dirname(destPath)), { recursive: true })
    await copyFile(toLongPathSafe(srcPath), toLongPathSafe(destPath))
    return
  }
  await mkdir(toLongPathSafe(destPath), { recursive: true })
  const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
  for (const child of children) {
    const childSrc = join(srcPath, child.name)
    const childStats = await lstat(toLongPathSafe(childSrc))
    if (childStats.isSymbolicLink()) continue
    await copyFresh(childSrc, join(destPath, child.name), childStats.isDirectory())
  }
}

// Compares size (files) or full presence+size (directories, recursively).
// This is what "복사 결과 검증" in SPEC.md §6.3 means before the source is deleted.
async function verifyCopy(srcPath: string, destPath: string, isDir: boolean): Promise<boolean> {
  if (!isDir) {
    const [srcStat, destStat] = await Promise.all([
      stat(toLongPathSafe(srcPath)),
      stat(toLongPathSafe(destPath)).catch(() => null)
    ])
    return destStat !== null && destStat.size === srcStat.size
  }
  const children = await readdir(toLongPathSafe(srcPath), { withFileTypes: true })
  for (const child of children) {
    const childStat = await lstat(toLongPathSafe(join(srcPath, child.name)))
    if (childStat.isSymbolicLink()) continue
    const ok = await verifyCopy(join(srcPath, child.name), join(destPath, child.name), childStat.isDirectory())
    if (!ok) return false
  }
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

  let srcStats
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
  let targetName = name

  if (existingKind === 'dir' && srcStats.isDirectory()) {
    // Directory/directory conflict merges silently, mirroring copy (SPEC.md §6.2/§6.3).
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
    return ok
  }

  if (existingKind !== null) {
    if ((existingKind === 'dir') !== srcStats.isDirectory()) {
      ctx.failed.push({ name: relativeLabel, code: 'ETYPE', message: '파일과 폴더는 덮어쓸 수 없습니다' })
      return false
    }
    const resolved = await resolveConflict(name, existingKind, destDir, ctx)
    if (resolved === 'skip') return true
    if (resolved === null) throw new ConflictCancelledError()
    if (resolved === name) {
      // overwrite: Windows rename() will not silently replace an existing file.
      try {
        await unlink(toLongPathSafe(rawDestPath))
      } catch (error) {
        ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
        return false
      }
    }
    targetName = resolved
  }

  const finalDestPath = join(destDir, targetName)
  try {
    await rename(toLongPathSafe(srcPath), toLongPathSafe(finalDestPath))
    ctx.doneCount.value += 1
    ctx.onProgress(relativeLabel, ctx.doneCount.value)
    return true
  } catch (error) {
    if (errorCode(error) !== 'EXDEV') {
      ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
      return false
    }
  }

  // Cross-volume fallback: copy, verify, then delete the original only on
  // verified success (SPEC.md §6.3). Any failure here leaves the source
  // untouched and cleans up the partial copy.
  try {
    await copyFresh(srcPath, finalDestPath, srcStats.isDirectory())
  } catch (error) {
    await cleanupPartialCopy(finalDestPath)
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }

  const verified = await verifyCopy(srcPath, finalDestPath, srcStats.isDirectory())
  if (!verified) {
    await cleanupPartialCopy(finalDestPath)
    ctx.failed.push({ name: relativeLabel, code: 'EVERIFY', message: '복사 검증에 실패했습니다' })
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

export async function moveItems(options: MoveOptions): Promise<TransferResult> {
  const ctx: MoveContext = {
    signal: options.signal,
    onProgress: options.onProgress,
    onConflict: options.onConflict,
    doneCount: { value: 0 },
    failed: [],
    applyAll: null
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
