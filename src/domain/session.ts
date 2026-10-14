export interface Session {
  id: string
  createdAt: number
  reps: number
}

export const MAX_REPS = 1_000_000
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_SESSIONS = 100_000

export function validateReps(reps: number): void {
  if (!Number.isSafeInteger(reps) || reps < 1 || reps > MAX_REPS) {
    throw new Error(`Enter a whole number between 1 and ${MAX_REPS.toLocaleString()}.`)
  }
}

export function validateSession(value: unknown): Session {
  if (typeof value !== 'object' || value === null) throw new Error('A session must be an object.')
  const session = value as Record<string, unknown>
  if (
    typeof session.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(session.id)
  ) {
    throw new Error('Each session needs a valid UUID.')
  }
  if (
    typeof session.createdAt !== 'number' ||
    !Number.isSafeInteger(session.createdAt) ||
    session.createdAt < 0 ||
    session.createdAt > 253402300799999
  ) {
    throw new Error('Each session needs a valid timestamp in milliseconds (1970–9999).')
  }
  if (typeof session.reps !== 'number') throw new Error('Session reps must be a number.')
  validateReps(session.reps)
  return { id: session.id.toLowerCase(), createdAt: session.createdAt, reps: session.reps }
}

export function createSession(reps: number, now = Date.now(), id = crypto.randomUUID()): Session {
  return validateSession({ id, createdAt: now, reps })
}

export function historicalTimestamp(date: string, time: string, now = Date.now()): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Choose a valid date and time for your session.')
  }
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const value = new Date(year, month - 1, day, hour, minute)
  if (
    year < 1970 ||
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute ||
    value.getTime() < 0
  ) {
    throw new Error('Choose a valid date and time that exists in your local timezone.')
  }
  if (value.getTime() > now) {
    throw new Error('Choose a date and time in the past or now. Future sessions cannot be logged.')
  }
  return value.getTime()
}

export function sameSession(a: Session, b: Session): boolean {
  return a.id === b.id && a.createdAt === b.createdAt && a.reps === b.reps
}
