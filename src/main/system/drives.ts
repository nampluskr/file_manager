// Pure Node drive enumeration and capacity probing. No electron import
// (matches the spirit of SPEC.md §11.4 even though system/ is not bound by
// it -- this module has no Electron API to call anyway).
//
// Node has no drive enumeration API on Windows, so C:-Z: are probed directly
// (SPEC.md §10.4). A disconnected network drive can block for tens of
// seconds on the SMB timeout; withTimeout() bounds how long the caller waits
// but -- like the per-entry lstat timeout in listDirectory.ts -- it does not
// cancel the underlying libuv threadpool work, which keeps running until the
// OS gives up. UV_THREADPOOL_SIZE is raised in main/index.ts so up to 24
// stuck probes cannot serialize behind the default pool of 4 and starve
// unrelated fs calls (e.g. a listDirectory issued around the same time).
import { statfs } from 'node:fs/promises'
import type { DriveInfo } from '../../shared/ipc'
import { withTimeout } from '../filesystem/timeoutUtils'

const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const PROBE_TIMEOUT_MS = 1500

async function probeDrive(letter: string): Promise<DriveInfo | null> {
  const root = `${letter}:\\`
  try {
    const stats = await withTimeout(statfs(root), PROBE_TIMEOUT_MS, () => null)
    if (!stats) return null
    return { letter, free: stats.bavail * stats.bsize, total: stats.blocks * stats.bsize }
  } catch {
    return null
  }
}

// Probed once at startup and cached in memory (SPEC.md §10.4: "명시적
// 새로고침 시에만 갱신한다" -- v0.1's IPC contract has no refresh channel,
// so this cache lives for the process lifetime).
let cachedDrives: Promise<DriveInfo[]> | null = null

export function listDrives(): Promise<DriveInfo[]> {
  if (!cachedDrives) {
    cachedDrives = Promise.all(DRIVE_LETTERS.map(probeDrive)).then((results) =>
      results.filter((info): info is DriveInfo => info !== null)
    )
  }
  return cachedDrives
}

// Unlike listDrives(), this always re-probes: DriveBar capacity must reflect
// the current free space, not the startup snapshot (SPEC.md §10.3).
export async function driveUsage(letter: string): Promise<{ free: number; total: number }> {
  const info = await probeDrive(letter)
  if (!info || info.free === null || info.total === null) {
    throw new Error(`드라이브 ${letter}: 을 사용할 수 없습니다`)
  }
  return { free: info.free, total: info.total }
}
