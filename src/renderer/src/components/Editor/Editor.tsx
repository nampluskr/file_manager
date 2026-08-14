import { useEffect, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { ReadTextResult } from '../../../../shared/ipc'

type EditorProps = { path: string; onClose: () => void }

export function Editor({ path, onClose }: EditorProps): ReactElement {
  const [result, setResult] = useState<ReadTextResult | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setResult(null)
    setContent('')
    setError(null)
    void window.fileManager.readText(path).then((loaded) => {
      setResult(loaded)
      setContent(loaded.content)
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to read the file.')
    })
  }, [path])

  const dirty = result !== null && content !== result.content

  const save = async (force = false): Promise<void> => {
    if (!result || !result.editable || (saving && !force)) return
    setSaving(true)
    setError(null)
    try {
      const response = await window.fileManager.writeText({
        path,
        content,
        encoding: result.encoding,
        eol: result.eol,
        expectedMtime: result.mtime,
        expectedHash: result.hash,
        force
      })
      if (response.ok) {
        setResult({ ...result, content, mtime: response.mtime, hash: response.hash })
        return
      }
      if (response.reason === 'mtime-mismatch') {
        if (window.confirm('The file changed outside the editor. Overwrite it?')) {
          await save(true)
        }
        return
      }
      setError(response.message)
    } finally {
      setSaving(false)
    }
  }

  const close = (): void => {
    if (!dirty || window.confirm('Discard unsaved changes?')) onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void save()
      return
    }
    if (event.shiftKey && event.key === 'F4') {
      event.preventDefault()
      void window.fileManager.openInCode(path).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to open VSCode.')
      })
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div className="editor-overlay" role="dialog" aria-modal="true" tabIndex={0} onKeyDown={handleKeyDown} ref={(node) => node?.focus()}>
      <header className="editor-header">
        <span>{path}</span>
        <div>
          <button type="button" onClick={() => void save()} disabled={!dirty || saving || !result?.editable}>Ctrl+S Save</button>
          <button type="button" onClick={() => void window.fileManager.openInCode(path).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : 'Unable to open VSCode.')
          })}>Shift+F4 VSCode</button>
          <button type="button" onClick={close}>Esc Close</button>
        </div>
      </header>
      {error ? <p className="editor-error">{error}</p> : null}
      {!result && !error ? <p className="editor-message">Loading...</p> : null}
      {result && !result.editable ? <p className="editor-message">{result.reason}</p> : null}
      {result?.editable ? <textarea className="editor-textarea" value={content} onChange={(event) => setContent(event.target.value)} /> : null}
    </div>
  )
}
