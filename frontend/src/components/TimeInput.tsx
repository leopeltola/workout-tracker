import { forwardRef, useState } from 'react'

interface TimeInputProps {
  value: number | null
  onChange: (value: number | null) => void
  ariaLabel: string
}

const STEP = 5

function fmt(seconds: number | null): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s)
}

function parse(raw: string): number | null {
  const parts = raw.split(':').map((p) => p.trim())
  if (parts.some((p) => p === '')) return null
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null
    return m * 60 + s
  }
  if (parts.length === 1) {
    const n = parseInt(parts[0], 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  return null
}

function clamp(n: number): number {
  return Math.max(0, n)
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  function TimeInput({ value, onChange, ariaLabel }, ref) {
    const [draft, setDraft] = useState<string | null>(null)
    const display = draft ?? fmt(value)

    function commit(seconds: number | null) {
      setDraft(null)
      onChange(seconds)
    }

    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`${ariaLabel}: minus`}
          onClick={() => commit(clamp((value ?? 0) - STEP))}
          className="flex h-9 w-8 items-center justify-center rounded-lg text-lg text-graphite-300 transition active:bg-graphite-700"
        >
          −
        </button>
        <input
          ref={ref}
          inputMode="numeric"
          aria-label={ariaLabel}
          value={display}
          placeholder="–"
          onFocus={() => setDraft(fmt(value))}
          onChange={(e) => {
            setDraft(e.target.value)
            const parsed = parse(e.target.value)
            if (parsed !== null) onChange(parsed)
          }}
          onBlur={() => {
            const parsed = parse(draft ?? '')
            commit(parsed === null ? null : clamp(parsed))
          }}
          className="h-9 w-16 rounded-lg border border-graphite-700 bg-graphite-900 text-center text-base font-semibold text-graphite-50 caret-accent-400 focus:border-accent-500"
        />
        <button
          type="button"
          aria-label={`${ariaLabel}: plus`}
          onClick={() => commit(clamp((value ?? 0) + STEP))}
          className="flex h-9 w-8 items-center justify-center rounded-lg text-lg text-graphite-300 transition active:bg-graphite-700"
        >
          +
        </button>
      </div>
    )
  },
)
