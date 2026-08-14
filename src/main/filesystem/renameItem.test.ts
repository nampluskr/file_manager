import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isValidFileName, renameItem } from './renameItem'

describe('isValidFileName', () => {
  it('rejects Windows-forbidden characters and the "." / ".." names', () => {
    for (const bad of ['a\\b', 'a/b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', '.', '..', '']) {
      expect(isValidFileName(bad)).toBe(false)
    }
    expect(isValidFileName('normal name.txt')).toBe(true)
  })
})

describe('renameItem', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  it('renames a file to a new, non-conflicting name', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-rename-'))
    await writeFile(join(fixtureDir, 'old.txt'), 'x')
    const result = await renameItem(fixtureDir, 'old.txt', 'new.txt')
    expect(result.ok).toBe(true)
    expect(await readdir(fixtureDir)).toEqual(['new.txt'])
  })

  it('rejects a rename onto an existing different name', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-rename-'))
    await writeFile(join(fixtureDir, 'a.txt'), 'a')
    await writeFile(join(fixtureDir, 'b.txt'), 'b')
    const result = await renameItem(fixtureDir, 'a.txt', 'b.txt')
    expect(result).toMatchObject({ ok: false, code: 'EEXIST' })
  })

  it('rejects forbidden characters without touching the file system', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-rename-'))
    await writeFile(join(fixtureDir, 'a.txt'), 'a')
    const result = await renameItem(fixtureDir, 'a.txt', 'a*b.txt')
    expect(result).toMatchObject({ ok: false, code: 'EINVAL' })
    expect(await readdir(fixtureDir)).toEqual(['a.txt'])
  })

  it('allows a case-only rename without misreporting it as a conflict', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-rename-'))
    await writeFile(join(fixtureDir, 'Foo.txt'), 'x')
    const result = await renameItem(fixtureDir, 'Foo.txt', 'foo.txt')
    expect(result.ok).toBe(true)
    expect(await readdir(fixtureDir)).toEqual(['foo.txt'])
  })
})
