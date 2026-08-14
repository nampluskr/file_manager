// IPC channel names and payload types shared between main and renderer.
// See SPEC.md §11.2-11.3. Handlers are implemented in later phases; this
// file defines the contract only.

import type { FileEntry, Settings } from './types'

export type ConflictAction = 'overwrite' | 'skip' | 'rename' | 'cancel'

export type TransferRequest = {
  opId: string
  sourceDir: string
  names: string[]
  destDir: string
}

export type DeleteRequest = {
  opId: string
  dir: string
  names: string[]
  permanent: boolean // false = recycle bin
}

export type OpResult = {
  ok: boolean
  succeeded: string[]
  failed: { name: string; code: string; message: string }[]
  cancelled: boolean
}

export type ReadTextResult = {
  content: string
  encoding: 'utf8' | 'utf8-bom' | 'cp949'
  eol: 'crlf' | 'lf'
  mtime: number
  hash: string
  editable: boolean // false when encoding detection failed or the file is too large
  reason?: string // why editable is false
}

export type WriteTextRequest = {
  path: string
  content: string
  encoding: ReadTextResult['encoding']
  eol: ReadTextResult['eol']
  expectedMtime: number
  expectedHash: string
  force: boolean // overwrite even if mtime no longer matches
}

export type WriteTextResult =
  | { ok: true; mtime: number; hash: string }
  | { ok: false; reason: 'mtime-mismatch'; actualMtime: number }
  | { ok: false; reason: 'error'; code: string; message: string }

export type DriveInfo = { letter: string; free: number | null; total: number | null }

export type PresetId = 'cmd' | 'claude' | 'codex' | 'agy' | 'code'

// Request/response shape for each invoke channel (Renderer -> Main).
export type IpcContract = {
  'fs:listDirectory': (path: string) => { path: string; entries: FileEntry[] }
  'fs:createDirectory': (path: string, name: string) => OpResult
  'fs:copy': (req: TransferRequest) => OpResult
  'fs:move': (req: TransferRequest) => OpResult
  'fs:rename': (path: string, from: string, to: string) => OpResult
  'fs:delete': (req: DeleteRequest) => OpResult
  'fs:cancel': (opId: string) => void

  'file:readText': (path: string) => ReadTextResult
  'file:writeText': (req: WriteTextRequest) => WriteTextResult

  'sys:listDrives': () => DriveInfo[]
  'sys:driveUsage': (letter: string) => { free: number; total: number }
  'sys:fileIcon': (ext: string) => string // data URL
  'sys:openPath': (path: string) => void // default associated program
  'sys:openInCode': (path: string) => void
  'sys:launch': (preset: PresetId, cwd: string) => OpResult

  'config:load': () => Settings
  'config:save': (settings: Settings) => void
}

export type IpcChannel = keyof IpcContract

// Main -> Renderer events.
export type IpcEvents = {
  'op:progress': { opId: string; currentFile: string; done: number }
  'op:conflict': { opId: string; name: string; kind: 'file' | 'dir' }
  'app:focus': void
}

// Renderer's reply to an 'op:conflict' event.
export type ConflictResponse = { action: ConflictAction; applyToAll: boolean }
