export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(status: number, detail: string | null) {
    super(detail ?? `Request failed (${status})`)
    this.status = status
    this.detail = detail
  }
}

async function parseError(res: Response): Promise<string | null> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((e: { msg?: string }) => e.msg ?? '').join(', ')
    }
    return null
  } catch {
    return null
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (res.status === 401 && window.location.pathname !== '/login') {
    const next = window.location.pathname + window.location.search
    window.location.replace(`/login?next=${encodeURIComponent(next)}`)
    throw new ApiError(401, 'Not authenticated')
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res))
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
