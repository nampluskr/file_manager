import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Simulates a cross-volume move (EXDEV) without needing two real drives:
// `rename` is made to fail with EXDEV whenever the source path is flagged.
// `copyFile` can also be made to fail, to simulate the EXDEV fallback itself
// failing partway through (used to verify overwrite-restore behavior).
let forceExdevFor: string | null = null
let forceCopyFailFor: string | null = null
let forceUnlinkFailFor: string | null = null
// Swaps a freshly-mkdir'd destination directory for a junction immediately
// after it's created -- simulating a TOCTOU attacker racing the gap between
// the copy step and the verify step. Windows allows creating a junction
// without elevated privileges (unlike a file symlink), which is why this
// attacks a directory rather than a single file.
let swapDirWithJunctionAfterMkdirFor: { destPath: string; linkTarget: string } | null = null
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: vi.fn(async (from: unknown, to: unknown) => {
      if (forceExdevFor && typeof from === 'string' && from.includes(forceExdevFor)) {
        const error = new Error('EXDEV') as NodeJS.ErrnoException
        error.code = 'EXDEV'
        throw error
      }
      return actual.rename(from as string, to as string)
    }),
    copyFile: vi.fn(async (from: unknown, to: unknown) => {
      if (forceCopyFailFor && typeof from === 'string' && from.includes(forceCopyFailFor)) {
        const error = new Error('EIO') as NodeJS.ErrnoException
        error.code = 'EIO'
        throw error
      }
      return actual.copyFile(from as string, to as string)
    }),
    unlink: vi.fn(async (path: unknown) => {
      if (forceUnlinkFailFor && typeof path === 'string' && path === forceUnlinkFailFor) {
        const error = new Error('EBUSY') as NodeJS.ErrnoException
        error.code = 'EBUSY'
        throw error
      }
      return actual.unlink(path as string)
    }),
    mkdir: vi.fn(async (path: unknown, options?: unknown) => {
      const result = await actual.mkdir(path as string, options as Parameters<typeof actual.mkdir>[1])
      if (swapDirWithJunctionAfterMkdirFor && path === swapDirWithJunctionAfterMkdirFor.destPath) {
        await actual.rmdir(path as string)
        await actual.symlink(swapDirWithJunctionAfterMkdirFor.linkTarget, path as string, 'junction')
      }
      return result
    })
  }
})

const { moveItems } = await import('./moveItems')
import type { ConflictDecision } from './copyItems'

const autoCancel = async (): Promise<ConflictDecision> => ({ action: 'cancel', applyToAll: false })

