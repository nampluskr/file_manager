import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDirectory } from './createDirectory'

describe('createDirectory', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  it('creates a new folder', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-mkdir-'))
    const result = await createDirectory(fixtureDir, 'New Folder')
    expect(result.ok).toBe(true)
  })

  it('rejects a duplicate name', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-mkdir-'))
    await createDirectory(fixtureDir, 'dup')
    const result = await createDirectory(fixtureDir, 'dup')
    expect(result).toMatchObject({ ok: false, code: 'EEXIST' })
  })

  it('rejects forbidden characters', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-mkdir-'))
    const result = await createDirectory(fixtureDir, 'bad?name')
    expect(result).toMatchObject({ ok: false, code: 'EINVAL' })
  })
})
