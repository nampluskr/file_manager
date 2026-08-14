import { describe, expect, it } from 'vitest'
import { nextConflictFreeName } from './nameConflict'

describe('nextConflictFreeName', () => {
  it('appends an incrementing counter before the extension', async () => {
    const taken = new Set(['file (2).txt'])
    const name = await nextConflictFreeName('file.txt', async (candidate) => taken.has(candidate))
    expect(name).toBe('file (3).txt')
  })

  it('works for extension-less names', async () => {
    const name = await nextConflictFreeName('README', async () => false)
    expect(name).toBe('README (2)')
  })

  it('throws instead of looping forever when every candidate is taken', async () => {
    await expect(nextConflictFreeName('file.txt', async () => true)).rejects.toThrow()
  })
})
