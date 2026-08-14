// Electron dependencies are injected only at this layer (SPEC.md §11.4).
// Phase 0 wires a single scaffolding channel to prove the typed IPC round
// trip; the real fs:/file:/sys:/config: channels from shared/ipc.ts are
// implemented in later phases.

import { ipcMain } from 'electron'
import { PING_CHANNEL, type PingResult } from '../../shared/ipc'

export function registerIpcHandlers(): void {
  ipcMain.handle(PING_CHANNEL, (): PingResult => {
    return { message: 'pong', receivedAt: Date.now() }
  })
}
