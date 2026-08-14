import { memo } from 'react'
import type { ReactElement } from 'react'

// Primitive props only, wrapped in React.memo: focus moving between two rows
// must re-render exactly those two rows (SPEC.md §10.2).
type FileRowProps = {
  top: number
  name: string
  ext: string
  sizeLabel: string
  dateLabel: string
  isDirectory: boolean
  isFocused: boolean
  isSelected: boolean
}

function FileRowComponent({ top, name, ext, sizeLabel, dateLabel, isDirectory, isFocused, isSelected }: FileRowProps): ReactElement {
  const className = [
    'file-row',
    isDirectory ? 'file-row-directory' : '',
    isFocused ? 'file-row-focused' : '',
    isSelected ? 'file-row-selected' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={{ top }}>
      <span className="file-row-cell file-row-name">{name}</span>
      <span className="file-row-cell file-row-ext">{ext}</span>
      <span className="file-row-cell file-row-size">{sizeLabel}</span>
      <span className="file-row-cell file-row-date">{dateLabel}</span>
    </div>
  )
}

export const FileRow = memo(FileRowComponent)
