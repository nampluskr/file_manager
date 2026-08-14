import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import iconv from 'iconv-lite'
import type { ReadTextResult } from '../../shared/ipc'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])
export const MAX_EDITABLE_FILE_BYTES = 1024 * 1024

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

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

function decodeCp949(bytes: Buffer): string | null {
  const content = iconv.decode(bytes, 'cp949')
  return iconv.encode(content, 'cp949').equals(bytes) ? content : null
}

export async function readTextFile(path: string): Promise<ReadTextResult> {
  const [bytes, metadata] = await Promise.all([readFile(path), stat(path)])
  const hash = hashBytes(bytes)

  if (bytes.length > MAX_EDITABLE_FILE_BYTES) {
    return {
      content: '',
      encoding: 'utf8',
      eol: 'lf',
      mtime: metadata.mtimeMs,
      hash,
      editable: false,
      reason: 'Files larger than 1 MB can only be opened in VSCode.'
    }
  }
  const utf8 = decodeUtf8(bytes)

  if (utf8) {
    return {
      content: utf8.content,
      encoding: utf8.encoding,
      eol: detectEol(utf8.content),
      mtime: metadata.mtimeMs,
      hash,
      editable: true
    }
  }

  const cp949 = decodeCp949(bytes)
  if (cp949 !== null) {
    const content = cp949
    return { content, encoding: 'cp949', eol: detectEol(content), mtime: metadata.mtimeMs, hash, editable: true }
  }

  return {
    content: '',
    encoding: 'utf8',
    eol: 'lf',
    mtime: metadata.mtimeMs,
    hash,
    editable: false,
    reason: 'The file encoding could not be detected.'
  }
}
