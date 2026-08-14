import { describe, expect, it } from 'vitest'
import { toUserMessage } from './errorMessages'

describe('toUserMessage', () => {
  it('maps a known Node error code to Korean text', () => {
    expect(toUserMessage({ code: 'ENOENT', message: 'raw' })).toBe('파일 또는 경로를 찾을 수 없습니다')
    expect(toUserMessage({ code: 'EACCES', message: 'raw' })).toBe('접근이 거부되었습니다')
  })

  it('falls back to the original message for an unknown code', () => {
    expect(toUserMessage({ code: 'EWEIRD', message: 'raw message' })).toBe('raw message')
  })

  it('falls back to the Error message when there is no code', () => {
    expect(toUserMessage(new Error('plain error'))).toBe('plain error')
  })

  it('stringifies non-Error, non-coded values', () => {
    expect(toUserMessage('just a string')).toBe('just a string')
  })
})
