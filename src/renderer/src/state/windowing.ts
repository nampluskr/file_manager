// Pure row-windowing math (SPEC.md §10.1). FileList renders only
// [startIndex, endIndex) plus overscan, sliced from a fixed row height.

export type VisibleRange = { startIndex: number; endIndex: number; totalHeight: number }

export function computeVisibleRange(
  entryCount: number,
  rowHeight: number,
  scrollTop: number,
  containerHeight: number,
  overscan: number
): VisibleRange {
  const totalHeight = entryCount * rowHeight

  if (entryCount === 0 || containerHeight <= 0) {
    return { startIndex: 0, endIndex: 0, totalHeight }
  }

  const visibleCount = Math.ceil(containerHeight / rowHeight)
  const rawStartIndex = Math.floor(scrollTop / rowHeight) - overscan
  const startIndex = Math.min(entryCount, Math.max(0, rawStartIndex))
  const endIndex = Math.min(entryCount, startIndex + visibleCount + overscan * 2)

  return { startIndex, endIndex, totalHeight }
}
