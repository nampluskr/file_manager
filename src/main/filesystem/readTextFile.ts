import { readFile, stat } from 'node:fs/promises'
import type { ReadTextResult } from '../../shared/ipc'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

function detectEol(content: string): ReadTextResult['eol'] {
  const crlf = (content.match(/\r\n/g) ?? []).length
  const lf = (content.match(/(?<!\r)\n/g) ?? []).length
  return crlf > lf ? 'crlf' : 'lf'
}

function decodeUtf8(bytes: Buffer): { content: string; encoding: 'utf8' | 'utf8-bom' } | null {
  const hasBom = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(hasBom ? bytes.subarray(UTF8_BOM.length) : bytes)
    return { content, encoding: hasBom ? 'utf8-bom' : 'utf8' }
  } catch {
    return null
  }
}

export async function readTextFile(path: string): Promise<ReadTextResult> {
  const [bytes, metadata] = await Promise.all([readFile(path), stat(path)])
  const utf8 = decodeUtf8(bytes)

  if (utf8) {
    return {
      content: utf8.content,
      encoding: utf8.encoding,
      eol: detectEol(utf8.content),
      mtime: metadata.mtimeMs,
      editable: true
    }
  }

  try {
    const content = new TextDecoder('euc-kr', { fatal: true }).decode(bytes)
    return { content, encoding: 'cp949', eol: detectEol(content), mtime: metadata.mtimeMs, editable: true }
  } catch {
    return {
      content: '',
      encoding: 'utf8',
      eol: 'lf',
      mtime: metadata.mtimeMs,
      editable: false,
      reason: 'The file encoding could not be detected.'
    }
  }
}
