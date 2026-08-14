// Electron dependencies are injected only at this layer (SPEC.md §11.4).

import { ipcMain, shell } from 'electron'
import { isAbsolute, resolve } from 'node:path'
import { listDirectory } from '../filesystem/listDirectory'
import { toUserMessage } from '../filesystem/errorMessages'
import type { FileEntry } from '../../shared/types'

// SPEC.md §12.3: Main validates every path a Renderer sends.
function assertAbsolutePath(requestedPath: string): string {
  if (typeof requestedPath !== 'string' || requestedPath.length === 0) {
    throw new Error('경로가 올바르지 않습니다')
  }
  const resolved = resolve(requestedPath)
  if (!isAbsolute(resolved)) throw new Error('경로가 올바르지 않습니다')
  return resolved
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    'fs:listDirectory',
    async (_event, requestedPath: string): Promise<{ path: string; entries: FileEntry[] }> => {
      const path = assertAbsolutePath(requestedPath)
      try {
        const entries = await listDirectory(path)
        return { path, entries }
      } catch (error) {
        throw new Error(toUserMessage(error))
      }
    }
  )

  ipcMain.handle('sys:openPath', async (_event, requestedPath: string): Promise<void> => {
    const path = assertAbsolutePath(requestedPath)
    const failureMessage = await shell.openPath(path)
    if (failureMessage) {
      console.error(`sys:openPath failed for ${path}: ${failureMessage}`)
    }
  })
}
