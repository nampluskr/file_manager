import { memo } from 'react'
import type { ReactElement } from 'react'

// mdviewer's explorer entry glyph (App.tsx EntryIcon, directory branch):
// a flat folder outline drawn with `stroke="currentColor"` so it always
// matches the row's text color (dim by default, bright when
// selected/focused) instead of needing its own theme tokens.
function FolderIcon(): ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.5 4.2a1 1 0 0 1 1-1h3.1l1.1 1.3h6.8a1 1 0 0 1 1 1v6.3a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Primitive props only, wrapped in React.memo: focus moving between two rows
// must re-render exactly those two rows (SPEC.md §10.2). `index` is a
// primitive too -- FileList reads it back off `data-index` via event
// delegation on the container instead of passing a new closure per row,
// which would defeat the memoization this component exists for.
type FileRowProps = {
  index: number
  top: number
  name: string
  ext: string
  sizeLabel: string
  dateLabel: string
  isDirectory: boolean
  isFocused: boolean
  isSelected: boolean
  iconUrl: string | null
}

function FileRowComponent({ index, top, name, ext, sizeLabel, dateLabel, isDirectory, isFocused, isSelected, iconUrl }: FileRowProps): ReactElement {
  const className = [
    'file-row',
    isDirectory ? 'file-row-directory' : '',
    isFocused ? 'file-row-focused' : '',
    isSelected ? 'file-row-selected' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={{ top }} data-index={index}>
      <span className="file-row-cell file-row-icon">
        {isDirectory ? <FolderIcon /> : iconUrl ? <img src={iconUrl} width={16} height={16} alt="" /> : null}
      </span>
      <span className="file-row-cell file-row-name">{name}</span>
      <span className="file-row-cell file-row-ext">{ext}</span>
      <span className="file-row-cell file-row-size">{sizeLabel}</span>
      <span className="file-row-cell file-row-date">{dateLabel}</span>
    </div>
  )
}

export const FileRow = memo(FileRowComponent)
