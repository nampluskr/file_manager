import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readTextFile } from './readTextFile'

describe('readTextFile', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  async function createFile(name: string, content: string | Uint8Array): Promise<string> {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-read-'))
    const path = join(fixtureDir, name)
    await writeFile(path, content)
    return path
  }

  it('reads UTF-8, UTF-8 BOM, and their original line-ending style', async () => {
    const utf8 = await readTextFile(await createFile('utf8.txt', 'one\r\ntwo\r\n'))
    expect(utf8).toMatchObject({ content: 'one\r\ntwo\r\n', encoding: 'utf8', eol: 'crlf', editable: true })

    const bom = await readTextFile(await createFile('bom.txt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('one\ntwo')])))
    expect(bom).toMatchObject({ content: 'one\ntwo', encoding: 'utf8-bom', eol: 'lf', editable: true })
  })

  it('falls back to CP949-compatible euc-kr decoding when UTF-8 validation fails', async () => {
    const result = await readTextFile(await createFile('korean.txt', Buffer.from([0xb0, 0xa1, 0xb3, 0xaa])))
    expect(result).toMatchObject({ content: '가나', encoding: 'cp949', editable: true })
  })
})
