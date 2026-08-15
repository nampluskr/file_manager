import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react'
import type { PaneState, SortKey } from '../../../../shared/types'
import type { DialogState } from '../../../../shared/types'
import type { ConflictAction, DriveInfo, OpResult, TransferRequest } from '../../../../shared/ipc'
import { useFilePane } from '../../hooks/useFilePane'
import { FileList } from '../FileList/FileList'
import { PathBar } from '../PathBar/PathBar'
import { DriveBar } from '../DriveBar/DriveBar'
import { StatusBar } from '../StatusBar/StatusBar'
import { CommandLauncher } from '../CommandLauncher/CommandLauncher'
import { driveLetterOf, joinPath } from '../../state/pathHelpers'
import { formatCapacity } from '../../state/format'

const PRINTABLE_KEY_PATTERN = /^[\p{L}\p{N}]$/u

const SORT_KEY_BY_FUNCTION_KEY: Record<string, 'name' | 'ext' | 'mtime' | 'size'> = {
  F3: 'name',
  F4: 'ext',
  F5: 'mtime',
  F6: 'size'
}

function makeOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// SPEC.md §5.3: selection wins over focus; "[..]" is never a valid target.
function getOperationTargets(state: PaneState): string[] | null {
  if (state.selectedNames.size > 0) {
    const names = state.entries.filter((entry) => !entry.isParent && state.selectedNames.has(entry.name.toLowerCase())).map((entry) => entry.name)
    return names.length > 0 ? names : null
  }
  const focused = state.entries[state.focusedIndex]
  if (!focused || focused.isParent) return null
  return [focused.name]
}

function summarizeResult(result: OpResult): string {
  const lines = [
    result.cancelled ? `취소됨: ${result.succeeded.length}개 처리 후 중단` : `완료: 성공 ${result.succeeded.length}개`
  ]
  for (const failure of result.failed) lines.push(`${failure.name}: ${failure.message}`)
  return lines.join('\n')
}

type FilePaneProps = {
  side: 'left' | 'right'
  initialPath: string
  initialSortKey: SortKey
  initialSortAsc: boolean
  initialState?: PaneState
  isActive: boolean
  overlayOpen: boolean
  otherPanePath: string
  refreshToken: number
  drives: DriveInfo[] | null
  onView: (path: string) => void
  onEdit: (path: string) => void
  onStateChange: (state: PaneState) => void
  onActivate: () => void
  onSwitchPane: () => void
  onSwapPanes: () => void
  onOperationComplete: () => void
  favorites: { key: number; label: string; path: string }[]
}

const DRIVE_MENU_KEY: Record<'left' | 'right', string> = { left: 'F1', right: 'F2' }

