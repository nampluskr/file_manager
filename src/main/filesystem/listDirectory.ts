// Pure directory listing. No electron import (SPEC.md §11.4).

import { readdir, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileEntry } from '../../shared/types'
import { toLongPathSafe } from './pathUtils'
import { withTimeout } from './timeoutUtils'

// A stalled OneDrive on-demand placeholder must not block the whole
// directory listing (SPEC.md §15). Entries that time out are still shown,
// with size/mtime left at the "unknown" sentinel of 0.
const STAT_TIMEOUT_MS = 500

function splitExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex <= 0) return '' // no extension, or a dotfile such as ".gitignore"
  return name.slice(dotIndex + 1)
}

export async function listDirectory(directoryPath: string): Promise<FileEntry[]> {
  const safePath = toLongPathSafe(directoryPath)
  const dirents = await readdir(safePath, { withFileTypes: true })

  return Promise.all(
    dirents.map(async (dirent): Promise<FileEntry> => {
      const entryPath = toLongPathSafe(join(safePath, dirent.name))
      const isDirectory = dirent.isDirectory()
      const isSymlink = dirent.isSymbolicLink()
      const stats = await withTimeout(lstat(entryPath), STAT_TIMEOUT_MS, () => null)

      return {
        name: dirent.name,
        ext: isDirectory ? '' : splitExtension(dirent.name),
        size: stats && !isDirectory ? stats.size : 0,
        mtime: stats ? stats.mtimeMs : 0,
        isDirectory,
        isSymlink,
        isParent: false
      }
    })
  )
}
