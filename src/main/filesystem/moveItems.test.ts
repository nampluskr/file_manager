import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Simulates a cross-volume move (EXDEV) without needing two real drives:
// `rename` is made to fail with EXDEV whenever the source path is flagged.
let forceExdevFor: string | null = null
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
