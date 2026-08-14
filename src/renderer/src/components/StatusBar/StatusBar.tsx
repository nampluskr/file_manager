import type { ReactElement } from 'react'
import type { FileEntry } from '../../../../shared/types'
import { computeStatusSummary } from '../../state/statusSummary'
import { formatSize } from '../../state/format'

type StatusBarProps = {
  entries: FileEntry[]
  selectedNames: Set<string>
}

export function StatusBar({ entries, selectedNames }: StatusBarProps): ReactElement {
  const summary = computeStatusSummary(entries, selectedNames)
  return (
    <div className="status-bar">
      <span>
        용량: {formatSize(summary.selectedSize, false)} / {formatSize(summary.totalSize, false)}
      </span>
      <span>
        파일: {summary.selectedFileCount} / {summary.totalFileCount}
      </span>
      <span>
        폴더: {summary.selectedFolderCount} / {summary.totalFolderCount}
      </span>
    </div>
  )
}
