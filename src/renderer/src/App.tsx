import { useState } from 'react'
import type { ReactElement } from 'react'
import { FilePane } from './components/FilePane/FilePane'
import { Viewer } from './components/Viewer/Viewer'
import { Editor } from './components/Editor/Editor'

export function App(): ReactElement {
  const [viewerPath, setViewerPath] = useState<string | null>(null)
  const [editorPath, setEditorPath] = useState<string | null>(null)
  return (
    <>
      <FilePane
        initialPath={window.fileManager.homePath}
        overlayOpen={viewerPath !== null || editorPath !== null}
        onView={setViewerPath}
        onEdit={setEditorPath}
      />
      {viewerPath ? <Viewer path={viewerPath} onClose={() => setViewerPath(null)} /> : null}
      {editorPath ? <Editor path={editorPath} onClose={() => setEditorPath(null)} /> : null}
    </>
  )
}
