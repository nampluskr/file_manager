// Auto-rename helper for name conflicts (SPEC.md §6.6). No electron import (SPEC.md §11.4).

const MAX_ATTEMPTS = 1000

// Produces "name (2).ext", "name (3).ext", ... Works for extension-less names too.
// Bounded so a pathological "already have (2)..(999)" directory cannot hang the app.
export async function nextConflictFreeName(
  name: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const dotIndex = name.lastIndexOf('.')
  const hasExtension = dotIndex > 0
  const base = hasExtension ? name.slice(0, dotIndex) : name
  const extension = hasExtension ? name.slice(dotIndex) : ''

  for (let counter = 2; counter < MAX_ATTEMPTS; counter++) {
    const candidate = `${base} (${counter})${extension}`
    if (!(await exists(candidate))) return candidate
  }
  throw new Error('이름을 자동으로 생성할 수 없습니다')
}
