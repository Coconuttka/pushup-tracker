import type { Session } from '../domain/session'

export interface SessionRepository {
  list(): Promise<Session[]>
  create(reps: number, createdAt?: number): Promise<Session>
  createHistorical(reps: number, date: string, time: string): Promise<Session>
  edit(id: string, reps: number): Promise<void>
  remove(id: string): Promise<void>
  export(): Promise<string>
  import(text: string): Promise<{ imported: number; skipped: number }>
}