describe('moveItems', () => {
  let sourceDir = ''
  let destDir = ''

  afterEach(async () => {
    forceExdevFor = null
    forceCopyFailFor = null
    forceUnlinkFailFor = null
    swapDirWithJunctionAfterMkdirFor = null
    if (sourceDir) await rm(sourceDir, { recursive: true, force: true })
    if (destDir) await rm(destDir, { recursive: true, force: true })
    sourceDir = ''
    destDir = ''
  })

  async function setup(): Promise<void> {
    sourceDir = await mkdtemp(join(tmpdir(), 'file-manager-move-src-'))
    destDir = await mkdtemp(join(tmpdir(), 'file-manager-move-dst-'))
  }

  it('moves a file on the same volume via rename', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'a')
    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result).toMatchObject({ succeeded: ['a.txt'], failed: [], cancelled: false })
    expect(await readdir(sourceDir)).toEqual([])
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('a')
  })

  it('falls back to copy+verify+delete on EXDEV and preserves the file', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'cross-volume')
    forceExdevFor = join(sourceDir, 'a.txt')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['a.txt'])
    expect(await readdir(sourceDir)).toEqual([])
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('cross-volume')
  })

  it('moves a folder recursively across the simulated EXDEV boundary', async () => {
    await setup()
    await mkdir(join(sourceDir, 'nested'))
    await writeFile(join(sourceDir, 'nested', 'c.txt'), 'c')
    forceExdevFor = join(sourceDir, 'nested')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['nested'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['nested'])
    expect(await readdir(sourceDir)).toEqual([])
    expect(await readFile(join(destDir, 'nested', 'c.txt'), 'utf8')).toBe('c')
  })

  it('rejects moving a folder into its own subfolder without touching the source', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'x.txt'), 'x')
    const result = await moveItems({
      sourceDir,
      destDir: join(sourceDir, 'dir'),
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.failed[0]).toMatchObject({ code: 'ERECURSIVE' })
    expect(await readdir(join(sourceDir, 'dir'))).toEqual(['x.txt'])
  })

  it('merges into an existing destination folder', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'new.txt'), 'new')
    await mkdir(join(destDir, 'dir'))
    await writeFile(join(destDir, 'dir', 'existing.txt'), 'existing')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['dir'])
    expect((await readdir(join(destDir, 'dir'))).sort()).toEqual(['existing.txt', 'new.txt'])
  })

  it('restores the original destination file if an overwrite fails partway through (A7 #2)', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'incoming')
    await writeFile(join(destDir, 'a.txt'), 'original')
    forceExdevFor = join(sourceDir, 'a.txt')
    forceCopyFailFor = join(sourceDir, 'a.txt')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'overwrite', applyToAll: false })
    })

    expect(result.succeeded).toEqual([])
    expect(result.failed.length).toBeGreaterThan(0)
    // The pre-existing destination file must survive an overwrite that never completed.
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('original')
    // No backup artifact should be left behind alongside the restored file.
    expect(await readdir(destDir)).toEqual(['a.txt'])
    // And the source, which was never confirmed copied, must also survive.
    expect(await readFile(join(sourceDir, 'a.txt'), 'utf8')).toBe('incoming')
  })

  it('fails verification instead of following a destination directory swapped for a junction between copy and verify (A7-3 Critical #1)', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'a.txt'), 'secret-source-content')
    const decoyDir = join(destDir, 'decoy')
    await mkdir(decoyDir)
    forceExdevFor = join(sourceDir, 'dir')
    const destPath = join(destDir, 'dir')
    swapDirWithJunctionAfterMkdirFor = { destPath, linkTarget: decoyDir }

    let junctionCreated = true
    await symlink(decoyDir, join(destDir, '__junction_probe__'), 'junction').catch(() => {
      junctionCreated = false
    })
    if (!junctionCreated) return // environment cannot create junctions; skip rather than false-fail
    await rm(join(destDir, '__junction_probe__'), { recursive: true, force: true })

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })

    expect(result.succeeded).toEqual([])
    expect(result.failed[0]).toMatchObject({ code: 'EVERIFY' })
    // The source must survive: verification must not have been fooled into
    // following the junction back to a directory that isn't the real copy.
    expect(await readFile(join(sourceDir, 'dir', 'a.txt'), 'utf8')).toBe('secret-source-content')
  })

  it('restores the destination file if overwrite is cancelled mid-fallback-copy (A7-2 #2)', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'incoming')
    await writeFile(join(destDir, 'a.txt'), 'original')
    forceExdevFor = join(sourceDir, 'a.txt')
    const controller = new AbortController()

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: controller.signal,
      onProgress: () => {},
      onConflict: async () => {
        controller.abort() // cancellation lands mid-overwrite, before the EXDEV fallback copy runs
        return { action: 'overwrite', applyToAll: false }
      }
    })

    expect(result.cancelled).toBe(true)
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('original')
    expect(await readdir(destDir)).toEqual(['a.txt'])
    expect(await readFile(join(sourceDir, 'a.txt'), 'utf8')).toBe('incoming')
  })

  it('discards the superseded backup instead of colliding with it when only the post-verify source delete fails (A7-3 Major #6)', async () => {
    await setup()
    const srcPath = join(sourceDir, 'a.txt')
    await writeFile(srcPath, 'incoming')
    await writeFile(join(destDir, 'a.txt'), 'original')
    forceExdevFor = srcPath
    forceUnlinkFailFor = srcPath // the post-verify "delete original" step fails

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'overwrite', applyToAll: false })
    })

    expect(result.succeeded).toEqual([])
    expect(result.failed[0].message).toContain('원본 삭제')
    // The destination must end up holding the new (verified) content, with
    // no stray ".__fmgr_bak_*" file left stranded alongside it.
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('incoming')
    expect(await readdir(destDir)).toEqual(['a.txt'])
    // Source deletion genuinely failed, so the source is still there too
    // (a harmless duplicate, not a loss).
    expect(await readFile(srcPath, 'utf8')).toBe('incoming')
  })

  it('rejects a folder overwriting a same-named file, and vice versa, without touching either (A7-2 #6)', async () => {
    await setup()
    await mkdir(join(sourceDir, 'item'))
    await writeFile(join(destDir, 'item'), 'a file, not a folder')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['item'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })

    expect(result.failed[0]).toMatchObject({ code: 'ETYPE' })
    expect(await readFile(join(destDir, 'item'), 'utf8')).toBe('a file, not a folder')
    expect(await readdir(join(sourceDir, 'item'))).toEqual([])
  })

  it('does not report a partially-skipped merge directory as succeeded (A7-3 Major #7)', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'x.txt'), 'skip-me')
    await writeFile(join(sourceDir, 'dir', 'y.txt'), 'move-me')
    await mkdir(join(destDir, 'dir'))
    await writeFile(join(destDir, 'dir', 'x.txt'), 'existing')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'skip', applyToAll: false }) // only "x.txt" conflicts
    })

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([])
    // y.txt (no conflict) did move; x.txt (skipped) stayed at the source --
    // the directory is genuinely split, so it must not be reported as moved.
    expect(await readFile(join(destDir, 'dir', 'y.txt'), 'utf8')).toBe('move-me')
    expect(await readFile(join(sourceDir, 'dir', 'x.txt'), 'utf8')).toBe('skip-me')
  })

  it('does not report a fully-skipped merge directory as succeeded (A7-2 #5)', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'inner.txt'), 'incoming')
    await mkdir(join(destDir, 'dir'))
    await writeFile(join(destDir, 'dir', 'inner.txt'), 'existing')

    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'skip', applyToAll: false })
    })

    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([])
    // Nothing actually moved, so the source must be untouched.
    expect(await readFile(join(sourceDir, 'dir', 'inner.txt'), 'utf8')).toBe('incoming')
    expect(await readFile(join(destDir, 'dir', 'inner.txt'), 'utf8')).toBe('existing')
  })

  it('scopes applyToAll to the conflict kind it was decided for (A7 #9)', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'new-a')
    await writeFile(join(destDir, 'a.txt'), 'old-a')
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'inner.txt'), 'new-inner')
    await mkdir(join(destDir, 'dir'))
    await writeFile(join(destDir, 'dir', 'existing.txt'), 'existing')

    const seenKinds: string[] = []
    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['a.txt', 'dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async (_name, kind) => {
        seenKinds.push(kind)
        return { action: 'overwrite', applyToAll: true }
      }
    })

    expect(result.succeeded.sort()).toEqual(['a.txt', 'dir'])
    // dir/dir never prompts (silent merge); only the file conflict should have asked.
    expect(seenKinds).toEqual(['file'])
    expect((await readdir(join(destDir, 'dir'))).sort()).toEqual(['existing.txt', 'inner.txt'])
  })

  it('allows the remaining items to proceed after one item fails (partial failure)', async () => {
    await setup()
    await writeFile(join(sourceDir, 'ok.txt'), 'ok')
    const result = await moveItems({
      sourceDir,
      destDir,
      names: ['missing.txt', 'ok.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['ok.txt'])
    expect(result.failed).toHaveLength(1)
  })
})
