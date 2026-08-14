// Electron dependency is intentional here (SPEC.md §17): shell.trashItem has
// no pure-Node equivalent, so the recycle-bin path lives outside
// src/main/filesystem/ instead of being injected through it.

import { shell } from 'electron'
import { join } from 'node:path'
import { toLongPathSafe } from '../filesystem/pathUtils'
import { toUserMessage } from '../filesystem/errorMessages'

export type TrashItemFailure = { name: string; code: string; message: string }
export type TrashResult = { succeeded: string[]; failed: TrashItemFailure[]; cancelled: boolean }

export async function trashItems(dir: string, names: string[], signal: AbortSignal): Promise<TrashResult> {
  const succeeded: string[] = []
  const failed: TrashItemFailure[] = []
  let cancelled = false

  for (const name of names) {
    if (signal.aborted) {
      cancelled = true
      break
    }
    try {
      await shell.trashItem(toLongPathSafe(join(dir, name)))
      succeeded.push(name)
    } catch (error) {
      failed.push({ name, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) })
    }
  }

  return { succeeded, failed, cancelled }
}
