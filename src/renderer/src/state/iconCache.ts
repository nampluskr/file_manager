// Renderer-side icon cache (SPEC.md §10.5: one sys:fileIcon call per
// extension, ever, no matter how many rows or renders reference it). The
// key is the lowercased extension so ".PNG" and ".png" share a slot; empty
// string is the no-extension key.
const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<void>>()

export function getCachedIcon(ext: string): string | null {
  return cache.get(ext.toLowerCase()) ?? null
}

// Fires `onLoaded` once the icon resolves (or fails) so the caller can
// trigger a re-render. A no-op if the extension is already cached or a
// request for it is already in flight.
export function ensureIconLoaded(ext: string, onLoaded: () => void): void {
  const key = ext.toLowerCase()
  if (cache.has(key) || pending.has(key)) return

  const request = window.fileManager
    .fileIcon(key)
    .then((dataUrl) => {
      cache.set(key, dataUrl)
    })
    .catch(() => {
      cache.set(key, null)
    })
    .finally(() => {
      pending.delete(key)
      onLoaded()
    })
  pending.set(key, request)
}
