import { describe, expect, it } from 'vitest'
import { formatCapacity, formatDate, formatSize, truncateMiddle } from './format'

describe('formatSize', () => {
  it('shows <DIR> for directories regardless of size', () => {
    expect(formatSize(0, true)).toBe('<DIR>')
    expect(formatSize(4096, true)).toBe('<DIR>')
  })

  it('shows raw bytes without a decimal below 1024', () => {
    expect(formatSize(512, false)).toBe('512B')
  })

  it('formats kilobytes and megabytes with one decimal', () => {
    expect(formatSize(1843, false)).toBe('1.8K')
    expect(formatSize(1024 * 1024 * 2.5, false)).toBe('2.5M')
  })

  it('caps at gigabytes', () => {
    expect(formatSize(1024 ** 4, false)).toBe('1024.0G')
  })
})

describe('formatCapacity', () => {
  it('inserts a space before the unit, unlike formatSize', () => {
    expect(formatCapacity(1024 ** 3 * 109.3)).toBe('109.3 G')
  })

  it('handles sub-kilobyte values', () => {
    expect(formatCapacity(512)).toBe('512 B')
  })
})

describe('formatDate', () => {
  it('renders the unknown sentinel (mtime <= 0) as a dash', () => {
    expect(formatDate(0)).toBe('-')
    expect(formatDate(-1)).toBe('-')
  })

  it('formats an epoch timestamp as YYYY-MM-DD HH:mm', () => {
    const date = new Date(2026, 0, 5, 9, 3)
    expect(formatDate(date.getTime())).toBe('2026-01-05 09:03')
  })
})

describe('truncateMiddle', () => {
  it('returns the value unchanged when it already fits', () => {
    expect(truncateMiddle('C:\\short', 20)).toBe('C:\\short')
  })

  it('truncates the middle and keeps both ends', () => {
    const path = 'C:\\projects\\tools\\file_manager\\src\\main\\index.ts'
    const result = truncateMiddle(path, 20)
    expect(result).toHaveLength(20)
    expect(result.startsWith('C:\\proj')).toBe(true)
    expect(result.endsWith('index.ts')).toBe(true)
    expect(result).toContain('...')
  })

  it('never returns more characters than requested, even for tiny widths', () => {
    expect(truncateMiddle('C:\\projects\\tools', 2)).toBe('C:')
    expect(truncateMiddle('C:\\projects\\tools', 0)).toBe('C:\\projects\\tools')
  })
})
