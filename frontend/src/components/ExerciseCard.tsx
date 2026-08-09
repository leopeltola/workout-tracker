import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { deleteLog, updateLog } from '../lib/client'
import type { Log, SetData } from '../lib/types'
import { StepperInput } from './StepperInput'
import { TimeInput } from './TimeInput'

interface ExerciseCardProps {
  log: Log
  focusRequested: boolean
  onFocusDone: () => void
}

const SAVE_DELAY = 500

function emptySet(setNumber: number): SetData {
  return { set_number: setNumber, reps: null, weight_kg: null, duration_s: null }
}

export function ExerciseCard({ log, focusRequested, onFocusDone }: ExerciseCardProps) {
  const queryClient = useQueryClient()
  const [sets, setSets] = useState<SetData[]>(log.sets)
  const [dirty, setDirty] = useState(false)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const firstFocusDone = useRef(false)

  const unit = log.unit

  const save = useMutation({
    mutationFn: (payload: SetData[]) => updateLog(log.id, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData<Log[]>(['logs', log.log_date], (old) =>
        old?.map((l) => (l.id === log.id ? saved : l)),
      )
      setSets((prev) => {
        const byNumber = new Map(saved.sets.map((s) => [s.set_number, s]))
        return prev.map((s) => {
          const serverSet = byNumber.get(s.set_number)
          return serverSet ? { ...s, id: serverSet.id, is_pr: serverSet.is_pr } : s
        })
      })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', log.log_date] })
    },
  })

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      save.mutate(sets)
      setDirty(false)
    }, SAVE_DELAY)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, dirty])

  useEffect(() => {
    if (!focusRequested || firstFocusDone.current) return
    if (sets.length === 0) {
      setSets([emptySet(1)])
      setDirty(false)
      return
    }
    firstFocusDone.current = true
    requestAnimationFrame(() => firstInputRef.current?.focus())
    onFocusDone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequested, sets.length])

  function updateSet(index: number, patch: Partial<SetData>) {
    setSets((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
      return next
    })
    setDirty(true)
  }

  function addSet() {
    setSets((prev) => {
      const last = prev[prev.length - 1]
      const nextNumber = prev.reduce((max, s) => Math.max(max, s.set_number), 0) + 1
      return [
        ...prev,
        {
          set_number: nextNumber,
          reps: last?.reps ?? null,
          weight_kg: last?.weight_kg ?? null,
          duration_s: last?.duration_s ?? null,
        },
      ]
    })
    setDirty(true)
  }

  function removeSet(index: number) {
    setSets((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((s, i) => ({ ...s, set_number: i + 1 }))
    })
    setDirty(true)
  }

  const removeLog = useMutation({
    mutationFn: () => deleteLog(log.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs', log.log_date] })
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })

  const isRepsOnly = unit === 'reps'
  const isTime = unit === 'time'
  const cols = isRepsOnly ? 'grid-cols-[3rem_2fr_2rem]' : 'grid-cols-[3rem_1fr_1fr_2rem]'

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-850">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="min-w-0">
          <Link
            to={`/exercise/${log.exercise_id}`}
            className="flex items-center gap-1 truncate text-base font-semibold text-graphite-50 transition-colors active:text-accent-300"
          >
            <span className="truncate">{log.exercise_name}</span>
            <ChevronIcon className="h-3.5 w-3.5 shrink-0 text-graphite-500" />
          </Link>
          {log.muscle_group && (
            <p className="text-xs text-graphite-500">{log.muscle_group}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={`Remove ${log.exercise_name}`}
          onClick={() => {
            if (window.confirm(`Remove ${log.exercise_name}?`)) removeLog.mutate()
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-graphite-500 transition active:bg-graphite-700 active:text-graphite-300"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {sets.length > 0 && (
        <div className="mt-2 px-4">
          <div
            className={`grid items-center gap-2 border-b border-graphite-800 pb-1 ${cols}`}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              Set
            </span>
            {!isRepsOnly && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
                kg
              </span>
            )}
            <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              {isTime ? 'Time' : 'Reps'}
            </span>
            <span />
          </div>
          <ul className="divide-y divide-graphite-800/60">
            {sets.map((set, i) => {
              const isNewPr = Boolean(set.is_pr && log.is_new_pr)
              return (
                <li
                  key={set.id ?? `new-${i}-${set.set_number}`}
                  className={`grid items-center gap-2 py-1.5 ${cols}`}
                >
                  <span className="flex items-center gap-1 text-sm font-medium text-graphite-400">
                    {set.set_number}
                    {set.is_pr && (
                      <CrownIcon
                        isNew={isNewPr}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    )}
                  </span>
                  {!isRepsOnly && (
                    <StepperInput
                      ref={i === 0 ? firstInputRef : undefined}
                      value={set.weight_kg}
                      onChange={(v) => updateSet(i, { weight_kg: v })}
                      step={2.5}
                      decimals={1}
                      ariaLabel={`${log.exercise_name} set ${set.set_number} weight`}
                    />
                  )}
                  {isTime ? (
                    <TimeInput
                      value={set.duration_s ?? null}
                      onChange={(v) => updateSet(i, { duration_s: v })}
                      ariaLabel={`${log.exercise_name} set ${set.set_number} time`}
                    />
                  ) : (
                    <StepperInput
                      ref={i === 0 && isRepsOnly ? firstInputRef : undefined}
                      value={set.reps}
                      onChange={(v) => updateSet(i, { reps: v })}
                      step={1}
                      ariaLabel={`${log.exercise_name} set ${set.set_number} reps`}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Delete set ${set.set_number}`}
                    onClick={() => removeSet(i)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-graphite-500 transition active:bg-graphite-700 active:text-graphite-300"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={addSet}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-graphite-700 py-2 text-sm font-medium text-graphite-300 transition active:bg-graphite-700 active:text-graphite-100"
        >
          <PlusIcon className="h-4 w-4" />
          Add set
        </button>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M5 12h14" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )
}

function CrownIcon({ isNew, className }: { isNew: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`${className} ${isNew ? 'text-accent-300' : 'text-amber-300'}`}
      aria-hidden="true"
    >
      <path d="m2.5 8 4.2 3.5L11 4.6a1.6 1.6 0 0 1 2 0l4.3 6.9L21.5 8a1 1 0 0 1 1.6.9l-1.3 8.6a1.6 1.6 0 0 1-1.6 1.4H3.8a1.6 1.6 0 0 1-1.6-1.4L.9 8.9A1 1 0 0 1 2.5 8ZM5 19.5h14V21H5v-1.5Z" />
    </svg>
  )
}
