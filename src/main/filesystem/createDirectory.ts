// Pure new-folder creation (SPEC.md §6.7). No electron import (SPEC.md §11.4).

import { lstat, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { toLongPathSafe } from './pathUtils'
import { isValidFileName } from './renameItem'
import { toUserMessage } from './errorMessages'

export type CreateDirectoryResult = { ok: true } | { ok: false; code: string; message: string }

export async function createDirectory(dir: string, name: string): Promise<CreateDirectoryResult> {
  if (!isValidFileName(name)) {
    return { ok: false, code: 'EINVAL', message: '사용할 수 없는 이름입니다' }
  }

  const targetPath = toLongPathSafe(join(dir, name))
  try {
    await lstat(targetPath)
    return { ok: false, code: 'EEXIST', message: '같은 이름이 이미 있습니다' }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { ok: false, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) }
    }
  }

  try {
    await mkdir(targetPath)
    return { ok: true }
  } catch (error) {
    return { ok: false, code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN', message: toUserMessage(error) }
  }
}
