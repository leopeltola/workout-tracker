export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const base = parseISO(iso)
  return toISO(new Date(base.getFullYear(), base.getMonth(), base.getDate() + n))
}

export function isValidISO(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return !Number.isNaN(parseISO(s).getTime())
}

export function fmtLong(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function fmtShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
  })
}
