import type { FileEntry } from './types'

export {}

declare global {
  interface Window {
    fileManager: {
      homePath: string
      listDirectory: (path: string) => Promise<{ path: string; entries: FileEntry[] }>
      openPath: (path: string) => Promise<void>
    }
  }
}
