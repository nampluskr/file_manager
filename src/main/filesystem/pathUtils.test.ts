import { describe, expect, it } from 'vitest'
import { toComparableKey, toLongPathSafe } from './pathUtils'

describe('toComparableKey', () => {
  it('lower-cases the input', () => {
    expect(toComparableKey('README.MD')).toBe('readme.md')
  })
})

describe('toLongPathSafe', () => {
  it('leaves short paths unchanged', () => {
    expect(toLongPathSafe('C:\\root\\file.txt')).toBe('C:\\root\\file.txt')
  })

  it('prefixes paths at or beyond the MAX_PATH threshold', () => {
    const longPath = 'C:\\' + 'a'.repeat(260)
    expect(toLongPathSafe(longPath)).toBe('\\\\?\\' + longPath)
  })

  it('does not double-prefix an already-prefixed path', () => {
    const prefixed = '\\\\?\\C:\\' + 'a'.repeat(260)
    expect(toLongPathSafe(prefixed)).toBe(prefixed)
  })
})
