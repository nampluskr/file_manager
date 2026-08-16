import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { PaneState, Settings } from '../../shared/types'
import { FilePane } from './components/FilePane/FilePane'
import { Viewer } from './components/Viewer/Viewer'
import { Editor } from './components/Editor/Editor'
import { FunctionKeyBar } from './components/FunctionKeyBar/FunctionKeyBar'

export function App(): ReactElement {
  const [viewerPath, setViewerPath] = useState<string | null>(null)
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [paneSnapshots, setPaneSnapshots] = useState<Partial<Record<'left' | 'right', PaneState>>>({})
  const [paneInstance, setPaneInstance] = useState({ left: 0, right: 0 })
  const [refreshToken, setRefreshToken] = useState(0)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    void window.fileManager.loadSettings().then(setSettings)
  }, [])

  // Ctrl+Shift+D theme toggle is a "전역" shortcut (SPEC.md §16.6/§16.7): it
  // must fire even while an overlay or dialog has focus, including a dialog
  // input that stops propagation on its own keydown to keep the pane's
  // Escape/Enter handling from double-firing. A capture-phase listener runs
  // before any of that, so it is unaffected by a later stopPropagation call.
  useEffect(() => {
    const handleThemeToggle = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return
      event.preventDefault()
      setSettings((current) => (current ? { ...current, theme: current.theme === 'dark' ? 'light' : 'dark' } : current))
    }
    window.addEventListener('keydown', handleThemeToggle, true)
    return () => window.removeEventListener('keydown', handleThemeToggle, true)
  }, [])

  useEffect(() => {
    if (!settings) return
    document.documentElement.dataset.theme = settings.theme
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void window.fileManager.saveSettings(settings)
    }, 300)
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    }
  }, [settings])

  const handlePaneStateChange = useCallback((side: 'left' | 'right', pane: PaneState) => {
    setPaneSnapshots((current) => ({ ...current, [side]: pane }))
    setSettings((current) => {
      if (!current) return current
      const savedPane = current.panes[side]
      if (savedPane.path === pane.currentPath && savedPane.sortKey === pane.sortKey && savedPane.sortAsc === pane.sortAsc) return current
      return {
        ...current,
        panes: { ...current.panes, [side]: { path: pane.currentPath, sortKey: pane.sortKey, sortAsc: pane.sortAsc } }
      }
    })
  }, [])

  const handleLeftPaneStateChange = useCallback((pane: PaneState) => handlePaneStateChange('left', pane), [handlePaneStateChange])
  const handleRightPaneStateChange = useCallback((pane: PaneState) => handlePaneStateChange('right', pane), [handlePaneStateChange])

  const activatePane = useCallback((side: 'left' | 'right') => {
    setSettings((current) => current && current.activePane === side ? current : current && { ...current, activePane: side })
  }, [])

  const switchPane = useCallback(() => {
    setSettings((current) => current && { ...current, activePane: current.activePane === 'left' ? 'right' : 'left' })
  }, [])

  const handleOperationComplete = useCallback(() => {
    setRefreshToken((token) => token + 1)
  }, [])

  const swapPanes = useCallback(() => {
    setPaneSnapshots((current) => ({ left: current.right, right: current.left }))
    setPaneInstance((current) => ({ left: current.left + 1, right: current.right + 1 }))
    setSettings((current) => current && {
      ...current,
      panes: { left: current.panes.right, right: current.panes.left }
    })
  }, [])

  if (!settings) return <div className="app-loading">Loading settings...</div>

  return (
    <div className="app-shell">
      <div className="file-pane-layout">
        {(['left', 'right'] as const).map((side) => {
          const pane = settings.panes[side]
          const otherSide = side === 'left' ? 'right' : 'left'
          return <FilePane
            key={`${side}-${paneInstance[side]}`}
            side={side}
            initialPath={pane.path}
            initialSortKey={pane.sortKey}
            initialSortAsc={pane.sortAsc}
            initialState={paneSnapshots[side]}
            isActive={settings.activePane === side}
            overlayOpen={viewerPath !== null || editorPath !== null}
            otherPanePath={paneSnapshots[otherSide]?.currentPath ?? settings.panes[otherSide].path}
            refreshToken={refreshToken}
            onView={setViewerPath}
            onEdit={setEditorPath}
            onStateChange={side === 'left' ? handleLeftPaneStateChange : handleRightPaneStateChange}
            onActivate={() => activatePane(side)}
            onSwitchPane={switchPane}
            onSwapPanes={swapPanes}
            onOperationComplete={handleOperationComplete}
            favorites={settings.favorites}
          />
        })}
      </div>
      <FunctionKeyBar />
      {viewerPath ? <Viewer path={viewerPath} onClose={() => setViewerPath(null)} /> : null}
      {editorPath ? <Editor path={editorPath} onClose={() => setEditorPath(null)} /> : null}
    </div>
  )
}
