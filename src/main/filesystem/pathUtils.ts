// Pure path helpers. No electron import here (SPEC.md §11.4) so this module
// stays reachable by Vitest without an Electron runtime.

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
