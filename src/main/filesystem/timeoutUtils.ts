// Pure timeout helper. No electron import (SPEC.md §11.4).
// Used to bound per-entry lstat calls so a slow OneDrive on-demand path
// cannot block the whole directory listing (SPEC.md §15).

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(onTimeout())
    }, timeoutMs)

    promise
      .then((value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(onTimeout())
      })
  })
}
