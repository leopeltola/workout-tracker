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
}

export interface Log {
  id: number
  exercise_id: number
  exercise_name: string
  muscle_group: string | null
  log_date: string
  order_index: number
  notes: string | null
  sets: SetData[]
}

export interface Exercise {
  id: number
  name: string
  muscle_group: string | null
}
