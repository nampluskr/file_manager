import { useState } from 'react'
import type { ReactElement } from 'react'
import { FilePane } from './components/FilePane/FilePane'
import { Viewer } from './components/Viewer/Viewer'

export function App(): ReactElement {
  const [viewerPath, setViewerPath] = useState<string | null>(null)
  return (
    <>
      <FilePane initialPath={window.fileManager.homePath} overlayOpen={viewerPath !== null} onView={setViewerPath} />
      {viewerPath ? <Viewer path={viewerPath} onClose={() => setViewerPath(null)} /> : null}
    </>
  )
}
