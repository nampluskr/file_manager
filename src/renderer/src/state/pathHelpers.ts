// Pure Windows path helpers for the renderer. No node:path import: the
// renderer runs without Node integration (SPEC.md §11.1/§12.4), so path
// manipulation here is done with plain string/regex logic instead.

// Returns the parent path, or null if `path` is already a drive root
// (e.g. "C:\"), matching the "ignore Backspace at the root" rule (SPEC.md §4.3).
export function getParentPath(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, '')
  const separatorIndex = trimmed.lastIndexOf('\\')
  if (separatorIndex < 0) return null
  if (separatorIndex <= 2) return `${trimmed.slice(0, 2)}\\` // "C:\Users" -> "C:\"
  return trimmed.slice(0, separatorIndex)
}

export function joinPath(basePath: string, name: string): string {
  return `${basePath.replace(/[\\/]+$/, '')}\\${name}`
}

export function lastSegment(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const separatorIndex = trimmed.lastIndexOf('\\')
  return separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed
}
