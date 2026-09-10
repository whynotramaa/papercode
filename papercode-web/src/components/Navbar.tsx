import { useState } from 'react'
import type { SectionId } from '../types'
import { Menu, Moon, Sun, X } from 'lucide-react'

interface NavbarProps {
  activeSection: SectionId
  onSelectSection: (id: SectionId) => void
  isDark: boolean
  onToggleTheme: () => void
}

const NAV_ITEMS: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'terminal-ink', label: 'Terminal' },
  { id: 'token-flow', label: 'Token flow' },
  { id: 'interview-qa', label: 'Notes' },
]

export function Navbar({ activeSection, onSelectSection, isDark, onToggleTheme }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const select = (id: SectionId) => {
    onSelectSection(id)
    setMobileOpen(false)
  }

  return (
    <header className="site-nav">
      <div className="nav-inner">
        <button className="wordmark" type="button" onClick={() => select('overview')} aria-label="Back to PaperCode engineering document">
          <span className="wordmark-index">/</span>
          <span>papercode</span>
          <small>engineering / 001</small>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className={activeSection === item.id ? 'is-active' : ''} onClick={() => select(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="nav-actions">
          <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
          <button className="menu-toggle" type="button" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-label="Toggle navigation">
            {mobileOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-nav">
          <div className="mobile-nav-heading">Navigate the document</div>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className={activeSection === item.id ? 'is-active' : ''} onClick={() => select(item.id)}>
              <span>{item.label}</span><span>↗</span>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
