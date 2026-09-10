import { useEffect, useState } from 'react'
import type { SectionId } from './types'
import { Navbar } from './components/Navbar'
import { OverviewSection } from './sections/OverviewSection'
import { TerminalInkSection } from './sections/TerminalInkSection'
import { SessionStorageSection } from './sections/SessionStorageSection'
import { TokenFlowSection } from './sections/TokenFlowSection'
import { AgentLoopSection } from './sections/AgentLoopSection'
import { CompactionSection } from './sections/CompactionSection'
import { SecuritySandboxSection } from './sections/SecuritySandboxSection'
import { ProvidersSection } from './sections/ProvidersSection'
import { InterviewNotesSection } from './sections/InterviewNotesSection'

const SECTIONS: { id: SectionId; number: string; label: string }[] = [
  { id: 'overview', number: '00', label: 'Overview' },
  { id: 'terminal-ink', number: '01', label: 'Terminal rendering' },
  { id: 'session-storage', number: '02', label: 'Persistence' },
  { id: 'token-flow', number: '03', label: 'Token flow' },
  { id: 'agent-loop', number: '04', label: 'Agent loop' },
  { id: 'compaction', number: '05', label: 'Compaction' },
  { id: 'security-sandbox', number: '06', label: 'Security' },
  { id: 'providers', number: '07', label: 'Providers' },
  { id: 'interview-qa', number: '08', label: 'Interview notes' },
]

export function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('papercode-theme')
    return saved ? saved === 'dark' : false
  })

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('papercode-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    const sectionElements = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveSection(visible.target.id as SectionId)
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: [0.05, 0.2, 0.5] },
    )
    sectionElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="site-shell">
      <Navbar
        activeSection={activeSection}
        onSelectSection={scrollToSection}
        isDark={isDark}
        onToggleTheme={() => setIsDark((current) => !current)}
      />

      <div className="document-layout">
        <aside className="document-rail" aria-label="Document information">
          <span className="rail-rule" />
          <span className="rail-label">PC / 001</span>
          <span className="rail-label">Engineering</span>
          <span className="rail-label">A field guide</span>
        </aside>

        <main className="article-main">
          <article className="paper-article">
            <OverviewSection />
            <TerminalInkSection />
            <SessionStorageSection />
            <TokenFlowSection />
            <AgentLoopSection />
            <CompactionSection />
            <SecuritySandboxSection />
            <ProvidersSection />
            <InterviewNotesSection />
          </article>
        </main>

        <aside className="toc" aria-label="On this page">
          <div className="toc-inner">
            <span className="toc-kicker">On this page</span>
            <nav>
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? 'is-active' : ''}
                  onClick={() => scrollToSection(section.id)}
                >
                  <span>{section.number}</span>
                  <em>{section.label}</em>
                </button>
              ))}
            </nav>
          </div>
        </aside>
      </div>

      <footer className="document-footer">
        <div>
          <span className="footer-mark">PAPER<span>CODE</span></span>
          <p>An engineering document for people who care how systems hold together.</p>
        </div>
        <div className="footer-meta">
          <span>ISSUE 001</span>
          <span>BUILT IN THE OPEN</span>
          <button type="button" onClick={() => scrollToSection('overview')}>Back to beginning ↑</button>
        </div>
      </footer>
    </div>
  )
}

export default App
