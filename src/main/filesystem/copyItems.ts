// Pure copy engine (SPEC.md §6.2). No electron import (SPEC.md §11.4).

import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isSubPath, toComparableKey, toLongPathSafe } from './pathUtils'
import { toUserMessage } from './errorMessages'
import { nextConflictFreeName } from './nameConflict'

export type ConflictAction = 'overwrite' | 'skip' | 'rename' | 'cancel'
export type ConflictKind = 'file' | 'dir'
export type ConflictDecision = { action: ConflictAction; applyToAll: boolean }
export type ConflictResolver = (name: string, kind: ConflictKind) => Promise<ConflictDecision>

export type TransferItemFailure = { name: string; code: string; message: string }
export type TransferResult = { succeeded: string[]; failed: TransferItemFailure[]; cancelled: boolean }

export type CopyOptions = {
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

type CopyContext = {
  signal: AbortSignal
  onProgress: CopyOptions['onProgress']
  onConflict: ConflictResolver
  doneCount: { value: number }
  failed: TransferItemFailure[]
  applyAll: ConflictDecision | null
}

// Resolves a name/skip/cancel decision for a single conflicting entry.
// Returns the (possibly renamed) target name, 'skip', or null for cancel.
async function resolveConflict(name: string, kind: ConflictKind, destDir: string, ctx: CopyContext): Promise<string | 'skip' | null> {
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

async function copyEntry(srcDir: string, destDir: string, name: string, relativeLabel: string, ctx: CopyContext): Promise<boolean> {
  if (ctx.signal.aborted) throw new CancelledError()

  const srcPath = join(srcDir, name)
  const safeSrcPath = toLongPathSafe(srcPath)

  let stats
  try {
    stats = await lstat(safeSrcPath)
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }

  if (stats.isSymbolicLink()) {
    ctx.failed.push({ name: relativeLabel, code: 'ELINK', message: '링크는 지원하지 않습니다' })
    return false
  }

  const rawDestPath = join(destDir, name)
  if (isSubPath(srcPath, rawDestPath)) {
    ctx.failed.push({ name: relativeLabel, code: 'ERECURSIVE', message: '대상이 원본의 하위 폴더입니다' })
    return false
  }
  if (toComparableKey(resolve(srcPath)) === toComparableKey(resolve(rawDestPath))) {
    ctx.failed.push({ name: relativeLabel, code: 'ESAME', message: '원본과 대상이 같습니다' })
    return false
  }

  if (stats.isDirectory()) {
    const existing = await pathExists(rawDestPath)
    let targetName = name
    if (existing === 'file') {
      const resolved = await resolveConflict(name, 'file', destDir, ctx)
      if (resolved === 'skip') return true
      if (resolved === null) throw new ConflictCancelledError()
      targetName = resolved
    }
    // existing === 'dir': merge silently, no prompt (SPEC.md §6.2).
    const finalDestPath = join(destDir, targetName)
    try {
      await mkdir(toLongPathSafe(finalDestPath), { recursive: true })
    } catch (error) {
      ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
      return false
    }
    const children = await readdir(safeSrcPath, { withFileTypes: true })
    let ok = true
    for (const child of children) {
      const childOk = await copyEntry(srcPath, finalDestPath, child.name, `${relativeLabel}\\${child.name}`, ctx)
      ok = ok && childOk
    }
    return ok
  }

  const existing = await pathExists(rawDestPath)
  let targetName = name
  if (existing) {
    const resolved = await resolveConflict(name, existing, destDir, ctx)
    if (resolved === 'skip') return true
    if (resolved === null) throw new ConflictCancelledError()
    targetName = resolved
  }

  const finalDestPath = toLongPathSafe(join(destDir, targetName))
  try {
    await copyFile(safeSrcPath, finalDestPath)
    ctx.doneCount.value += 1
    ctx.onProgress(relativeLabel, ctx.doneCount.value)
    return true
  } catch (error) {
    ctx.failed.push({ name: relativeLabel, code: errorCode(error), message: toUserMessage(error) })
    return false
  }
}

export async function copyItems(options: CopyOptions): Promise<TransferResult> {
  const ctx: CopyContext = {
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
      const ok = await copyEntry(options.sourceDir, options.destDir, name, name, ctx)
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
