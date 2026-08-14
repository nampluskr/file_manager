// Maps Node.js filesystem error codes to user-facing Korean text (SPEC.md §6.9).
// Pure module: no electron import (SPEC.md §11.4).

const CODE_MESSAGES: Record<string, string> = {
  EPERM: '권한이 없어 작업할 수 없습니다',
  EACCES: '접근이 거부되었습니다',
  EBUSY: '다른 프로그램이 파일을 사용 중입니다',
  ENOENT: '파일 또는 경로를 찾을 수 없습니다',
  EXDEV: '다른 드라이브로의 이동입니다',
  ENOSPC: '디스크 공간이 부족합니다',
  ENOTEMPTY: '폴더가 비어 있지 않습니다'
}

export function toUserMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code in CODE_MESSAGES) return CODE_MESSAGES[code]
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}
