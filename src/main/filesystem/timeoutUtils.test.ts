import { describe, expect, it } from 'vitest'
import { withTimeout } from './timeoutUtils'

describe('withTimeout', () => {
  it('resolves with the promise value when it settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('fast'), 50, () => 'fallback')
    expect(result).toBe('fast')
  })

  it('falls back when the promise never settles within the timeout', async () => {
    const neverSettles = new Promise<string>(() => {})
    const result = await withTimeout(neverSettles, 20, () => 'fallback')
    expect(result).toBe('fallback')
  })

  it('falls back when the promise rejects', async () => {
    const result = await withTimeout(Promise.reject(new Error('boom')), 50, () => 'fallback')
    expect(result).toBe('fallback')
  })
})
