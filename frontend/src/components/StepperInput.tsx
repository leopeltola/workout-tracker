import { forwardRef } from 'react'

interface StepperInputProps {
  value: number | null
  onChange: (value: number | null) => void
  step: number
  decimals?: number
  ariaLabel: string
}

export const StepperInput = forwardRef<HTMLInputElement, StepperInputProps>(
  function StepperInput({ value, onChange, step, decimals = 0, ariaLabel }, ref) {
    const display = value == null ? '' : String(value)

    function clamp(n: number): number {
      return Math.max(0, Math.round(n * 10) / 10)
    }

    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`${ariaLabel}: minus`}
          onClick={() => onChange(clamp((value ?? 0) - step))}
          className="flex h-9 w-8 items-center justify-center rounded-lg text-lg text-graphite-300 transition active:bg-graphite-700"
        >
          −
        </button>
        <input
          ref={ref}
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          aria-label={ariaLabel}
          value={display}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              onChange(null)
              return
            }
            const n = decimals > 0 ? parseFloat(raw) : parseInt(raw, 10)
            if (Number.isFinite(n) && n >= 0) onChange(n)
          }}
          placeholder="–"
          className="h-9 w-14 rounded-lg border border-graphite-700 bg-graphite-900 text-center text-base font-semibold text-graphite-50 caret-accent-400 focus:border-accent-500"
        />
        <button
          type="button"
          aria-label={`${ariaLabel}: plus`}
          onClick={() => onChange(clamp((value ?? 0) + step))}
          className="flex h-9 w-8 items-center justify-center rounded-lg text-lg text-graphite-300 transition active:bg-graphite-700"
        >
          +
        </button>
      </div>
    )
  },
)
