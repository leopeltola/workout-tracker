import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useDebounce } from '../hooks/useDebounce'
import { createLog, getExercises } from '../lib/client'
import type { Exercise, Log } from '../lib/types'

interface AddExerciseBarProps {
  date: string
  onAdded: (log: Log) => void
}

interface Suggestion extends Exercise {
  isNew?: boolean
}

export function AddExerciseBar({ date, onAdded }: AddExerciseBarProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const debounced = useDebounce(value.trim(), 200)

  const matches = useQuery({
    queryKey: ['exercises', 'search', debounced],
    queryFn: () => getExercises({ q: debounced, limit: 6 }),
    enabled: focused && debounced.length > 0,
    staleTime: 60 * 1000,
  })

  const recents = useQuery({
    queryKey: ['exercises', 'recent'],
    queryFn: () => getExercises({ limit: 6 }),
    enabled: focused && debounced.length === 0,
    staleTime: 60 * 1000,
  })

  const add = useMutation({
    mutationFn: (name: string) => createLog({ log_date: date, exercise_name: name }),
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: ['logs', date] })
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      setValue('')
      setActiveIndex(0)
      onAdded(log)
    },
  })

  const suggestions: Suggestion[] = (() => {
    if (debounced.length > 0) {
      const list: Suggestion[] = matches.data ?? []
      const exact = list.some((e) => e.name.toLowerCase() === debounced.toLowerCase())
      if (!exact) list.unshift({ id: 0, name: debounced, muscle_group: null, isNew: true })
      return list
    }
    return (recents.data ?? []).map((e) => ({ ...e }))
  })()

  const open = focused && suggestions.length > 0

  function pick(suggestion: Suggestion) {
    add.mutate(suggestion.name)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = suggestions[activeIndex] ?? suggestions[0]
      if (target) pick(target)
      else if (value.trim()) add.mutate(value.trim())
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative px-4 pb-3 pt-1">
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-graphite-850 px-3 py-2.5 transition-colors ${
          focused ? 'border-accent-500 ring-2 ring-accent-500/20' : 'border-graphite-700'
        }`}
      >
        <PlusIcon className="h-5 w-5 shrink-0 text-graphite-400" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setActiveIndex(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          enterKeyHint="go"
          autoCapitalize="words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Add exercise"
          className="w-full bg-transparent text-base text-graphite-50 placeholder:text-graphite-500"
        />
        {add.isPending && (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-graphite-600 border-t-accent-500" />
        )}
      </div>

      {open && (
        <div className="absolute inset-x-4 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-graphite-700 bg-graphite-850 shadow-xl">
          {debounced.length === 0 && (
            <p className="px-4 pt-2 text-[11px] font-medium uppercase tracking-wider text-graphite-500">
              Recent
            </p>
          )}
          <ul>
            {suggestions.map((s, i) => (
              <li key={s.isNew ? `new:${s.name}` : s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-graphite-100 ${
                    i === activeIndex ? 'bg-graphite-700' : ''
                  }`}
                >
                  {s.isNew ? (
                    <>
                      <PlusIcon className="h-4 w-4 shrink-0 text-accent-400" />
                      <span>
                        Create{' '}
                        <span className="font-semibold text-accent-400">“{s.name}”</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <DumbbellIcon className="h-4 w-4 shrink-0 text-graphite-500" />
                      <span className="font-medium">{s.name}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43Z" />
    </svg>
  )
}
