import { api } from './api'
import type { Exercise, Log, Me, SetData } from './types'

export function getMe(): Promise<Me> {
  return api('/api/me')
}

export function getLogs(date: string): Promise<Log[]> {
  return api(`/api/logs?log_date=${date}`)
}

export interface CreateLogPayload {
  log_date: string
  exercise_name: string
  muscle_group?: string | null
}

export function createLog(payload: CreateLogPayload): Promise<Log> {
  return api('/api/logs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateLog(id: number, sets: SetData[]): Promise<Log> {
  return api(`/api/logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ sets }),
  })
}

export function deleteLog(id: number): Promise<{ deleted: boolean }> {
  return api(`/api/logs/${id}`, { method: 'DELETE' })
}

export function getExercises(opts: { q?: string; limit?: number } = {}): Promise<Exercise[]> {
  const params = new URLSearchParams()
  if (opts.q) params.set('q', opts.q)
  if (opts.limit) params.set('limit', String(opts.limit))
  return api(`/api/exercises?${params}`)
}
