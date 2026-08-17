import { memo } from 'react'
import type { ReactElement } from 'react'

// Fixed yellow classic folder glyph, independent of OS shell icon theme and
// row text color -- some Windows environments return a flat outline icon
// from app.getFileIcon() for directories, so a bundled icon guarantees the
// requested look regardless of shell/theme.
function FolderIcon(): ReactElement {
  return (
    <svg width={20} height={20} viewBox="0 0 16 13" aria-hidden="true">
      <path
        d="M0.5 1.4a1 1 0 0 1 1-1h3.7l1.3 1.6h7.6a1 1 0 0 1 1 1v1H0.5V1.4z"
        fill="#e8a63c"
      />
      <path
        d="M0.1 3.6a.9.9 0 0 1 .9-.8h14a.9.9 0 0 1 .89 1.03l-1 7a1.1 1.1 0 0 1-1.09.97H1.3a1.1 1.1 0 0 1-1.09-.97l-1-7a.9.9 0 0 1-.01-.23z"
        fill="#ffcb63"
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
        {isDirectory ? <FolderIcon /> : iconUrl ? <img src={iconUrl} width={20} height={20} alt="" /> : null}
      </span>
      <span className="file-row-cell file-row-name">{name}</span>
      <span className="file-row-cell file-row-ext">{ext}</span>
      <span className="file-row-cell file-row-size">{sizeLabel}</span>
      <span className="file-row-cell file-row-date">{dateLabel}</span>
    </div>
  )
}

export const FileRow = memo(FileRowComponent)
