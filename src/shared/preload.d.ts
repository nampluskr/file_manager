import type { PingResult } from './ipc'

export {}

declare global {
  interface Window {
    fileManager: {
      ping: () => Promise<PingResult>
    }
  }
}
