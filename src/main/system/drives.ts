// Pure Node drive capacity probing. No electron import (matches the spirit
// of SPEC.md §11.4 even though system/ is not bound by it -- this module has
// no Electron API to call anyway).
//
// A disconnected network drive can block for tens of seconds on the SMB
// timeout; withTimeout() bounds how long the caller waits but -- like the
// per-entry lstat timeout in listDirectory.ts -- it does not cancel the
// underlying libuv threadpool work, which keeps running until the OS gives
// up.
import { statfs } from 'node:fs/promises'
import type { DriveInfo } from '../../shared/ipc'
import { withTimeout } from '../filesystem/timeoutUtils'

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

// This always re-probes: DriveBar capacity must reflect the current free
// space, not a startup snapshot (SPEC.md §10.3).
export async function driveUsage(letter: string): Promise<{ free: number; total: number }> {
  const info = await probeDrive(letter)
  if (!info || info.free === null || info.total === null) {
    throw new Error(`드라이브 ${letter}: 을 사용할 수 없습니다`)
  }
  return { free: info.free, total: info.total }
}
