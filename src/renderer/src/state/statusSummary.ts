// Pure StatusBar aggregation (SPEC.md §3.5). No file-system access: uses
// only the metadata already fetched by listDirectory.

import type { FileEntry } from '../../../shared/types'

export type StatusSummary = {
  selectedSize: number
  totalSize: number
  selectedFileCount: number
  totalFileCount: number
  selectedFolderCount: number
  totalFolderCount: number
}

export function computeStatusSummary(entries: FileEntry[], selectedNames: Set<string>): StatusSummary {
  const summary: StatusSummary = {
    selectedSize: 0,
    totalSize: 0,
    selectedFileCount: 0,
    totalFileCount: 0,
    selectedFolderCount: 0,
    totalFolderCount: 0
  }

  for (const entry of entries) {
    if (entry.isParent) continue
    const isSelected = selectedNames.has(entry.name.toLowerCase())

    if (entry.isDirectory) {
      summary.totalFolderCount += 1
      if (isSelected) summary.selectedFolderCount += 1
      continue // folder sizes are not aggregated (SPEC.md §3.5)
    }

    summary.totalFileCount += 1
    summary.totalSize += entry.size
    if (isSelected) {
      summary.selectedFileCount += 1
      summary.selectedSize += entry.size
    }
  }

  return summary
}
