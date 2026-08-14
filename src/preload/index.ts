import { contextBridge, ipcRenderer } from 'electron'
import { PING_CHANNEL, type PingResult } from '../shared/ipc'

// Phase 0 scaffolding: proves the typed IPC round trip end to end. The real
// API surface (fs:/file:/sys:/config: channels) is exposed once each phase
// implements its handlers.
contextBridge.exposeInMainWorld('fileManager', {
  ping: (): Promise<PingResult> => ipcRenderer.invoke(PING_CHANNEL)
})
