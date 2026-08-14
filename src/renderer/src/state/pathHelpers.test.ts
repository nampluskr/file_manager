import { describe, expect, it } from 'vitest'
import { getParentPath, joinPath, lastSegment } from './pathHelpers'

describe('getParentPath', () => {
  it('returns null at a drive root', () => {
    expect(getParentPath('C:\\')).toBeNull()
  })

  it('returns the drive root for a top-level folder', () => {
    expect(getParentPath('C:\\Users')).toBe('C:\\')
  })

  it('returns the parent for a nested path', () => {
    expect(getParentPath('C:\\Users\\nampl\\Documents')).toBe('C:\\Users\\nampl')
  })

  it('tolerates a trailing backslash', () => {
    expect(getParentPath('C:\\Users\\nampl\\')).toBe('C:\\Users')
  })
})

describe('joinPath', () => {
  it('joins a base path and a name with a single backslash', () => {
    expect(joinPath('C:\\Users', 'nampl')).toBe('C:\\Users\\nampl')
  })

  it('does not double the backslash when the base already ends with one', () => {
    expect(joinPath('C:\\', 'Users')).toBe('C:\\Users')
  })
})

describe('lastSegment', () => {
  it('returns the final path component', () => {
    expect(lastSegment('C:\\Users\\nampl\\Documents')).toBe('Documents')
  })

  it('returns the drive letter for a root path', () => {
    expect(lastSegment('C:\\')).toBe('C:')
  })
})
