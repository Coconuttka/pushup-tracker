import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { PushupDatabase, SessionStore } from './data/store'

vi.mock('./components/ActivityChart', () => ({ default: () => <div>Activity chart</div> }))

let database: PushupDatabase
let store: SessionStore
beforeEach(() => {
  database = new PushupDatabase(`ui-${crypto.randomUUID()}`)
  store = new SessionStore(database)
})
afterEach(async () => {
  await database.delete()
})

async function start() {
  const user = userEvent.setup()
  render(<App store={store} />)
  await waitFor(() =>
    expect(screen.queryByText('Opening your workout journal…')).not.toBeInTheDocument(),
  )
  return user
}

describe('session workflow', () => {
  it('starts at zero, prevents negative counts and saves one session', async () => {
    const user = await start()
    expect(screen.getByRole('button', { name: 'Save 0 push-ups' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subtract 1 push-up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '+10' }))
    await user.click(screen.getByRole('button', { name: 'Add 1 push-up' }))
    await user.click(screen.getByRole('button', { name: 'Subtract 1 push-up' }))
    expect(screen.getByLabelText('Current session reps')).toHaveTextContent('10')
    await user.click(screen.getByRole('button', { name: 'Save 10 push-ups' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Current session reps')).toHaveTextContent(/^0$/),
    )
    expect(await database.sessions.count()).toBe(1)
    expect((await database.sessions.toArray())[0].reps).toBe(10)
    await waitFor(() =>
      expect(screen.getByLabelText('Today’s summary')).toHaveTextContent('1 session logged'),
    )
  })

  it('blocks double taps while persisting and resets only after success', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const actual = store.create.bind(store)
    const spy = vi.spyOn(store, 'create').mockImplementation(async (reps) => {
      await gate
      return actual(reps)
    })
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+20' }))
    const save = screen.getByRole('button', { name: 'Save 20 push-ups' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Current session reps')).toHaveTextContent('20')
    expect(screen.getByRole('button', { name: 'Add 1 push-up' })).toBeDisabled()
    await act(async () => {
      release()
      await gate
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save 0 push-ups' })).toBeDisabled(),
    )
    expect(await database.sessions.count()).toBe(1)
  })

  it('retains the count after a storage error and permits a successful retry', async () => {
    vi.spyOn(store, 'create').mockRejectedValueOnce(new Error('Quota exceeded'))
    const user = await start()
    await user.click(screen.getByRole('button', { name: '+5' }))
    await user.click(screen.getByRole('button', { name: 'Save 5 push-ups' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your count is still here')
    expect(screen.getByLabelText('Current session reps')).toHaveTextContent('5')
    expect(await database.sessions.count()).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Save 5 push-ups' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Current session reps')).toHaveTextContent(/^0$/),
    )
    expect(await database.sessions.count()).toBe(1)
  })

  it('edits history, confirms deletion and updates totals reactively', async () => {
    await store.create(20)
    const user = await start()
    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: /^Edit 20 push-up session/ }))
    const input = screen.getByRole('spinbutton', { name: 'Push-ups' })
    await user.clear(input)
    await user.type(input, '35')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await database.sessions.toArray())[0].reps).toBe(35)
    await waitFor(() => expect(screen.getByLabelText('Today’s summary')).toHaveTextContent('35'))
    await user.click(screen.getByRole('button', { name: /^Delete 35 push-up session/ }))
    expect(await database.sessions.count()).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Keep session' }))
    expect(await database.sessions.count()).toBe(1)
    await user.click(screen.getByRole('button', { name: /^Delete 35 push-up session/ }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete session' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await database.sessions.count()).toBe(0)
    await waitFor(() =>
      expect(screen.getByLabelText('Today’s summary')).toHaveTextContent('0 sessions logged'),
    )
  })
})
