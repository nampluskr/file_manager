import { describe, expect, it } from 'vitest'
import { isWithinRoot, toComparableKey, toLongPathSafe } from './pathUtils'

describe('isWithinRoot', () => {
  it('accepts the root itself', () => {
    expect(isWithinRoot('C:\\root', 'C:\\root')).toBe(true)
  })

  it('accepts a nested path', () => {
    expect(isWithinRoot('C:\\root', 'C:\\root\\sub\\file.txt')).toBe(true)
  })

  it('rejects a path outside the root', () => {
    expect(isWithinRoot('C:\\root', 'C:\\other\\file.txt')).toBe(false)
  })

  it('rejects a sibling directory with a matching name prefix', () => {
    expect(isWithinRoot('C:\\root', 'C:\\root-sibling\\file.txt')).toBe(false)
  })
})

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
