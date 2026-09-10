export type SectionId =
  | 'overview'
  | 'terminal-ink'
  | 'session-storage'
  | 'token-flow'
  | 'agent-loop'
  | 'compaction'
  | 'security-sandbox'
  | 'providers'
  | 'interview-qa'

export interface NavItem {
  id: SectionId
  label: string
  shortLabel: string
  badge?: string
  description: string
}

export interface CodeSnippet {
  title: string
  file: string
  code: string
  language?: string
  highlightLines?: number[]
}

export interface InterviewQuestion {
  id: string
  question: string
  category: 'Terminal & CLI' | 'Token Streaming' | 'Compaction' | 'Security' | 'State & Persistence'
  summary: string
  detailedAnswer: string
  sourceFiles: string[]
  codeSnippet?: string
}
