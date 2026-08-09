import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { getExercise, updateExerciseUnit } from '../lib/client'
import { parseISO } from '../lib/dates'
import type { ExerciseDetail, ExerciseUnit, SetData } from '../lib/types'

const UNIT_LABELS: Record<ExerciseUnit, string> = {
  weight_reps: 'Weight + reps',
  reps: 'Reps only',
  time: 'Time',
}

const UNITS: ExerciseUnit[] = ['weight_reps', 'reps', 'time']

function fmtWeight(v: number | null | undefined): string {
  if (v == null) return ''
  const n = Math.round(v * 10) / 10
  return Number.isInteger(n) ? String(n) : String(n)
}

function fmtSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return '–'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function fmtDay(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatSet(unit: ExerciseUnit, s: SetData): string {
  const weight = s.weight_kg != null ? `${fmtWeight(s.weight_kg)} kg` : null
  if (unit === 'time') {
    return weight ? `${fmtSeconds(s.duration_s)} @ ${weight}` : fmtSeconds(s.duration_s)
  }
  if (unit === 'reps') return `${s.reps ?? '–'} reps`
  if (weight && s.reps != null) return `${s.reps} × ${weight}`
  if (weight) return weight
  return `${s.reps ?? '–'} reps`
}

export function ExercisePage() {
  const { id } = useParams()
  const exerciseId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => getExercise(exerciseId),
  })

  const changeUnit = useMutation({
    mutationFn: (unit: ExerciseUnit) => updateExerciseUnit(exerciseId, unit),
    onSuccess: (exercise) => {
      queryClient.setQueryData<ExerciseDetail>(['exercise', exerciseId], (old) =>
        old ? { ...old, exercise } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      queryClient.invalidateQueries({ queryKey: ['exercise', exerciseId] })
    },
  })

  const stats = useMemo(() => {
    if (!data) return null
    const unit = data.exercise.unit
    let bestWeight = 0
    let bestReps = 0
    let bestDuration = 0
    let bestScore = 0
    for (const h of data.history) {
      bestScore = Math.max(bestScore, h.best_score)
      for (const s of h.sets) {
        if (s.weight_kg != null) bestWeight = Math.max(bestWeight, s.weight_kg)
        if (s.reps != null) bestReps = Math.max(bestReps, s.reps)
        if (s.duration_s != null) bestDuration = Math.max(bestDuration, s.duration_s)
      }
    }
    return { unit, bestWeight, bestReps, bestDuration, bestScore }
  }, [data])

  if (isLoading || !data) {
    return (
      <div className="min-h-dvh bg-graphite-950">
        <div className="mx-auto max-w-md space-y-3 px-4 pt-16">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-graphite-850" />
          ))}
        </div>
      </div>
    )
  }

  const { exercise, top_sets, history } = data
  const unit = exercise.unit

  function goBack() {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="min-h-dvh bg-graphite-950">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-30 border-b border-graphite-800 bg-graphite-950/95 backdrop-blur safe-top">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-graphite-300 transition active:bg-graphite-800"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-graphite-50">
                {exercise.name}
              </h1>
              <p className="text-xs text-graphite-500">
                {UNIT_LABELS[unit]}
                {exercise.muscle_group ? ` · ${exercise.muscle_group}` : ''}
              </p>
            </div>
          </div>
        </header>

        <main className="space-y-3 px-4 pb-28 pt-3">
          <section className="rounded-2xl border border-graphite-800 bg-graphite-850 p-4">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              Measurement
            </h2>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-graphite-900 p-1">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    if (u !== unit) changeUnit.mutate(u)
                  }}
                  aria-pressed={u === unit}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    u === unit
                      ? 'bg-accent-500 text-white'
                      : 'text-graphite-300 active:bg-graphite-700'
                  }`}
                >
                  {UNIT_LABELS[u]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-graphite-500">
              How this exercise is measured. Existing sets are kept — only the shown
              fields change.
            </p>
          </section>

          <StatsCard unit={unit} stats={stats} />

          <section className="rounded-2xl border border-graphite-800 bg-graphite-850">
            <h2 className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              Top lifts
            </h2>
            {top_sets.length > 0 ? (
              <ul className="divide-y divide-graphite-800/60 px-4 pb-2">
                {top_sets.map((t, i) => (
                  <li key={`${t.log_date}-${t.set_number}`} className="flex items-center gap-2 py-2.5">
                    <span className="flex w-6 shrink-0 items-center justify-center text-sm font-semibold text-graphite-500">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium text-graphite-100">
                      {formatTop(unit, t)}
                    </span>
                    <span className="text-xs text-graphite-500">{fmtDay(t.log_date)}</span>
                    {i === 0 && <CrownIcon className="h-4 w-4 shrink-0 text-amber-300" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-3 pt-1 text-sm text-graphite-500">
                No sets logged yet.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-graphite-800 bg-graphite-850">
            <h2 className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              History
            </h2>
            {history.length > 0 ? (
              <ul className="divide-y divide-graphite-800/60 px-4 pb-2">
                {history.map((h) => {
                  const isRecordDay = stats !== null && h.best_score === stats.bestScore && h.best_score > 0
                  return (
                    <li key={h.log_id} className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-graphite-200">
                          {fmtDay(h.log_date)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-graphite-400">
                          {isRecordDay && <CrownIcon className="h-3.5 w-3.5 text-amber-300" />}
                          {h.best_score > 0 ? `best ${bestLabel(unit, h.best_score)}` : ''}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {h.sets.map((s) => {
                          const isBest = s.score != null && s.score > 0 && s.score === h.best_score
                          return (
                            <li
                              key={s.id}
                              className={`text-sm ${isBest ? 'font-semibold text-accent-300' : 'text-graphite-400'}`}
                            >
                              {formatSet(unit, s)}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-4 pb-3 pt-1 text-sm text-graphite-500">
                No sessions yet. Log this exercise from the day view.
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function formatTop(unit: ExerciseUnit, t: { weight_kg: number | null; reps: number | null; duration_s: number | null; score: number }): string {
  const weight = t.weight_kg != null ? `${fmtWeight(t.weight_kg)} kg` : null
  if (unit === 'reps') return `${t.reps ?? '–'} reps`
  if (unit === 'time') return weight ? `${fmtSeconds(t.duration_s)} @ ${weight}` : fmtSeconds(t.duration_s)
  if (weight && t.reps != null) return `${t.reps} × ${weight}`
  if (weight) return weight
  return `${t.reps ?? '–'} reps`
}

function bestLabel(unit: ExerciseUnit, score: number): string {
  if (unit === 'time') return fmtSeconds(Math.round(score))
  if (unit === 'reps') return `${Math.round(score)} reps`
  return `${fmtWeight(Math.round(score * 10) / 10)} kg est.`
}

function StatsCard({
  unit,
  stats,
}: {
  unit: ExerciseUnit
  stats: { unit: ExerciseUnit; bestWeight: number; bestReps: number; bestDuration: number; bestScore: number } | null
}) {
  if (!stats) return null
  const tiles = (() => {
    if (unit === 'time') {
      return [
        { label: 'Best hold', value: fmtSeconds(stats.bestDuration || null) },
        stats.bestWeight > 0
          ? { label: 'Heaviest', value: `${fmtWeight(stats.bestWeight)} kg` }
          : null,
      ].filter((t): t is { label: string; value: string } => t !== null)
    }
    if (unit === 'reps') {
      return [{ label: 'Best reps', value: stats.bestReps > 0 ? `${stats.bestReps}` : '–' }]
    }
    return [
      { label: 'Est. 1RM', value: stats.bestScore > 0 ? `${fmtWeight(Math.round(stats.bestScore * 10) / 10)} kg` : '–' },
      { label: 'Best weight', value: stats.bestWeight > 0 ? `${fmtWeight(stats.bestWeight)} kg` : '–' },
      { label: 'Best reps', value: stats.bestReps > 0 ? `${stats.bestReps}` : '–' },
    ]
  })()

  return (
    <section className="rounded-2xl border border-graphite-800 bg-graphite-850 p-4">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
        Records
      </h2>
      <div className={`mt-2 grid gap-2 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-graphite-900 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-graphite-500">{t.label}</p>
            <p className="mt-0.5 truncate text-lg font-bold text-graphite-50">{t.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18 9 12l6-6" />
    </svg>
  )
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="m2.5 8 4.2 3.5L11 4.6a1.6 1.6 0 0 1 2 0l4.3 6.9L21.5 8a1 1 0 0 1 1.6.9l-1.3 8.6a1.6 1.6 0 0 1-1.6 1.4H3.8a1.6 1.6 0 0 1-1.6-1.4L.9 8.9A1 1 0 0 1 2.5 8ZM5 19.5h14V21H5v-1.5Z" />
    </svg>
  )
}
