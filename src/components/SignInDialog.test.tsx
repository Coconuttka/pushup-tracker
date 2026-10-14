import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DXCUserInteraction } from 'dexie-cloud-addon'
import { SignInDialog } from './SignInDialog'

function prompt(type: 'email' | 'otp'): DXCUserInteraction {
  return {
    type,
    title: 'Sign in',
    alerts: [],
    fields:
      type === 'email'
        ? { email: { type: 'text', placeholder: '' } }
        : { otp: { type: 'text', label: '' } },
    submitLabel: 'Submit',
    cancelLabel: 'Cancel',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  } as DXCUserInteraction
}
describe('email code sign in', () => {
  it('normalizes email and prevents duplicate submissions', async () => {
    const interaction = prompt('email')
    const user = userEvent.setup()
    render(<SignInDialog interaction={interaction} />)
    await user.type(screen.getByLabelText('Email address'), 'First@Example.com')
    await user.dblClick(screen.getByRole('button', { name: 'Send sign-in code' }))
    expect(interaction.onSubmit).toHaveBeenCalledExactlyOnceWith({ email: 'first@example.com' })
  })
  it('permits retry after another invalid-code interaction', async () => {
    const user = userEvent.setup()
    const first = prompt('otp')
    const { rerender } = render(<SignInDialog interaction={first} />)
    await user.type(screen.getByLabelText('One-time code'), 'badcode')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    const second = {
      ...prompt('otp'),
      alerts: [
        {
          type: 'error',
          messageCode: 'INVALID_OTP',
          message: 'Try another code.',
          messageParams: {},
        },
      ],
    } as DXCUserInteraction
    rerender(<SignInDialog interaction={second} />)
    expect(screen.getByLabelText('One-time code')).toBeEnabled()
    await user.clear(screen.getByLabelText('One-time code'))
    await user.type(screen.getByLabelText('One-time code'), 'correct')
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }))
    expect(second.onSubmit).toHaveBeenCalledExactlyOnceWith({ otp: 'correct' })
  })
  it('never offers to discard unsynced changes during sign out', async () => {
    const user = userEvent.setup()
    const interaction = {
      ...prompt('otp'),
      type: 'logout-confirmation',
      fields: {},
    } as DXCUserInteraction
    render(<SignInDialog interaction={interaction} />)
    await user.click(screen.getByRole('button', { name: 'Stay signed in' }))
    expect(interaction.onCancel).toHaveBeenCalledOnce()
    expect(interaction.onSubmit).not.toHaveBeenCalled()
  })
})
