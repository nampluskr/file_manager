// Pure permanent delete (SPEC.md §6.5, Shift+Delete path). No electron import
// (SPEC.md §11.4). The recycle-bin path uses shell.trashItem and is injected
// at src/main/ipc/ instead, since it requires Electron.

import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { toLongPathSafe } from './pathUtils'
import { toUserMessage } from './errorMessages'

export type DeleteItemFailure = { name: string; code: string; message: string }
export type DeleteResult = { succeeded: string[]; failed: DeleteItemFailure[]; cancelled: boolean }

export async function deletePermanently(dir: string, names: string[], signal: AbortSignal): Promise<DeleteResult> {
  const succeeded: string[] = []
  const failed: DeleteItemFailure[] = []
  let cancelled = false

  for (const name of names) {
    if (signal.aborted) {
      cancelled = true
      break
    }
    try {
      await rm(toLongPathSafe(join(dir, name)), { recursive: true, force: false })
      succeeded.push(name)
    } catch (error) {
      failed.push({ name, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) })
    }
  }

  return { succeeded, failed, cancelled }
}
