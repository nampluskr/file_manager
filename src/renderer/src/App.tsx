import type { ReactElement } from 'react'
import { FilePane } from './components/FilePane/FilePane'

export function App(): ReactElement {
  return <FilePane initialPath={window.fileManager.homePath} />
}
