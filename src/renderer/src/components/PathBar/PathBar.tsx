import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { truncateMiddle } from '../../state/format'

type PathBarProps = { path: string }

export function PathBar({ path }: PathBarProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [maxChars, setMaxChars] = useState<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    // The path font is monospace (SPEC.md §14.2), so a single character's
    // measured width gives an exact chars-per-container-width conversion.
    const update = (): void => {
      const charWidth = measure.getBoundingClientRect().width
      if (charWidth > 0) setMaxChars(Math.floor(container.clientWidth / charWidth))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const displayPath = maxChars !== null ? truncateMiddle(path, maxChars) : path

  return (
    <div ref={containerRef} className="path-bar">
      <span ref={measureRef} className="path-bar-measure" aria-hidden="true">
        0
      </span>
      {displayPath}
    </div>
  )
}
