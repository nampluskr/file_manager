import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { FileEntry } from '../../../../shared/types'
import { formatDate, formatSize } from '../../state/format'
import { computeVisibleRange } from '../../state/windowing'
import { FileRow } from '../FileRow/FileRow'

export const ROW_HEIGHT = 22
const OVERSCAN = 4

type FileListProps = {
  entries: FileEntry[]
  focusedIndex: number
  scrollTop: number
  onScrollTopChange: (value: number) => void
  onVisibleRowCountChange: (count: number) => void
}

export function FileList({
  entries,
  focusedIndex,
  scrollTop,
  onScrollTopChange,
  onVisibleRowCountChange
}: FileListProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((observerEntries) => {
      const height = observerEntries[0]?.contentRect.height ?? 0
      setContainerHeight(height)
      onVisibleRowCountChange(Math.max(1, Math.floor(height / ROW_HEIGHT)))
    })
    observer.observe(element)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the focused row within the visible window (SPEC.md §9.2).
  useEffect(() => {
    if (containerHeight === 0) return
    const focusTop = focusedIndex * ROW_HEIGHT
    const focusBottom = focusTop + ROW_HEIGHT
    if (focusTop < scrollTop) {
      onScrollTopChange(focusTop)
    } else if (focusBottom > scrollTop + containerHeight) {
      onScrollTopChange(focusBottom - containerHeight)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, containerHeight])

  // Sync the real scrollable element with the controlled scrollTop value.
  useEffect(() => {
    const element = containerRef.current
    if (element && element.scrollTop !== scrollTop) element.scrollTop = scrollTop
  }, [scrollTop])

  const { startIndex, endIndex, totalHeight } = computeVisibleRange(
    entries.length,
    ROW_HEIGHT,
    scrollTop,
    containerHeight,
    OVERSCAN
  )
  const visibleEntries = entries.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      className="file-list"
      onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
    >
      <div className="file-list-spacer" style={{ height: totalHeight }}>
        {visibleEntries.map((entry, offset) => {
          const index = startIndex + offset
          return (
            <FileRow
              key={entry.name}
              top={index * ROW_HEIGHT}
              name={entry.isParent ? '[..]' : entry.name}
              ext={entry.ext}
              sizeLabel={formatSize(entry.size, entry.isDirectory)}
              dateLabel={formatDate(entry.mtime)}
              isDirectory={entry.isDirectory}
              isFocused={index === focusedIndex}
            />
          )
        })}
      </div>
    </div>
  )
}
