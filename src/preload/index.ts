import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry, Settings } from '../shared/types'
import type {
  ConflictResponse,
  DeleteRequest,
  IpcEvents,
  OpResult,
  PresetId,
  TransferRequest,
  WriteTextRequest,
  WriteTextResult
} from '../shared/ipc'
import type { ReadTextResult } from '../shared/ipc'

contextBridge.exposeInMainWorld('fileManager', {
  // Read synchronously in the preload's own Node context; no IPC round
  // trip needed just to seed the initial pane path.
  homePath: process.env.USERPROFILE ?? 'C:\\',

  listDirectory: (path: string): Promise<{ path: string; entries: FileEntry[] }> =>
    ipcRenderer.invoke('fs:listDirectory', path),

  openPath: (path: string): Promise<void> => ipcRenderer.invoke('sys:openPath', path),
  openInCode: (path: string): Promise<void> => ipcRenderer.invoke('sys:openInCode', path),

  launch: (preset: PresetId, cwd: string): Promise<OpResult> => ipcRenderer.invoke('sys:launch', preset, cwd),
  readText: (path: string): Promise<ReadTextResult> => ipcRenderer.invoke('file:readText', path),
  writeText: (request: WriteTextRequest): Promise<WriteTextResult> => ipcRenderer.invoke('file:writeText', request),
  loadSettings: (): Promise<Settings> => ipcRenderer.invoke('config:load'),
  saveSettings: (settings: Settings): Promise<void> => ipcRenderer.invoke('config:save', settings),

  createDirectory: (path: string, name: string): Promise<OpResult> => ipcRenderer.invoke('fs:createDirectory', path, name),
  rename: (path: string, from: string, to: string): Promise<OpResult> => ipcRenderer.invoke('fs:rename', path, from, to),
  copy: (request: TransferRequest): Promise<OpResult> => ipcRenderer.invoke('fs:copy', request),
  move: (request: TransferRequest): Promise<OpResult> => ipcRenderer.invoke('fs:move', request),
  deleteItems: (request: DeleteRequest): Promise<OpResult> => ipcRenderer.invoke('fs:delete', request),
  cancelOp: (opId: string): Promise<void> => ipcRenderer.invoke('fs:cancel', opId),
  replyConflict: (opId: string, response: ConflictResponse): void => ipcRenderer.send('fs:conflictReply', opId, response),

  onProgress: (listener: (payload: IpcEvents['op:progress']) => void): (() => void) => {
    const handler = (_event: unknown, payload: IpcEvents['op:progress']): void => listener(payload)
    ipcRenderer.on('op:progress', handler)
    return () => ipcRenderer.removeListener('op:progress', handler)
  },
  onConflict: (listener: (payload: IpcEvents['op:conflict']) => void): (() => void) => {
    const handler = (_event: unknown, payload: IpcEvents['op:conflict']): void => listener(payload)
    ipcRenderer.on('op:conflict', handler)
    return () => ipcRenderer.removeListener('op:conflict', handler)
  }
})
