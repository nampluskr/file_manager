// Electron dependencies are injected only at this layer (SPEC.md §11.4).

import { app, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { isAbsolute, resolve } from 'node:path'
import { lstat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { listDirectory } from '../filesystem/listDirectory'
import { toUserMessage } from '../filesystem/errorMessages'
import { isPresetId, launchPreset } from '../filesystem/launcher'
import { readTextFile } from '../filesystem/readTextFile'
import { writeTextFile } from '../filesystem/writeTextFile'
import { createDefaultSettings, restoreSettings, saveSettings } from '../config/settings'
import { copyItems } from '../filesystem/copyItems'
import type { ConflictDecision, ConflictKind } from '../filesystem/copyItems'
import { moveItems } from '../filesystem/moveItems'
import { renameItem } from '../filesystem/renameItem'
import { createDirectory } from '../filesystem/createDirectory'
import { deletePermanently } from '../filesystem/deleteItems'
import { trashItems } from '../system/trash'
import type { ConflictResponse, DeleteRequest, OpResult, TransferRequest, WriteTextRequest } from '../../shared/ipc'
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

// SPEC.md §12.3: `names` carries file names only, never nested paths. "." and
// ".." must be rejected too -- otherwise join(dir, "..") walks straight out
// of `dir` and a delete request can remove the parent directory (see A7 #1).
function assertPlainNames(names: unknown): string[] {
  if (!Array.isArray(names) || names.length === 0) throw new Error('대상이 지정되지 않았습니다')
  for (const name of names) {
    if (
      typeof name !== 'string' ||
      name.length === 0 ||
      name === '.' ||
      name === '..' ||
      name.includes('\\') ||
      name.includes('/')
    ) {
      throw new Error('잘못된 파일명이 포함되어 있습니다')
    }
  }
  return names as string[]
}

// SPEC.md §12.3: Main confirms the destination exists before starting a
// transfer instead of letting mkdir(recursive: true) silently fabricate a
// missing destination tree (see A7 #11).
async function assertExistingDirectory(path: string): Promise<void> {
  try {
    const stats = await lstat(path)
    if (!stats.isDirectory()) throw new Error('대상이 폴더가 아닙니다')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('대상 경로를 찾을 수 없습니다')
    throw error
  }
}

export function registerIpcHandlers(): void {
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const defaultSettings = createDefaultSettings(app.getPath('home'))

  // SPEC.md §6.8: only one file operation (copy/move/delete) runs at a time.
  let activeOpId: string | null = null
  const controllers = new Map<string, AbortController>()
  const pendingConflicts = new Map<string, (response: ConflictResponse) => void>()

  ipcMain.on('fs:conflictReply', (_event, opId: string, response: ConflictResponse) => {
    const resolve = pendingConflicts.get(opId)
    if (resolve) {
      pendingConflicts.delete(opId)
      resolve(response)
    }
  })

  // If `signal` is already aborted -- or becomes aborted while this
  // particular conflict prompt is outstanding -- the wait resolves as a
  // cancel instead of hanging forever. Without this, a cancel that lands in
  // the gap between the engine checking `signal.aborted` and this promise
  // actually registering itself in `pendingConflicts` is missed entirely:
  // fs:cancel's lookup finds nothing to resolve, and the operation (and its
  // activeOpId lock) is stuck for good (see A7-2 #2 Major, the residual
  // conflict-wait race).
  function makeConflictResolver(opId: string, event: IpcMainInvokeEvent, signal: AbortSignal) {
    return (name: string, kind: ConflictKind): Promise<ConflictDecision> =>
      new Promise((resolveConflict) => {
        if (signal.aborted) {
          resolveConflict({ action: 'cancel', applyToAll: false })
          return
        }
        const onAbort = (): void => {
          pendingConflicts.delete(opId)
          resolveConflict({ action: 'cancel', applyToAll: false })
        }
        signal.addEventListener('abort', onAbort, { once: true })
        pendingConflicts.set(opId, (response) => {
          signal.removeEventListener('abort', onAbort)
          resolveConflict(response)
        })
        event.sender.send('op:conflict', { opId, name, kind })
      })
  }

  function makeProgressReporter(opId: string, event: IpcMainInvokeEvent) {
    let done = 0
    return (currentFile: string, doneCount: number) => {
      done = doneCount
      event.sender.send('op:progress', { opId, currentFile, done })
    }
  }

  // Acquires the single-flight lock synchronously (no `await` before the
  // check-then-set), then runs `run`, releasing the lock in `finally`
  // regardless of how `run` exits (return, throw, or an unhandled
  // rejection surfacing as a caught error). `run` is responsible for
  // catching its own errors and returning a structured OpResult -- see the
  // `fs:copy`/`fs:move`/`fs:delete`/`fs:rename`/`fs:createDirectory`
  // handlers below, all of which wrap their body in try/catch before this
  // ever runs `finally` (A7-2 #4: the previous point-in-time-only
  // `rejectIfBusy()` check never actually took the lock, so two calls could
  // both pass it).
  function runExclusive(opId: string, run: () => Promise<OpResult>): OpResult | Promise<OpResult> {
    if (activeOpId !== null) {
      return { ok: false, succeeded: [], failed: [{ name: '', code: 'EBUSY_OP', message: '다른 작업이 진행 중입니다' }], cancelled: false }
    }
    activeOpId = opId
    return run().finally(() => {
      controllers.delete(opId)
      pendingConflicts.delete(opId)
      activeOpId = null
    })
  }
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

  function toFailureResult(error: unknown): OpResult {
    return { ok: false, succeeded: [], failed: [{ name: '', code: 'ERROR', message: toUserMessage(error) }], cancelled: false }
  }

  // SPEC.md §6.8: rename/createDirectory share the same single-flight lock
  // as copy/move/delete (they can touch the same tree a transfer is working
  // on). A validation failure or thrown error inside `run` is converted to
  // a structured OpResult rather than left to reject the invoke() call, so
  // the renderer always has a result to close its progress dialog with
  // (A7-2 #7).
  async function runExclusiveOp(opId: string, run: () => Promise<OpResult>): Promise<OpResult> {
    const busyOrPromise = runExclusive(opId, async () => {
      try {
        return await run()
      } catch (error) {
        return toFailureResult(error)
      }
    })
    return busyOrPromise
  }

  ipcMain.handle('fs:createDirectory', async (_event, requestedPath: string, name: string): Promise<OpResult> =>
    runExclusiveOp('createDirectory', async () => {
      const dir = assertAbsolutePath(requestedPath)
      const result = await createDirectory(dir, name)
      return result.ok
        ? { ok: true, succeeded: [name], failed: [], cancelled: false }
        : { ok: false, succeeded: [], failed: [{ name, code: result.code, message: result.message }], cancelled: false }
    })
  )

  ipcMain.handle('fs:rename', async (_event, requestedPath: string, from: string, to: string): Promise<OpResult> =>
    runExclusiveOp('rename', async () => {
      const dir = assertAbsolutePath(requestedPath)
      assertPlainNames([from])
      assertPlainNames([to])
      const result = await renameItem(dir, from, to)
      return result.ok
        ? { ok: true, succeeded: [to], failed: [], cancelled: false }
        : { ok: false, succeeded: [], failed: [{ name: from, code: result.code, message: result.message }], cancelled: false }
    })
  )

  ipcMain.handle('fs:copy', async (event, request: TransferRequest): Promise<OpResult> =>
    runExclusiveOp(request.opId, async () => {
      const sourceDir = assertAbsolutePath(request.sourceDir)
      const destDir = assertAbsolutePath(request.destDir)
      await assertExistingDirectory(destDir)
      const names = assertPlainNames(request.names)
      const controller = new AbortController()
      controllers.set(request.opId, controller)
      const result = await copyItems({
        sourceDir,
        destDir,
        names,
        signal: controller.signal,
        onProgress: makeProgressReporter(request.opId, event),
        onConflict: makeConflictResolver(request.opId, event, controller.signal)
      })
      return { ok: result.failed.length === 0 && !result.cancelled, ...result }
    })
  )

  ipcMain.handle('fs:move', async (event, request: TransferRequest): Promise<OpResult> =>
    runExclusiveOp(request.opId, async () => {
      const sourceDir = assertAbsolutePath(request.sourceDir)
      const destDir = assertAbsolutePath(request.destDir)
      await assertExistingDirectory(destDir)
      const names = assertPlainNames(request.names)
      const controller = new AbortController()
      controllers.set(request.opId, controller)
      const result = await moveItems({
        sourceDir,
        destDir,
        names,
        signal: controller.signal,
        onProgress: makeProgressReporter(request.opId, event),
        onConflict: makeConflictResolver(request.opId, event, controller.signal)
      })
      return { ok: result.failed.length === 0 && !result.cancelled, ...result }
    })
  )

  ipcMain.handle('fs:delete', async (_event, request: DeleteRequest): Promise<OpResult> =>
    runExclusiveOp(request.opId, async () => {
      const dir = assertAbsolutePath(request.dir)
      const names = assertPlainNames(request.names)
      const controller = new AbortController()
      controllers.set(request.opId, controller)
      const result = request.permanent
        ? await deletePermanently(dir, names, controller.signal)
        : await trashItems(dir, names, controller.signal)
      return { ok: result.failed.length === 0 && !result.cancelled, ...result }
    })
  )

  ipcMain.handle('fs:cancel', async (_event, opId: string): Promise<void> => {
    controllers.get(opId)?.abort()
    // Without this, cancelling while a conflict dialog is open leaves the
    // operation's promise chain waiting forever and activeOpId never clears,
    // permanently blocking every future transfer with EBUSY_OP (see A7 #8).
    const resolveConflict = pendingConflicts.get(opId)
    if (resolveConflict) {
      pendingConflicts.delete(opId)
      resolveConflict({ action: 'cancel', applyToAll: false })
    }
  })

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
