import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listDirectory } from './listDirectory'

describe('listDirectory', () => {
  let fixtureDir: string

  beforeEach(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-list-'))
    await writeFile(join(fixtureDir, 'notes.txt'), 'hello')
    await writeFile(join(fixtureDir, '.hidden'), '')
    await writeFile(join(fixtureDir, 'noext'), '')
    await mkdir(join(fixtureDir, 'subdir'))
  })

  afterEach(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('returns a FileEntry for every item with directories and extensions resolved', async () => {
    const entries = await listDirectory(fixtureDir)
    const byName = new Map(entries.map((entry) => [entry.name, entry]))

    expect(entries).toHaveLength(4)

    const file = byName.get('notes.txt')
    expect(file).toMatchObject({ ext: 'txt', isDirectory: false, isSymlink: false, isParent: false })
    expect(file?.size).toBe(5)
    expect(file?.mtime).toBeGreaterThan(0)

    const dotfile = byName.get('.hidden')
    expect(dotfile).toMatchObject({ ext: '', isDirectory: false })

    const noExt = byName.get('noext')
    expect(noExt).toMatchObject({ ext: '', isDirectory: false })

    const subdir = byName.get('subdir')
    expect(subdir).toMatchObject({ ext: '', size: 0, isDirectory: true })
  })

  it('rejects with the original Node error code when the directory does not exist', async () => {
    await expect(listDirectory(join(fixtureDir, 'missing'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
