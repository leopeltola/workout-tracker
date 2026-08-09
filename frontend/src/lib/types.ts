export type ExerciseUnit = 'weight_reps' | 'reps' | 'time'

export interface User {
  id: number
  username: string
  email: string | null
  avatar_url: string | null
}

export interface Me {
  user: User
  today: string
  server_time: string
}

export interface SetData {
  id?: number
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_s?: number | null
  is_pr?: boolean
  score?: number | null
}

export interface Log {
  id: number
  exercise_id: number
  exercise_name: string
  muscle_group: string | null
  log_date: string
  order_index: number
  notes: string | null
  unit: ExerciseUnit
  is_new_pr?: boolean
  sets: SetData[]
}

export interface Exercise {
  id: number
  name: string
  muscle_group: string | null
  unit: ExerciseUnit
}

export interface TopSet {
  log_date: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  duration_s: number | null
  score: number
}

export interface HistoryEntry {
  log_id: number
  log_date: string
  best_score: number
  sets: SetData[]
}

export interface ExerciseDetail {
  exercise: Exercise
  top_sets: TopSet[]
  history: HistoryEntry[]
}
