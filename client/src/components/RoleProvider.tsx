import { useEffect, useState, type ReactNode } from 'react'
import { RoleContext, type Role } from '../role'

const STORAGE_KEY = 'pl-support-role'

function readStoredRole(): Role {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'support' ? 'support' : 'learner'
  } catch {
    return 'learner'
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(readStoredRole)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, role)
    } catch {
      // Storage unavailable (e.g. private mode) — the role just won't persist.
    }
  }, [role])

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
}
