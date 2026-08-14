import { contextBridge, ipcRenderer } from 'electron'
import type { FileEntry } from '../shared/types'
import type { OpResult, PresetId } from '../shared/ipc'

contextBridge.exposeInMainWorld('fileManager', {
  // Read synchronously in the preload's own Node context; no IPC round
  // trip needed just to seed the initial pane path.
  homePath: process.env.USERPROFILE ?? 'C:\\',

  listDirectory: (path: string): Promise<{ path: string; entries: FileEntry[] }> =>
    ipcRenderer.invoke('fs:listDirectory', path),

  openPath: (path: string): Promise<void> => ipcRenderer.invoke('sys:openPath', path),

  launch: (preset: PresetId, cwd: string): Promise<OpResult> => ipcRenderer.invoke('sys:launch', preset, cwd)
})
