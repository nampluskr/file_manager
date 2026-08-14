import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { deletePermanently } from './deleteItems'

describe('deletePermanently', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  it('removes files and folders recursively', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-delete-'))
    await writeFile(join(fixtureDir, 'a.txt'), 'a')
    await mkdir(join(fixtureDir, 'sub'))
    await writeFile(join(fixtureDir, 'sub', 'b.txt'), 'b')

    const result = await deletePermanently(fixtureDir, ['a.txt', 'sub'], new AbortController().signal)
    expect(result).toMatchObject({ succeeded: ['a.txt', 'sub'], failed: [], cancelled: false })
    expect(await readdir(fixtureDir)).toEqual([])
  })

  it('continues past a missing item and reports it as failed', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-delete-'))
    await writeFile(join(fixtureDir, 'a.txt'), 'a')
    const result = await deletePermanently(fixtureDir, ['missing.txt', 'a.txt'], new AbortController().signal)
    expect(result.succeeded).toEqual(['a.txt'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].name).toBe('missing.txt')
  })

  it('stops early when the signal is already aborted', async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-delete-'))
    await writeFile(join(fixtureDir, 'a.txt'), 'a')
    const controller = new AbortController()
    controller.abort()
    const result = await deletePermanently(fixtureDir, ['a.txt'], controller.signal)
    expect(result.cancelled).toBe(true)
    expect(await readdir(fixtureDir)).toEqual(['a.txt'])
  })
})
