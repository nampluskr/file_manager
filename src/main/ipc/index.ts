// Electron dependencies are injected only at this layer (SPEC.md §11.4).

import { app, ipcMain, shell } from 'electron'
import { isAbsolute, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { listDirectory } from '../filesystem/listDirectory'
import { toUserMessage } from '../filesystem/errorMessages'
import { isPresetId, launchPreset } from '../filesystem/launcher'
import { readTextFile } from '../filesystem/readTextFile'
import { writeTextFile } from '../filesystem/writeTextFile'
import { createDefaultSettings, restoreSettings, saveSettings } from '../config/settings'
import type { WriteTextRequest } from '../../shared/ipc'
import type { FileEntry, Settings } from '../../shared/types'

// SPEC.md §12.3: Main validates every path a Renderer sends.
function assertAbsolutePath(requestedPath: string): string {
  if (typeof requestedPath !== 'string' || requestedPath.length === 0) {
    throw new Error('경로가 올바르지 않습니다')
  }
  if (!isAbsolute(requestedPath)) throw new Error('경로가 올바르지 않습니다')
  const resolved = resolve(requestedPath)
  if (!isAbsolute(resolved)) throw new Error('경로가 올바르지 않습니다')
  return resolved
}

export function registerIpcHandlers(): void {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const defaultSettings = createDefaultSettings(app.getPath('home'))
  // The executable probe begins once during startup and its result is reused
  // by every launcher request (SPEC.md §8.4.1).
  const windowsTerminalAvailable = new Promise<boolean>((resolveProbe) => {
    const probe = execFile('where.exe', ['wt.exe'], { windowsHide: true }, (error) => resolveProbe(!error))
    probe.once('error', () => resolveProbe(false))
  })
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

  ipcMain.handle('file:readText', async (_event, requestedPath: string) => {
    const path = assertAbsolutePath(requestedPath)
    try {
      return await readTextFile(path)
    } catch (error) {
      throw new Error(toUserMessage(error))
    }
  })

  ipcMain.handle('file:writeText', async (_event, request: WriteTextRequest) => {
    const path = assertAbsolutePath(request.path)
    try {
      return await writeTextFile({ ...request, path })
    } catch (error) {
      return { ok: false as const, reason: 'error' as const, code: 'WRITE_FAILED', message: toUserMessage(error) }
    }
  })

  ipcMain.handle('sys:openInCode', async (_event, requestedPath: string): Promise<void> => {
    const path = assertAbsolutePath(requestedPath)
    const url = `vscode://file/${encodeURI(path.replace(/\\/g, '/'))}`
    await shell.openExternal(url)
  })

  ipcMain.handle('sys:launch', async (_event, preset: unknown, requestedPath: string) => {
    if (!isPresetId(preset)) throw new Error('Unsupported launch preset.')
    const cwd = assertAbsolutePath(requestedPath)
    const hasWindowsTerminal = await windowsTerminalAvailable

    try {
      const process = launchPreset(preset, cwd, hasWindowsTerminal, (plan) =>
        execFile(plan.command, plan.args, {
          cwd: plan.cwd,
          detached: true,
          windowsHide: false
        } as never, (error) => {
          if (error) console.error(`sys:launch process failed for ${preset}:`, error)
        })
      )
      await new Promise<void>((resolveLaunch, rejectLaunch) => {
        process.once('spawn', () => resolveLaunch())
        process.once('error', (error) => rejectLaunch(error))
      })
      return { ok: true, succeeded: [], failed: [], cancelled: false }
    } catch (error) {
      const message = toUserMessage(error)
      console.error(`sys:launch failed for ${preset}:`, error)
      return {
        ok: false,
        succeeded: [],
        failed: [{ name: preset, code: 'LAUNCH_FAILED', message }],
        cancelled: false
      }
    }
  })

  ipcMain.handle('config:load', async (): Promise<Settings> => restoreSettings(settingsPath, defaultSettings))
  ipcMain.handle('config:save', async (_event, settings: Settings): Promise<void> => {
    await saveSettings(settingsPath, settings)
  })
}
