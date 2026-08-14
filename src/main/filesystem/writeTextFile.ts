import { createHash, randomUUID } from 'node:crypto'
import { rename, stat, unlink, writeFile, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import iconv from 'iconv-lite'
import type { WriteTextRequest, WriteTextResult } from '../../shared/ipc'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function restoreEol(content: string, eol: WriteTextRequest['eol']): string {
  const normalized = content.replace(/\r\n|\r|\n/g, '\n')
  return eol === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized
}

function encodeContent(content: string, encoding: WriteTextRequest['encoding']): Buffer {
  if (encoding === 'utf8') return Buffer.from(content, 'utf8')
  if (encoding === 'utf8-bom') return Buffer.concat([UTF8_BOM, Buffer.from(content, 'utf8')])

  const encoded = iconv.encode(content, 'cp949')
  if (iconv.decode(encoded, 'cp949') !== content) {
    throw Object.assign(new Error('The text contains characters that CP949 cannot represent.'), { code: 'ENCODING' })
  }
  return encoded
}

async function currentVersion(path: string): Promise<{ mtime: number; hash: string }> {
  const [metadata, bytes] = await Promise.all([stat(path), readFile(path)])
  return { mtime: metadata.mtimeMs, hash: hashBytes(bytes) }
}

export async function writeTextFile(request: WriteTextRequest): Promise<WriteTextResult> {
  let version: { mtime: number; hash: string }
  try {
    version = await currentVersion(request.path)
  } catch (error) {
    return { ok: false, reason: 'error', code: (error as NodeJS.ErrnoException).code ?? 'WRITE_FAILED', message: String(error) }
  }

  if (!request.force && (version.mtime !== request.expectedMtime || version.hash !== request.expectedHash)) {
    return { ok: false, reason: 'mtime-mismatch', actualMtime: version.mtime }
  }

  let temporaryPath: string | null = null
  try {
    const bytes = encodeContent(restoreEol(request.content, request.eol), request.encoding)
    temporaryPath = join(dirname(request.path), `.${basename(request.path)}.${randomUUID()}.tmp`)
    await writeFile(temporaryPath, bytes, { flag: 'wx' })

    const beforeRename = await currentVersion(request.path)
    if (!request.force && (beforeRename.mtime !== request.expectedMtime || beforeRename.hash !== request.expectedHash)) {
      await unlink(temporaryPath)
      return { ok: false, reason: 'mtime-mismatch', actualMtime: beforeRename.mtime }
    }

    await rename(temporaryPath, request.path)
    temporaryPath = null
    const saved = await currentVersion(request.path)
    return { ok: true, mtime: saved.mtime, hash: saved.hash }
  } catch (error) {
    if (temporaryPath) await unlink(temporaryPath).catch(() => undefined)
    const nodeError = error as NodeJS.ErrnoException
    return { ok: false, reason: 'error', code: nodeError.code ?? 'WRITE_FAILED', message: nodeError.message }
  }
}
