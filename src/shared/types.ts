// Domain state shared between main and renderer. See SPEC.md §7 and §13.2.

export type FileEntry = {
  name: string // file name only, not a full path
  ext: string // extension without the leading '.'; empty for directories
  size: number // bytes; 0 for directories
  mtime: number // epoch ms
  isDirectory: boolean
  isSymlink: boolean
  isParent: boolean // the "[..]" entry
}

export type SortKey = 'name' | 'ext' | 'size' | 'mtime'

export type PaneState = {
  currentPath: string
  entries: FileEntry[]
  focusedIndex: number
  selectedNames: Set<string> // lower-cased, normalized file names
  scrollTop: number
  sortKey: SortKey
  sortAsc: boolean
  isLoading: boolean
  error: string | null
}

// F2 rename, F7 new folder, delete confirmation, favorites list (Ctrl+D),
// and the copy/move conflict prompt (see ipc.ts ConflictAction) all surface
// through this single overlay slot so only one can be shown at a time.
export type DialogState =
  | { kind: 'confirmDelete'; dir: string; names: string[]; permanent: boolean }
  | { kind: 'confirmTransfer'; mode: 'copy' | 'move'; sourceDir: string; destDir: string; names: string[] }
  | { kind: 'conflict'; opId: string; name: string; entryKind: 'file' | 'dir' }
  | { kind: 'progress'; opId: string; label: string; total: number; done: number; currentFile: string }
  | { kind: 'favorites' }
  | { kind: 'rename'; dir: string; name: string }
  | { kind: 'newFolder'; dir: string }
  | { kind: 'message'; text: string }

export type OverlayState =
  | { kind: 'none' }
  | { kind: 'viewer'; path: string }
  | { kind: 'editor'; path: string }
  | { kind: 'dialog'; dialog: DialogState }

export type AppState = {
  panes: {
    left: PaneState[] // tab array; length is always 1 in v0.1
    right: PaneState[]
  }
  activeTabIndex: { left: number; right: number }
  activePane: 'left' | 'right'
  theme: 'dark' | 'light' | 'dim'
  overlay: OverlayState
}

export type Settings = {
  version: 1
  panes: {
    left: { path: string; sortKey: SortKey; sortAsc: boolean }
    right: { path: string; sortKey: SortKey; sortAsc: boolean }
  }
  activePane: 'left' | 'right'
  theme: 'dark' | 'light' | 'dim'
  window: { width: number; height: number; x: number | null; y: number | null }
  favorites: { key: number; label: string; path: string }[] // key: 1-9
  globalHotkey: string // e.g. 'Alt+`'
}
