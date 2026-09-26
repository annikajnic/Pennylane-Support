import type { Role } from '../role'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// All requests go through the Vite proxy (/api -> Express) and carry the
// viewer's role, which the server uses in place of real auth.
export async function apiFetch<T>(
  path: string,
  role: Role,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Role', role)
  if (init.body) headers.set('Content-Type', 'application/json')

  const res = await fetch(`/api${path}`, { ...init, headers })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

// Builds "?a=1&b=2", skipping empty values.
export function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
