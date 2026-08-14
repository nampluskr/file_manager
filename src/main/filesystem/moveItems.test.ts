import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Simulates a cross-volume move (EXDEV) without needing two real drives:
// `rename` is made to fail with EXDEV whenever the source path is flagged.
// `copyFile` can also be made to fail, to simulate the EXDEV fallback itself
// failing partway through (used to verify overwrite-restore behavior).
let forceExdevFor: string | null = null
let forceCopyFailFor: string | null = null
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
