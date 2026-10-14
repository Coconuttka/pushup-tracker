const pad = (value: number) => String(value).padStart(2, '0')

export function dayKey(value: Date | number): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function startOfDay(value: Date | number): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(value: Date, amount: number): Date {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

export function startOfWeek(value: Date): Date {
  const date = startOfDay(value)
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function dayOrdinal(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function isoWeekLabel(date: Date): string {
  const thursday = addDays(startOfWeek(date), 3)
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3)
  const week =
    Math.round((dayOrdinal(dayKey(thursday)) - dayOrdinal(dayKey(firstThursday))) / 7) + 1
  return `${thursday.getFullYear()} · W${pad(week)}`
}

export function displayDate(
  key: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return fromDayKey(key).toLocaleDateString(undefined, options)
}

export function relativeDay(key: string, now: Date): string {
  if (key === dayKey(now)) return 'Today'
  if (key === dayKey(addDays(now, -1))) return 'Yesterday'
  return displayDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
