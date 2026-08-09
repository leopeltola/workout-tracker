import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { AddExerciseBar } from '../components/AddExerciseBar'
import { DateStrip } from '../components/DateStrip'
import { ExerciseCard } from '../components/ExerciseCard'
import { useMe } from '../hooks/useMe'
import { api } from '../lib/api'
import { getLogs } from '../lib/client'
import { fmtLong, isValidISO, todayISO } from '../lib/dates'

export function DayPage() {
  const { date: dateParam } = useParams()
  const navigate = useNavigate()
  const me = useMe()
  const today = me.data?.today ?? todayISO()
  const date = isValidISO(dateParam) ? dateParam : today

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', date],
    queryFn: () => getLogs(date),
  })

  const [focusId, setFocusId] = useState<number | null>(null)

  useEffect(() => {
    setFocusId(null)
  }, [date])

  const isToday = date === today

  return (
    <div className="min-h-dvh bg-graphite-950">
      <div className="mx-auto max-w-md">
        <div className="sticky top-0 z-30 border-b border-graphite-800 bg-graphite-950/95 backdrop-blur safe-top">
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <h1 className="text-xl font-bold tracking-tight text-graphite-50">
              {isToday ? 'Today' : fmtLong(date)}
            </h1>
            <AvatarMenu />
          </div>
          <DateStrip date={date} onSelect={(iso) => navigate(`/date/${iso}`)} />
          <AddExerciseBar
            date={date}
            onAdded={(log) => setFocusId(log.id)}
          />
        </div>

        <main className="px-4 pb-28">
          {isLoading ? (
            <div className="space-y-3 pt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-graphite-850" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3 pt-4">
              {logs.map((log) => (
                <ExerciseCard
                  key={log.id}
                  log={log}
                  focusRequested={focusId === log.id}
                  onFocusDone={() => setFocusId(null)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center pt-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-graphite-850">
        <DumbbellIcon className="h-7 w-7 text-graphite-500" />
      </div>
      <p className="mt-3 font-medium text-graphite-200">Nothing logged yet.</p>
      <p className="mt-1 text-sm text-graphite-500">
        Tap the field above to add your first exercise.
      </p>
    </div>
  )
}

function AvatarMenu() {
  const { data: me } = useMe()
  const [open, setOpen] = useState(false)

  if (!me) return null

  async function signOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite-800 text-sm font-semibold text-graphite-200 ring-1 ring-graphite-700"
      >
        {me.user.avatar_url ? (
          <img src={me.user.avatar_url} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          me.user.username.charAt(0).toUpperCase()
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-graphite-700 bg-graphite-850 p-1 shadow-2xl">
            <p className="truncate px-3 py-2 text-sm font-medium text-graphite-100">
              {me.user.username}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-graphite-300 transition hover:bg-graphite-700"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43Z" />
    </svg>
  )
}
