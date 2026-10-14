import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { FriendProgress } from './FriendProgress'
import { createSession } from '../domain/session'

beforeAll(async () => {
  await import('./ActivityChart')
})

describe('friend progress is view only', () => {
  it('shows totals and dated history without editing, deleting or adding controls', async () => {
    const now = new Date(2026, 9, 15, 14)
    const sessions = [
      createSession(25, now.getTime()),
      createSession(15, new Date(2026, 9, 14, 12).getTime()),
    ]
    render(
      <FriendProgress
        friend={{ id: 'friend@example.com', name: 'Friend', realmId: 'realm', sessions }}
        now={now}
      />,
    )
    const history = screen.getByRole('region', { name: 'Friend’s session history' })
    expect(within(history).getByText('Today')).toBeVisible()
    expect(within(history).getByText('Yesterday')).toBeVisible()
    expect(within(history).getByText('25')).toBeVisible()
    expect(screen.getByText('2 day streak')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Edit|Delete|Add session/ }),
    ).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Friend’s activity' })).toBeVisible()
  })
})
