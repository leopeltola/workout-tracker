import { useMemo, useRef, useEffect } from 'react'

import { addDays, fmtShort, parseISO, todayISO } from '../lib/dates'

interface DateStripProps {
  date: string
  onSelect: (iso: string) => void
}

export function DateStrip({ date, onSelect }: DateStripProps) {
  const today = todayISO()
  const days = useMemo(() => {
    const out: string[] = []
    for (let i = 13; i >= 0; i--) out.push(addDays(today, -i))
    return out
  }, [today])
  const refs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    refs.current.get(date)?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [date])

  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2">
      {days.map((iso) => {
        const selected = iso === date
        const isToday = iso === today
        const dayNum = parseISO(iso).getDate()
        return (
          <button
            key={iso}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(iso, el)
            }}
            onClick={() => onSelect(iso)}
            aria-pressed={selected}
            className={`flex min-w-12 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
              selected
                ? 'bg-accent-500 text-white'
                : 'bg-graphite-850 text-graphite-300 active:bg-graphite-700'
            }`}
          >
            <span className={`text-[10px] uppercase tracking-wide ${selected ? 'text-white/80' : 'text-graphite-500'}`}>
              {fmtShort(iso)}
            </span>
            <span className="text-base font-semibold leading-tight">{dayNum}</span>
            <span className={`h-1 w-1 rounded-full ${isToday ? 'bg-accent-300' : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}
