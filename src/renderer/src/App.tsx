import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { PaneState, Settings } from '../../shared/types'
import { FilePane } from './components/FilePane/FilePane'
import { Viewer } from './components/Viewer/Viewer'
import { Editor } from './components/Editor/Editor'

export function App(): ReactElement {
  const [viewerPath, setViewerPath] = useState<string | null>(null)
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    void window.fileManager.loadSettings().then(setSettings)
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

  const handlePaneStateChange = useCallback((pane: PaneState) => {
    setSettings((current) => {
      if (!current) return current
      const left = current.panes.left
      if (left.path === pane.currentPath && left.sortKey === pane.sortKey && left.sortAsc === pane.sortAsc) return current
      return { ...current, panes: { ...current.panes, left: { path: pane.currentPath, sortKey: pane.sortKey, sortAsc: pane.sortAsc } } }
    })
  }, [])

  if (!settings) return <div className="app-loading">Loading settings...</div>

  return (
    <>
      <FilePane
        initialPath={settings.panes.left.path}
        initialSortKey={settings.panes.left.sortKey}
        initialSortAsc={settings.panes.left.sortAsc}
        overlayOpen={viewerPath !== null || editorPath !== null}
        onView={setViewerPath}
        onEdit={setEditorPath}
        onStateChange={handlePaneStateChange}
        favorites={settings.favorites}
      />
      {viewerPath ? <Viewer path={viewerPath} onClose={() => setViewerPath(null)} /> : null}
      {editorPath ? <Editor path={editorPath} onClose={() => setEditorPath(null)} /> : null}
    </>
  )
}
