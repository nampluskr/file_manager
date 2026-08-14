import { useEffect, useState } from 'react'
import type { ComponentType, KeyboardEvent, ReactElement } from 'react'
import type { ReadTextResult } from '../../../../shared/ipc'

const TEXT_EXTENSIONS = new Set(['md', 'txt', 'log', 'json', 'yaml', 'yml', 'toml', 'ini', 'csv', 'ts', 'tsx', 'js', 'jsx', 'css', 'html', 'py', 'cpp', 'h', 'hpp', 'c'])

type MarkdownComponent = ComponentType<{ content: string }>

type ViewerProps = { path: string; onClose: () => void }

function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function Viewer({ path, onClose }: ViewerProps): ReactElement {
  const [result, setResult] = useState<ReadTextResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [Markdown, setMarkdown] = useState<MarkdownComponent | null>(null)
  const ext = extensionOf(path)
  const supported = TEXT_EXTENSIONS.has(ext)

  useEffect(() => {
    if (!supported) return
    setResult(null)
    setError(null)
    void window.fileManager.readText(path).then(setResult).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Unable to read the file.')
    })
  }, [path, supported])

  useEffect(() => {
    if (ext !== 'md' || !result) return
    let cancelled = false
    void Promise.all([import('react-markdown'), import('remark-gfm')])
      .then(([markdown, gfm]) => {
        if (cancelled) return
        setMarkdown(() => ({ content }: { content: string }) => (
          <markdown.default remarkPlugins={[gfm.default]}>{content}</markdown.default>
        ))
      })
      .catch(() => setMarkdown(null))
    return () => {
      cancelled = true
    }
  }, [ext, result])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="viewer-overlay" role="dialog" aria-modal="true" tabIndex={0} onKeyDown={handleKeyDown} ref={(node) => node?.focus()}>
      <header className="viewer-header">
        <span>{path}</span>
        <button type="button" onClick={onClose}>Esc Close</button>
      </header>
      <main className="viewer-content">
        {!supported ? <p>Unsupported file format.</p> : null}
        {error ? <p className="viewer-error">{error}</p> : null}
        {!error && supported && !result ? <p>Loading...</p> : null}
        {result && !result.editable ? <p>{result.reason}</p> : null}
        {result?.editable && ext === 'md' && Markdown ? <Markdown content={result.content} /> : null}
        {result?.editable && (ext !== 'md' || !Markdown) ? <pre>{result.content}</pre> : null}
      </main>
    </div>
  )
}
