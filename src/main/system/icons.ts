// Electron dependency is intentional (SPEC.md §17): app.getFileIcon has no
// pure-Node equivalent, so this lives outside src/main/filesystem/ like
// trash.ts.
import { app } from 'electron'
import { mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'

// SPEC.md §10.5: one lookup per extension, cached forever, not per file --
// a 5,000-entry listing must not call getFileIcon 5,000 times.
const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let probeDirPromise: Promise<string> | null = null

// Windows resolves an extension's shell icon from the association registry
// only when handed a real file, so a zero-byte probe file per extension is
// created once (case-insensitively -- ".PNG" and ".png" must share a cache
// key and a probe file, see SPEC.md §10.4 adversarial focus) and reused for
// the life of the OS temp directory.
function probeDir(): Promise<string> {
  if (!probeDirPromise) {
    probeDirPromise = (async () => {
      const dir = join(app.getPath('temp'), 'personal-file-manager-icon-probe')
      await mkdir(dir, { recursive: true })
      return dir
    })()
  }
  return probeDirPromise
}

async function ensureProbeFile(extKey: string): Promise<string> {
  const dir = await probeDir()
  const fileName = extKey.length > 0 ? `probe.${extKey}` : 'probe'
  const filePath = join(dir, fileName)
  const handle = await open(filePath, 'a')
  await handle.close()
  return filePath
}

export async function getFileIconDataUrl(ext: string): Promise<string> {
  const key = ext.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached
  const inflight = pending.get(key)
  if (inflight) return inflight

  const request = (async () => {
    try {
      const filePath = await ensureProbeFile(key)
      const icon = await app.getFileIcon(filePath, { size: 'small' })
      const dataUrl = icon.toDataURL()
      cache.set(key, dataUrl)
      return dataUrl
    } finally {
      pending.delete(key)
    }
  })()
  pending.set(key, request)
  return request
}
