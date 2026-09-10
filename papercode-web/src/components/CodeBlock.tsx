import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  code: string
  file?: string
  language?: string
  highlightLines?: number[]
  className?: string
}

export function CodeBlock({ code, file, language = 'typescript', highlightLines = [], className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.trim().split('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access is unavailable in some embedded previews.
    }
  }

  return (
    <div className={`code-block ${className}`}>
      <div className="code-header">
        <span>{file || language}</span>
        <div>
          <span className="code-language">{language}</span>
          <button type="button" onClick={handleCopy} aria-label="Copy code">
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>
      <div className="code-scroll">
        <table aria-label={`${language} code sample`}>
          <tbody>
            {lines.map((line, index) => {
              const lineNumber = index + 1
              return (
                <tr key={lineNumber} className={highlightLines.includes(lineNumber) ? 'is-highlighted' : undefined}>
                  <td aria-hidden="true">{lineNumber}</td>
                  <td><pre>{line || ' '}</pre></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
