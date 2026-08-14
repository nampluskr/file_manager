import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyItems } from './copyItems'
import type { ConflictDecision } from './copyItems'

const autoCancel = async (): Promise<ConflictDecision> => ({ action: 'cancel', applyToAll: false })

describe('copyItems', () => {
  let sourceDir = ''
  let destDir = ''

  afterEach(async () => {
    if (sourceDir) await rm(sourceDir, { recursive: true, force: true })
    if (destDir) await rm(destDir, { recursive: true, force: true })
    sourceDir = ''
    destDir = ''
  })

  async function setup(): Promise<void> {
    sourceDir = await mkdtemp(join(tmpdir(), 'file-manager-copy-src-'))
    destDir = await mkdtemp(join(tmpdir(), 'file-manager-copy-dst-'))
  }

  it('copies a single file', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'a')
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result).toMatchObject({ succeeded: ['a.txt'], failed: [], cancelled: false })
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('a')
  })

  it('copies multiple selected files', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'a')
    await writeFile(join(sourceDir, 'b.txt'), 'b')
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['a.txt', 'b.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded.sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('copies a folder recursively', async () => {
    await setup()
    await mkdir(join(sourceDir, 'nested'))
    await writeFile(join(sourceDir, 'nested', 'c.txt'), 'c')
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['nested'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['nested'])
    expect(await readFile(join(destDir, 'nested', 'c.txt'), 'utf8')).toBe('c')
  })

  it('merges into an existing destination folder without prompting', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    await writeFile(join(sourceDir, 'dir', 'new.txt'), 'new')
    await mkdir(join(destDir, 'dir'))
    await writeFile(join(destDir, 'dir', 'existing.txt'), 'existing')

    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel // must not be called for the dir/dir case
    })
    expect(result.succeeded).toEqual(['dir'])
    expect((await readdir(join(destDir, 'dir'))).sort()).toEqual(['existing.txt', 'new.txt'])
  })

  it('excludes symlinks and reports them as failed', async () => {
    await setup()
    await writeFile(join(sourceDir, 'real.txt'), 'r')
    await symlink(join(sourceDir, 'real.txt'), join(sourceDir, 'link.txt')).catch((error) => {
      // Symlink creation on Windows may require elevated privileges; skip if unsupported.
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error
    })
    const linkExists = (await readdir(sourceDir)).includes('link.txt')
    if (!linkExists) return

    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['link.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual([])
    expect(result.failed[0]).toMatchObject({ name: 'link.txt', code: 'ELINK' })
  })

  it('rejects copying a folder into its own subfolder', async () => {
    await setup()
    await mkdir(join(sourceDir, 'dir'))
    const result = await copyItems({
      sourceDir,
      destDir: join(sourceDir, 'dir'),
      names: ['dir'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.failed[0]).toMatchObject({ code: 'ERECURSIVE' })
  })

  it('applies overwrite/skip/rename conflict decisions with applyToAll', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'new-a')
    await writeFile(join(sourceDir, 'b.txt'), 'new-b')
    await writeFile(join(destDir, 'a.txt'), 'old-a')
    await writeFile(join(destDir, 'b.txt'), 'old-b')

    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['a.txt', 'b.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'overwrite', applyToAll: true })
    })
    expect(result.succeeded.sort()).toEqual(['a.txt', 'b.txt'])
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('new-a')
    expect(await readFile(join(destDir, 'b.txt'), 'utf8')).toBe('new-b')
  })

  it('auto-renames on conflict instead of overwriting', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'new')
    await writeFile(join(destDir, 'a.txt'), 'old')
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['a.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: async () => ({ action: 'rename', applyToAll: false })
    })
    expect(result.succeeded).toEqual(['a.txt'])
    expect(await readFile(join(destDir, 'a.txt'), 'utf8')).toBe('old')
    expect(await readFile(join(destDir, 'a (2).txt'), 'utf8')).toBe('new')
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
    const result = await copyItems({
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
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['missing.txt', 'ok.txt'],
      signal: new AbortController().signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.succeeded).toEqual(['ok.txt'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].name).toBe('missing.txt')
  })

  it('reports cancellation and stops processing further items', async () => {
    await setup()
    await writeFile(join(sourceDir, 'a.txt'), 'a')
    await writeFile(join(sourceDir, 'b.txt'), 'b')
    const controller = new AbortController()
    controller.abort()
    const result = await copyItems({
      sourceDir,
      destDir,
      names: ['a.txt', 'b.txt'],
      signal: controller.signal,
      onProgress: () => {},
      onConflict: autoCancel
    })
    expect(result.cancelled).toBe(true)
    expect(result.succeeded).toEqual([])
  })
})
