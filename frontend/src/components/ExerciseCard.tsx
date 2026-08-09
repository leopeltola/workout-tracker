import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteLog, updateLog } from '../lib/client'
import type { Log, SetData } from '../lib/types'
import { StepperInput } from './StepperInput'

interface ExerciseCardProps {
  log: Log
  focusRequested: boolean
  onFocusDone: () => void
}

const SAVE_DELAY = 500

export function ExerciseCard({ log, focusRequested, onFocusDone }: ExerciseCardProps) {
  const queryClient = useQueryClient()
  const [sets, setSets] = useState<SetData[]>(log.sets)
  const [dirty, setDirty] = useState(false)
  const weightRef = useRef<HTMLInputElement>(null)
  const firstFocusDone = useRef(false)

  const save = useMutation({
    mutationFn: (payload: SetData[]) => updateLog(log.id, payload),
    onSuccess: (saved) => {
      queryClient.setQueryData<Log[]>(['logs', log.log_date], (old) =>
        old?.map((l) => (l.id === log.id ? saved : l)),
      )
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
      setSets([{ set_number: 1, reps: null, weight_kg: null }])
      setDirty(false)
      return
    }
    firstFocusDone.current = true
    requestAnimationFrame(() => weightRef.current?.focus())
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
      const nextNumber = prev.reduce((max, s) => Math.max(max, s.set_number), 0) + 1
      return [...prev, { set_number: nextNumber, reps: null, weight_kg: null }]
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

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-850">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-graphite-50">
            {log.exercise_name}
          </h3>
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
          <div className="grid grid-cols-[2.5rem_1fr_1fr_2rem] items-center gap-2 border-b border-graphite-800 pb-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              Set
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              kg
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-graphite-500">
              Reps
            </span>
            <span />
          </div>
          <ul className="divide-y divide-graphite-800/60">
            {sets.map((set, i) => (
              <li
                key={set.id ?? `new-${i}-${set.set_number}`}
                className="grid grid-cols-[2.5rem_1fr_1fr_2rem] items-center gap-2 py-1.5"
              >
                <span className="text-sm font-medium text-graphite-400">{set.set_number}</span>
                <StepperInput
                  ref={i === 0 ? weightRef : undefined}
                  value={set.weight_kg}
                  onChange={(v) => updateSet(i, { weight_kg: v })}
                  step={2.5}
                  decimals={1}
                  ariaLabel={`${log.exercise_name} set ${set.set_number} weight`}
                />
                <StepperInput
                  value={set.reps}
                  onChange={(v) => updateSet(i, { reps: v })}
                  step={1}
                  ariaLabel={`${log.exercise_name} set ${set.set_number} reps`}
                />
                <button
                  type="button"
                  aria-label={`Delete set ${set.set_number}`}
                  onClick={() => removeSet(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-graphite-500 transition active:bg-graphite-700 active:text-graphite-300"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
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
