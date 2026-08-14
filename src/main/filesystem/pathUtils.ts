// Pure path helpers. No electron import here (SPEC.md §11.4) so this module
// stays reachable by Vitest without an Electron runtime.

import { realpath } from 'node:fs/promises'

const LONG_PATH_PREFIX = '\\\\?\\'
const LONG_PATH_THRESHOLD = 260

// Windows case-insensitive comparison key for selection state and path
// comparisons (SPEC.md §12.2).
export function toComparableKey(name: string): string {
  return name.toLowerCase()
}

// Prefixes absolute paths longer than the MAX_PATH threshold so Node's fs
// APIs can address them on Windows (SPEC.md §12.1). UNC paths need the
// "\\?\UNC\" form -- naively prepending "\\?\" to "\\server\share\..."
// produces an invalid "\\?\\\server\share\..." path.
export function toLongPathSafe(absolutePath: string): string {
  if (absolutePath.length < LONG_PATH_THRESHOLD || absolutePath.startsWith(LONG_PATH_PREFIX)) {
    return absolutePath
  }
  if (absolutePath.startsWith('\\\\')) {
    return `\\\\?\\UNC\\${absolutePath.slice(2)}`
  }
  return LONG_PATH_PREFIX + absolutePath
}

// True when `child` is `parent` itself or nested inside it, compared
// case-insensitively (SPEC.md §12.2). Used to reject copy/move operations
// that would recurse into their own source (SPEC.md §6 adversarialFocus).
export function isSubPath(parent: string, child: string): boolean {
  const parentKey = toComparableKey(parent).replace(/[\\/]+$/, '')
  const childKey = toComparableKey(child).replace(/[\\/]+$/, '')
  return childKey === parentKey || childKey.startsWith(`${parentKey}\\`)
}

// isSubPath() above is a string-only comparison, so a junction/reparse point
// that *aliases* a path inside the source (e.g. "C:\alias" -> "C:\source\x")
// slips past it undetected, letting copy/move recurse into itself through
// the alias. This resolves both sides through the file system first, so an
// existing destination directory whose real target lives inside the source
// tree is caught even when the string paths look unrelated. Only meaningful
// when `child` already exists (a not-yet-created plain directory cannot be a
// junction).
export async function isSubPathReal(parent: string, child: string): Promise<boolean> {
  try {
    const [parentReal, childReal] = await Promise.all([
      realpath(toLongPathSafe(parent)),
      realpath(toLongPathSafe(child))
    ])
    return isSubPath(parentReal, childReal)
  } catch {
    return false
  }
}
