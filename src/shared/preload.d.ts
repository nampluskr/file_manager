import type { FileEntry } from './types'
import type { OpResult, PresetId, WriteTextRequest, WriteTextResult } from './ipc'
import type { ReadTextResult } from './ipc'

export {}

declare global {
  interface Window {
    fileManager: {
      homePath: string
      listDirectory: (path: string) => Promise<{ path: string; entries: FileEntry[] }>
      openPath: (path: string) => Promise<void>
      openInCode: (path: string) => Promise<void>
      launch: (preset: PresetId, cwd: string) => Promise<OpResult>
      readText: (path: string) => Promise<ReadTextResult>
      writeText: (request: WriteTextRequest) => Promise<WriteTextResult>
    }
  }
}
