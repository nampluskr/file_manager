// Pure display formatters (SPEC.md §3.3, §3.4).

const SIZE_UNITS = ['B', 'K', 'M', 'G']

export function formatSize(sizeBytes: number, isDirectory: boolean): string {
  if (isDirectory) return '<DIR>'

  let value = sizeBytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }

  const formatted = unitIndex === 0 ? String(value) : value.toFixed(1)
  return `${formatted}${SIZE_UNITS[unitIndex]}`
}

// Drive capacity display (SPEC.md §3.2): "109.3 G", with a space before the
// unit -- unlike the FileList size column, which has none.
export function formatCapacity(bytes: number): string {
  const sizeLabel = formatSize(bytes, false)
  const unit = sizeLabel.slice(-1)
  const value = sizeLabel.slice(0, -1)
  return `${value} ${unit}`
}

// mtime === 0 is the "unknown" sentinel used when listDirectory could not
// stat an entry in time (SPEC.md §15, OneDrive on-demand placeholders).
export function formatDate(epochMs: number): string {
  if (epochMs <= 0) return '-'
  const date = new Date(epochMs)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Truncates the middle of a string, keeping both ends visible (SPEC.md §3.3).
export function truncateMiddle(value: string, maxChars: number): string {
  if (maxChars <= 0 || value.length <= maxChars) return value

  const ellipsis = '...'
  if (maxChars <= ellipsis.length) return value.slice(0, maxChars)

  const remaining = maxChars - ellipsis.length
  const headLength = Math.ceil(remaining / 2)
  const tailLength = Math.floor(remaining / 2)
  return `${value.slice(0, headLength)}${ellipsis}${tailLength > 0 ? value.slice(value.length - tailLength) : ''}`
}
