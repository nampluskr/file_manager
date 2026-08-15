import type { FileEntry, Settings } from './types'
import type {
  ConflictResponse,
  DeleteRequest,
  DriveInfo,
  IpcEvents,
  OpResult,
  PresetId,
  TransferRequest,
  WriteTextRequest,
  WriteTextResult
} from './ipc'
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
      loadSettings: () => Promise<Settings>
      saveSettings: (settings: Settings) => Promise<void>
      listDrives: () => Promise<DriveInfo[]>
      driveUsage: (letter: string) => Promise<{ free: number; total: number }>
      fileIcon: (ext: string) => Promise<string>
      createDirectory: (path: string, name: string) => Promise<OpResult>
      rename: (path: string, from: string, to: string) => Promise<OpResult>
      copy: (request: TransferRequest) => Promise<OpResult>
      move: (request: TransferRequest) => Promise<OpResult>
      deleteItems: (request: DeleteRequest) => Promise<OpResult>
      cancelOp: (opId: string) => Promise<void>
      replyConflict: (opId: string, response: ConflictResponse) => void
      onProgress: (listener: (payload: IpcEvents['op:progress']) => void) => () => void
      onConflict: (listener: (payload: IpcEvents['op:conflict']) => void) => () => void
    }
  }
}