export function FilePane({
  side,
  initialPath,
  initialSortKey,
  initialSortAsc,
  initialState,
  isActive,
  overlayOpen,
  otherPanePath,
  refreshToken,
  drives,
  onView,
  onEdit,
  onStateChange,
  onActivate,
  onSwitchPane,
  onSwapPanes,
  onOperationComplete,
  favorites
}: FilePaneProps): ReactElement {
  const {
    state,
    moveFocus,
    moveFocusToEdge,
    activateFocused,
    activateAt,
    goToParent,
    goToPath,
    setSort,
    setScrollTop,
    typeAhead,
    refresh,
    toggleSelect,
    selectAll,
    clearSelection,
    selectClick
  } = useFilePane(initialPath, initialSortKey, initialSortAsc, initialState)
  const [pageSize, setPageSize] = useState(10)
  const [launcherFocused, setLauncherFocused] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [favoriteIndex, setFavoriteIndex] = useState(0)
  const [driveMenuOpen, setDriveMenuOpen] = useState(false)
  const [driveMenuIndex, setDriveMenuIndex] = useState(0)
  const [driveUsage, setDriveUsage] = useState<{ free: number; total: number } | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const dialogInputRef = useRef<HTMLInputElement>(null)
  const opIdRef = useRef<string | null>(null)
  const isFirstRefreshToken = useRef(true)
  const driveLetter = driveLetterOf(state.currentPath)

  // Without this, Arrow/Enter/Backspace do nothing until the user clicks
  // the pane or tabs into it (SPEC.md §4.3 expects them to work immediately).
  useEffect(() => {
    if (isActive && !overlayOpen) paneRef.current?.focus()
  }, [isActive, overlayOpen])

  useEffect(() => onStateChange(state), [onStateChange, state])

  // Fetches this pane's drive capacity without disturbing whatever value is
  // already shown -- SPEC.md §10.3: "값이 도착하기 전에는 이전 값 또는
  // 빈칸을 유지한다".
  function refreshDriveUsage(letter: string): void {
    if (!letter) return
    window.fileManager
      .driveUsage(letter)
      .then(setDriveUsage)
      .catch(() => setDriveUsage(null))
  }

  useEffect(() => {
    const refreshOnFocus = (): void => {
      refresh()
      refreshDriveUsage(driveLetter)
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, driveLetter])

  // A completed operation on either pane invalidates both panes' listings
  // (SPEC.md §6.1 step 7) and this pane's own drive's capacity;
  // refreshToken is bumped by the parent for that.
  useEffect(() => {
    if (isFirstRefreshToken.current) {
      isFirstRefreshToken.current = false
      return
    }
    refresh()
    refreshDriveUsage(driveLetter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  // The pane switched to a different drive: blank the stale reading until
  // the new drive's capacity arrives (SPEC.md §3.2).
  useEffect(() => {
    setDriveUsage(null)
    refreshDriveUsage(driveLetter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveLetter])

  // Alt+F1 (left) / Alt+F2 (right) opens this pane's drive list regardless
  // of which pane currently has keyboard focus (SPEC.md §4.7), and the menu
  // itself must keep responding to Arrow/Enter/Escape the same way even if
  // focus is still sitting in the other pane -- so both the trigger and the
  // menu's own navigation are handled on a window-level listener instead of
  // paneRef's onKeyDown, which only fires while this pane is focused.
  useEffect(() => {
    const handleDriveMenuKey = (event: KeyboardEvent): void => {
      if (driveMenuOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setDriveMenuOpen(false)
        } else if (event.key === 'ArrowDown' && drives && drives.length > 0) {
          event.preventDefault()
          setDriveMenuIndex((index) => Math.min(index + 1, drives.length - 1))
        } else if (event.key === 'ArrowUp' && drives && drives.length > 0) {
          event.preventDefault()
          setDriveMenuIndex((index) => Math.max(index - 1, 0))
        } else if (event.key === 'Enter') {
          const drive = drives?.[driveMenuIndex]
          if (drive) {
            event.preventDefault()
            goToPath(`${drive.letter}:\\`)
            setDriveMenuOpen(false)
          }
        }
        return
      }
      if (!event.altKey || event.key !== DRIVE_MENU_KEY[side]) return
      if (overlayOpen || dialog || favoritesOpen) return
      event.preventDefault()
      setDriveMenuIndex(0)
      setDriveMenuOpen(true)
    }
    window.addEventListener('keydown', handleDriveMenuKey)
    return () => window.removeEventListener('keydown', handleDriveMenuKey)
  }, [side, overlayOpen, dialog, favoritesOpen, driveMenuOpen, driveMenuIndex, drives, goToPath])

  useEffect(() => {
    const offProgress = window.fileManager.onProgress((payload) => {
      if (payload.opId !== opIdRef.current) return
      setDialog((current) => (current && current.kind === 'progress' ? { ...current, done: payload.done, currentFile: payload.currentFile } : current))
    })
    const offConflict = window.fileManager.onConflict((payload) => {
      if (payload.opId !== opIdRef.current) return
      setDialog({ kind: 'conflict', opId: payload.opId, name: payload.name, entryKind: payload.kind })
    })
    return () => {
      offProgress()
      offConflict()
    }
  }, [])

  // SPEC.md §6.4: renaming a file starts with only the basename selected
  // (extension left untouched); a folder or the new-folder prompt selects
  // the whole name (see A7 #16).
  useEffect(() => {
    if (!dialog || (dialog.kind !== 'rename' && dialog.kind !== 'newFolder')) return
    const input = dialogInputRef.current
    if (!input) return
    input.focus()
    if (dialog.kind === 'rename') {
      const entry = state.entries.find((candidate) => candidate.name === dialog.name)
      const dotIndex = dialog.name.lastIndexOf('.')
      if (!entry?.isDirectory && dotIndex > 0) {
        input.setSelectionRange(0, dotIndex)
        return
      }
    }
    input.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog])

  function finishOperation(result: OpResult): void {
    opIdRef.current = null
    // SPEC.md §6.1 step 6: always show the success/failure summary, not just
    // on failure -- an empty confirmation of "성공 N개" is still the report
    // the user was promised (see A7 #14).
    setDialog({ kind: 'message', text: summarizeResult(result) })
    refresh()
    onOperationComplete()
  }

  // sourceDir/dir are taken from the confirmation dialog the user actually
  // saw, not the pane's live currentPath -- otherwise switching panes or
  // paths between "dialog open" and "confirm click" would silently redirect
  // the operation to a different directory than what was shown (A7 #12).
  // A rejected invoke() (main-process validation throwing before it can
  // return a structured OpResult, a preload/IPC-layer error, etc.) must
  // still resolve the progress dialog -- otherwise opIdRef and the overlay
  // are stranded open with no way to close them (A7-2 #7).
  function toRejectionResult(error: unknown): OpResult {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, succeeded: [], failed: [{ name: '', code: 'ERROR', message }], cancelled: false }
  }

  async function runTransfer(mode: 'copy' | 'move', sourceDir: string, names: string[], destDir: string): Promise<void> {
    const opId = makeOpId()
    opIdRef.current = opId
    setDialog({ kind: 'progress', opId, label: mode === 'copy' ? '복사 중' : '이동 중', total: names.length, done: 0, currentFile: '' })
    const request: TransferRequest = { opId, sourceDir, names, destDir }
    try {
      const result = mode === 'copy' ? await window.fileManager.copy(request) : await window.fileManager.move(request)
      finishOperation(result)
    } catch (error) {
      finishOperation(toRejectionResult(error))
    }
  }

  async function runDelete(dir: string, names: string[], permanent: boolean): Promise<void> {
    const opId = makeOpId()
    opIdRef.current = opId
    setDialog({ kind: 'progress', opId, label: permanent ? '영구 삭제 중' : '휴지통으로 이동 중', total: names.length, done: 0, currentFile: '' })
    try {
      const result = await window.fileManager.deleteItems({ opId, dir, names, permanent })
      finishOperation(result)
    } catch (error) {
      finishOperation(toRejectionResult(error))
    }
  }

  function cancelActiveOp(): void {
    if (opIdRef.current) void window.fileManager.cancelOp(opIdRef.current)
  }

  function replyConflict(action: ConflictAction, applyToAll: boolean): void {
    if (dialog?.kind !== 'conflict' || !opIdRef.current) return
    window.fileManager.replyConflict(opIdRef.current, { action, applyToAll })
    setDialog({ kind: 'progress', opId: opIdRef.current, label: '진행 중', total: 0, done: 0, currentFile: '' })
  }

  function openDialog(next: DialogState, defaultInput = ''): void {
    setDialogError(null)
    setInputValue(defaultInput)
    setDialog(next)
  }

  async function submitRename(): Promise<void> {
    if (dialog?.kind !== 'rename') return
    const result = await window.fileManager.rename(dialog.dir, dialog.name, inputValue)
    if (!result.ok) {
      setDialogError(result.failed[0]?.message ?? '이름을 바꿀 수 없습니다')
      return
    }
    setDialog(null)
    refresh()
  }

  async function submitNewFolder(): Promise<void> {
    if (dialog?.kind !== 'newFolder') return
    const result = await window.fileManager.createDirectory(dialog.dir, inputValue)
    if (!result.ok) {
      setDialogError(result.failed[0]?.message ?? '폴더를 만들 수 없습니다')
      return
    }
    setDialog(null)
    refresh()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (overlayOpen) return

    // The drive menu's own navigation is handled by the window-level
    // listener above (it must work even when the *other* pane is focused);
    // returning early here just stops this pane's own Arrow/Enter handling
    // from double-firing on the same keypress when this pane happens to be
    // the focused one.
    if (driveMenuOpen) return

    if (dialog) {
      if (dialog.kind === 'progress') {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelActiveOp()
        }
        return
      }
      if (dialog.kind === 'conflict') return // handled by dialog buttons only
      if (event.key === 'Escape') {
        event.preventDefault()
        setDialog(null)
        return
      }
      if (event.key === 'Enter' && (dialog.kind === 'rename' || dialog.kind === 'newFolder')) {
        event.preventDefault()
        void (dialog.kind === 'rename' ? submitRename() : submitNewFolder())
      }
      return
    }

    if (favoritesOpen) {
      event.preventDefault()
      if (event.key === 'Escape') {
        setFavoritesOpen(false)
      } else if (event.key === 'ArrowDown' && favorites.length > 0) {
        setFavoriteIndex((index) => Math.min(index + 1, favorites.length - 1))
      } else if (event.key === 'ArrowUp' && favorites.length > 0) {
        setFavoriteIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter') {
        const favorite = favorites[favoriteIndex]
        if (favorite) {
          goToPath(favorite.path)
          setFavoritesOpen(false)
        }
      }
      return
    }

    if (event.shiftKey && event.key === 'Delete') {
      event.preventDefault()
      if (opIdRef.current) return
      const targets = getOperationTargets(state)
      if (targets) openDialog({ kind: 'confirmDelete', dir: state.currentPath, names: targets, permanent: true })
      return
    }

    if (event.ctrlKey) {
      if (event.key.toLowerCase() === 'u') {
        event.preventDefault()
        onSwapPanes()
        return
      }
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setLauncherFocused(true)
        return
      }
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        void window.fileManager.launch('cmd', state.currentPath)
        return
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        void window.fileManager.launch('code', state.currentPath)
        return
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        refresh()
        return
      }
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
        return
      }
      // Excludes Shift: Ctrl+Shift+D is the global theme toggle (SPEC.md
      // §16.6), handled by a separate window-level listener in App.tsx --
      // without this check, that shortcut also opened Favorites here.
      if (event.key.toLowerCase() === 'd' && !event.shiftKey) {
        event.preventDefault()
        setFavoriteIndex(0)
        setFavoritesOpen(true)
        return
      }
      const favoriteKey = Number(event.key)
      if (favoriteKey >= 1 && favoriteKey <= 9) {
        event.preventDefault()
        const favorite = favorites.find((item) => item.key === favoriteKey)
        if (favorite) goToPath(favorite.path)
        return
      }
      const sortKey = SORT_KEY_BY_FUNCTION_KEY[event.key]
      if (sortKey) {
        event.preventDefault()
        setSort(sortKey)
      }
      return
    }

    if (launcherFocused) return

    switch (event.key) {
      case 'Tab':
        event.preventDefault()
        onSwitchPane()
        return
      case 'F2': {
        event.preventDefault()
        if (opIdRef.current) return
        const focused = state.entries[state.focusedIndex]
        if (!focused || focused.isParent) return
        openDialog({ kind: 'rename', dir: state.currentPath, name: focused.name }, focused.name)
        return
      }
      case 'F3': {
        const focused = state.entries[state.focusedIndex]
        if (!focused || focused.isDirectory || focused.isParent) return
        event.preventDefault()
        onView(joinPath(state.currentPath, focused.name))
        return
      }
      case 'F4': {
        const focused = state.entries[state.focusedIndex]
        if (!focused || focused.isDirectory || focused.isParent) return
        event.preventDefault()
        onEdit(joinPath(state.currentPath, focused.name))
        return
      }
      case 'F5': {
        event.preventDefault()
        if (opIdRef.current) return
        const targets = getOperationTargets(state)
        if (targets) openDialog({ kind: 'confirmTransfer', mode: 'copy', sourceDir: state.currentPath, destDir: otherPanePath, names: targets })
        return
      }
      case 'F6': {
        event.preventDefault()
        if (opIdRef.current) return
        const targets = getOperationTargets(state)
        if (targets) openDialog({ kind: 'confirmTransfer', mode: 'move', sourceDir: state.currentPath, destDir: otherPanePath, names: targets })
        return
      }
      case 'F7': {
        event.preventDefault()
        if (opIdRef.current) return
        openDialog({ kind: 'newFolder', dir: state.currentPath })
        return
      }
      case 'F8':
      case 'Delete': {
        event.preventDefault()
        if (opIdRef.current) return
        const targets = getOperationTargets(state)
        if (targets) openDialog({ kind: 'confirmDelete', dir: state.currentPath, names: targets, permanent: false })
        return
      }
      case ' ':
        event.preventDefault()
        toggleSelect()
        return
      case 'Escape':
        event.preventDefault()
        clearSelection()
        return
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-1)
        return
      case 'PageDown':
        event.preventDefault()
        moveFocus(pageSize)
        return
      case 'PageUp':
        event.preventDefault()
        moveFocus(-pageSize)
        return
      case 'Home':
        event.preventDefault()
        moveFocusToEdge('home')
        return
      case 'End':
        event.preventDefault()
        moveFocusToEdge('end')
        return
      case 'Enter':
        event.preventDefault()
        activateFocused()
        return
      case 'Backspace':
        event.preventDefault()
        goToParent()
        return
      default:
        if (event.key.length === 1 && PRINTABLE_KEY_PATTERN.test(event.key)) {
          typeAhead(event.key)
        }
    }
  }

  return (
    <div
      ref={paneRef}
      className={isActive ? 'file-pane file-pane-active' : 'file-pane'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget) {
          setLauncherFocused(false)
          onActivate()
        }
      }}
    >
      <DriveBar letter={driveLetter} usage={driveUsage} />
      <PathBar path={state.currentPath} />
      <div className="file-list-header">
        <span className="file-row-cell file-row-icon" />
        <span className="file-row-cell file-row-name">이름</span>
        <span className="file-row-cell file-row-ext">확장자</span>
        <span className="file-row-cell file-row-size">크기</span>
        <span className="file-row-cell file-row-date">날짜</span>
      </div>
      {state.error ? <div className="file-pane-error">{state.error}</div> : null}
      <FileList
        entries={state.entries}
        focusedIndex={state.focusedIndex}
        selectedNames={state.selectedNames}
        scrollTop={state.scrollTop}
        onScrollTopChange={setScrollTop}
        onVisibleRowCountChange={setPageSize}
        onRowClick={(index, ctrlKey, shiftKey) => {
          paneRef.current?.focus()
          selectClick(index, ctrlKey, shiftKey)
        }}
        onRowDoubleClick={(index) => activateAt(index)}
      />
      <StatusBar entries={state.entries} selectedNames={state.selectedNames} />
      <CommandLauncher cwd={state.currentPath} focused={launcherFocused} onBlur={() => setLauncherFocused(false)} />
      {driveMenuOpen ? (
        <div className="favorites-overlay">
          <div className="favorites-dialog" role="dialog" aria-modal="true" aria-label="Drives">
            <div className="favorites-title">Drives</div>
            {drives === null ? (
              <div className="favorites-empty">조회 중...</div>
            ) : drives.length === 0 ? (
              <div className="favorites-empty">사용 가능한 드라이브가 없습니다.</div>
            ) : (
              drives.map((drive, index) => (
                <button
                  className={index === driveMenuIndex ? 'favorites-focused' : ''}
                  key={drive.letter}
                  type="button"
                  onClick={() => {
                    goToPath(`${drive.letter}:\\`)
                    setDriveMenuOpen(false)
                  }}
                >
                  {drive.letter}: {drive.free !== null && drive.total !== null ? `[${formatCapacity(drive.free)} / ${formatCapacity(drive.total)}]` : ''}
                </button>
              ))
            )}
            <button type="button" onClick={() => setDriveMenuOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {favoritesOpen ? (
        <div className="favorites-overlay">
          <div className="favorites-dialog" role="dialog" aria-modal="true" aria-label="Favorites">
            <div className="favorites-title">Favorites</div>
            {favorites.length === 0 ? <div className="favorites-empty">No favorites are configured.</div> : favorites.map((favorite, index) => (
              <button className={index === favoriteIndex ? 'favorites-focused' : ''} key={favorite.key} type="button" onClick={() => { goToPath(favorite.path); setFavoritesOpen(false) }}>
                <kbd>Ctrl+{favorite.key}</kbd> {favorite.label} — {favorite.path}
              </button>
            ))}
            <button type="button" onClick={() => setFavoritesOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {dialog ? (
        <div className="op-dialog-overlay">
          <div className="op-dialog" role="dialog" aria-modal="true">
            {dialog.kind === 'rename' || dialog.kind === 'newFolder' ? (
              <>
                <div className="op-dialog-title">{dialog.kind === 'rename' ? '이름 변경' : '새 폴더'}</div>
                <input
                  ref={dialogInputRef}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                />
                {dialogError ? <div className="op-dialog-error">{dialogError}</div> : null}
                <div className="op-dialog-buttons">
                  <button type="button" onClick={() => void (dialog.kind === 'rename' ? submitRename() : submitNewFolder())}>확인</button>
                  <button type="button" onClick={() => setDialog(null)}>취소</button>
                </div>
              </>
            ) : null}
            {dialog.kind === 'confirmDelete' ? (
              <>
                <div className="op-dialog-title">{dialog.permanent ? '영구 삭제' : '휴지통으로 삭제'}</div>
                <div className="op-dialog-body">{dialog.names.join(', ')}</div>
                <div className="op-dialog-buttons">
                  <button type="button" onClick={() => void runDelete(dialog.dir, dialog.names, dialog.permanent)}>삭제</button>
                  <button type="button" onClick={() => setDialog(null)}>취소</button>
                </div>
              </>
            ) : null}
            {dialog.kind === 'confirmTransfer' ? (
              <>
                <div className="op-dialog-title">{dialog.mode === 'copy' ? '복사' : '이동'}</div>
                <div className="op-dialog-body">
                  {dialog.names.join(', ')}
                  <br />→ {dialog.destDir}
                </div>
                <div className="op-dialog-buttons">
                  <button type="button" onClick={() => void runTransfer(dialog.mode, dialog.sourceDir, dialog.names, dialog.destDir)}>확인</button>
                  <button type="button" onClick={() => setDialog(null)}>취소</button>
                </div>
              </>
            ) : null}
            {dialog.kind === 'conflict' ? (
              <>
                <div className="op-dialog-title">이름 충돌</div>
                <div className="op-dialog-body">{dialog.name}</div>
                <ConflictButtons onDecide={replyConflict} />
              </>
            ) : null}
            {dialog.kind === 'progress' ? (
              <>
                <div className="op-dialog-title">{dialog.label}</div>
                <div className="op-dialog-body">{dialog.currentFile || '...'}</div>
                <div className="op-dialog-buttons">
                  <button type="button" onClick={cancelActiveOp}>취소</button>
                </div>
              </>
            ) : null}
            {dialog.kind === 'message' ? (
              <>
                <div className="op-dialog-body op-dialog-message">{dialog.text}</div>
                <div className="op-dialog-buttons">
                  <button type="button" onClick={() => setDialog(null)}>확인</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ConflictButtons({ onDecide }: { onDecide: (action: ConflictAction, applyToAll: boolean) => void }): ReactElement {
  const [applyToAll, setApplyToAll] = useState(false)
  return (
    <>
      <label className="op-dialog-checkbox">
        <input type="checkbox" checked={applyToAll} onChange={(event) => setApplyToAll(event.target.checked)} />
        모두 적용
      </label>
      <div className="op-dialog-buttons">
        <button type="button" onClick={() => onDecide('overwrite', applyToAll)}>덮어쓰기</button>
        <button type="button" onClick={() => onDecide('skip', applyToAll)}>건너뛰기</button>
        <button type="button" onClick={() => onDecide('rename', applyToAll)}>자동 이름 변경</button>
        <button type="button" onClick={() => onDecide('cancel', false)}>취소</button>
      </div>
    </>
  )
}
