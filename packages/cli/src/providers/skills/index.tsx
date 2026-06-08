import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Skill } from "@papercode/shared"

type SkillsContextValue = {
  skills: Skill[]
  refreshSkills: () => void
}

const SkillsContext = createContext<SkillsContextValue | null>(null)

export function useSkills(): SkillsContextValue {
  const ctx = useContext(SkillsContext)
  if (!ctx) throw new Error("useSkills must be used within SkillsProvider")
  return ctx
}

export function SkillsProvider({ children }: { children: ReactNode }) {
  const [skills, setSkills] = useState<Skill[]>([])

  const fetchSkills = useCallback(() => {
    const apiUrl = process.env.API_URL ?? "http://localhost:3000"
    const cwd = encodeURIComponent(process.cwd())
    fetch(`${apiUrl}/skills?cwd=${cwd}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  return (
    <SkillsContext.Provider value={{ skills, refreshSkills: fetchSkills }}>
      {children}
    </SkillsContext.Provider>
  )
}
