import { createContext, useContext } from 'react'

// Stand-in for auth: the viewer simply says who they are.
export type Role = 'learner' | 'support'

export const RoleContext = createContext<{ role: Role; setRole: (role: Role) => void } | null>(
  null,
)

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used inside RoleProvider')
  return ctx
}
