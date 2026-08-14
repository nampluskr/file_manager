import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readTextFile } from './readTextFile'
import { writeTextFile } from './writeTextFile'

describe('writeTextFile', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  async function createFile(name: string, bytes: Uint8Array): Promise<string> {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-write-'))
    const path = join(fixtureDir, name)
    await writeFile(path, bytes)
    return path
  }

  it('preserves UTF-8, UTF-8 BOM, and CP949 encodings with their requested EOL style', async () => {
    const fixtures = [
      { name: 'utf8.txt', bytes: Buffer.from('before\n'), expected: Buffer.from('after\n') },
      { name: 'bom.txt', bytes: Buffer.from([0xef, 0xbb, 0xbf, 98, 101, 102, 111, 114, 101, 13, 10]), expected: Buffer.from([0xef, 0xbb, 0xbf, 97, 102, 116, 101, 114, 13, 10]) },
      { name: 'cp949.txt', bytes: Buffer.from([0xb0, 0xa1, 13, 10]), expected: Buffer.from([0xb3, 0xaa, 13, 10]) }
    ]

    for (const fixture of fixtures) {
      const path = await createFile(fixture.name, fixture.bytes)
      const loaded = await readTextFile(path)
      const response = await writeTextFile({
        path,
        content: fixture.name === 'cp949.txt' ? '나\n' : 'after\n',
        encoding: loaded.encoding,
        eol: loaded.eol,
        expectedMtime: loaded.mtime,
        expectedHash: loaded.hash,
        force: false
      })
      expect(response.ok).toBe(true)
      expect(await readFile(path)).toEqual(fixture.expected)
      await rm(fixtureDir, { recursive: true, force: true })
      fixtureDir = ''
    }
  })

  it('detects content changes even when the modified time is restored', async () => {
    const path = await createFile('changed.txt', Buffer.from('before\n'))
    const loaded = await readTextFile(path)
    await writeFile(path, 'other\n')
    await utimes(path, new Date(), new Date(loaded.mtime))

    const response = await writeTextFile({
      path,
      content: 'after\n',
      encoding: loaded.encoding,
      eol: loaded.eol,
      expectedMtime: loaded.mtime,
      expectedHash: loaded.hash,
      force: false
    })
    expect(response).toMatchObject({ ok: false, reason: 'mtime-mismatch' })
    expect(await readFile(path, 'utf8')).toBe('other\n')
  })

  it('rejects CP949 text that would otherwise be replaced with a question mark', async () => {
    const path = await createFile('cp949.txt', Buffer.from([0xb0, 0xa1]))
    const loaded = await readTextFile(path)
    const response = await writeTextFile({
      path,
      content: '가😀',
      encoding: 'cp949',
      eol: 'lf',
      expectedMtime: loaded.mtime,
      expectedHash: loaded.hash,
      force: false
    })
    expect(response).toMatchObject({ ok: false, reason: 'error', code: 'ENCODING' })
    expect(await readFile(path)).toEqual(Buffer.from([0xb0, 0xa1]))
  })
})
