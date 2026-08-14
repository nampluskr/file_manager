// Pure rename (SPEC.md §6.4). No electron import (SPEC.md §11.4).

import { lstat, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { toComparableKey, toLongPathSafe } from './pathUtils'
import { toUserMessage } from './errorMessages'

const FORBIDDEN_NAME_PATTERN = /[\\/:*?"<>|]/

export function isValidFileName(name: string): boolean {
  if (name.length === 0) return false
  if (name === '.' || name === '..') return false
  return !FORBIDDEN_NAME_PATTERN.test(name)
}

export type RenameResult = { ok: true } | { ok: false; code: string; message: string }

export async function renameItem(dir: string, from: string, to: string): Promise<RenameResult> {
  if (!isValidFileName(to)) {
    return { ok: false, code: 'EINVAL', message: '사용할 수 없는 이름입니다' }
  }
  if (from === to) return { ok: true }

  const fromPath = toLongPathSafe(join(dir, from))
  const toPath = toLongPathSafe(join(dir, to))

  // A case-only rename ("Foo" -> "foo") targets the same file on Windows;
  // lstat(toPath) would otherwise resolve to `from` itself and be misreported
  // as an EEXIST conflict.
  if (toComparableKey(from) !== toComparableKey(to)) {
    try {
      await lstat(toPath)
      return { ok: false, code: 'EEXIST', message: '같은 이름이 이미 있습니다' }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return { ok: false, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) }
      }
    }
  }

  try {
    await rename(fromPath, toPath)
    return { ok: true }
  } catch (error) {
    return { ok: false, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) }
  }
}
