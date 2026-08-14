import { contextBridge, ipcRenderer } from 'electron'

// Phase 0 scaffolding: proves the typed IPC round trip end to end. The real
// API surface (fs:/file:/sys:/config: channels) is exposed once each phase
// implements its handlers.
contextBridge.exposeInMainWorld('fileManager', {
  platform: process.platform,
  ping: (): Promise<{ message: string; receivedAt: number }> => ipcRenderer.invoke('app:ping')
})
