import { describe, expect, it } from 'vitest'
import { computeVisibleRange } from './windowing'

describe('computeVisibleRange', () => {
  it('returns an empty range for zero entries', () => {
    expect(computeVisibleRange(0, 22, 0, 400, 4)).toEqual({ startIndex: 0, endIndex: 0, totalHeight: 0 })
  })

  it('returns an empty range when the container has no height yet', () => {
    expect(computeVisibleRange(5000, 22, 0, 0, 4)).toEqual({ startIndex: 0, endIndex: 0, totalHeight: 5000 * 22 })
  })

  it('includes overscan above and below the visible window', () => {
    const range = computeVisibleRange(5000, 22, 2200, 220, 4)
    // scrollTop / rowHeight = 100, minus 4 overscan = 96
    expect(range.startIndex).toBe(96)
    // 220 / 22 = 10 visible rows, plus 4 overscan on each side = 18
    expect(range.endIndex).toBe(96 + 18)
  })

  it('does not let startIndex go negative near the top', () => {
    const range = computeVisibleRange(5000, 22, 0, 220, 4)
    expect(range.startIndex).toBe(0)
  })

  it('clamps endIndex to entryCount at the bottom of the list', () => {
    const range = computeVisibleRange(10, 22, 200 * 22, 220, 4)
    expect(range.endIndex).toBeLessThanOrEqual(10)
    expect(range.startIndex).toBeLessThanOrEqual(range.endIndex)
  })
})
