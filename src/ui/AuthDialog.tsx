import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthController } from '../state/useAuth'
import { useDialog } from './useDialog'

type AuthTab = 'signin' | 'signup'

const TAB_ORDER: readonly AuthTab[] = ['signin', 'signup']

const TAB_LABELS: Record<AuthTab, string> = {
  signin: 'Sign in',
  signup: 'Create account',
}

const BUSY_LABELS: Record<AuthTab, string> = {
  signin: 'Signing in...',
  signup: 'Creating account...',
}

interface AuthDialogProps {
  auth: AuthController
  onClose(): void
  onSignedIn(): void
}

export function AuthDialog({ auth, onClose, onSignedIn }: AuthDialogProps) {
  const [tab, setTab] = useState<AuthTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const { panelRef, onBackdropClick } = useDialog({ onClose, initialFocusRef: emailRef })
  const { clearError } = auth

  useEffect(() => {
    clearError()
  }, [clearError, tab])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const accepted =
      tab === 'signin'
        ? await auth.login(email, password)
        : await auth.signup(email, password)
    if (accepted) onSignedIn()
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4" onClick={onBackdropClick}>
      <div
        aria-hidden="true"
        className="drawer-backdrop pointer-events-none absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="toast-rise relative w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-float"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0">
            <h2
              id="auth-title"
              className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
            >
              {TAB_LABELS[tab]}
            </h2>
            <p className="mt-0.5 text-[12px] leading-4 text-muted">
              Sync saved briefs across devices.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close sign in"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-ink"
          >
            <X aria-hidden="true" size={15} />
          </button>
        </header>

        <div role="tablist" aria-label="Account action" className="mt-4 flex gap-4 border-b border-line">
          {TAB_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls="auth-panel"
              onClick={() => setTab(value)}
              className={`-mb-px border-b-2 pb-2 text-[12.5px] font-medium transition-colors duration-[160ms] ${
                tab === value ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {TAB_LABELS[value]}
            </button>
          ))}
        </div>

        <form id="auth-panel" role="tabpanel" aria-label={TAB_LABELS[tab]} onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium leading-4 text-muted">Email</span>
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={auth.busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[13px] text-ink placeholder:text-subtle disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium leading-4 text-muted">Password</span>
            <input
              type="password"
              name="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              maxLength={200}
              disabled={auth.busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-[13px] text-ink placeholder:text-subtle disabled:opacity-60"
            />
          </label>

          {auth.error ? (
            <p
              role="alert"
              className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-5 text-warn"
            >
              {auth.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={auth.busy}
            className="inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-accent px-3 text-[13px] font-medium text-on-accent transition-colors duration-[160ms] hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-45"
          >
            {auth.busy ? BUSY_LABELS[tab] : TAB_LABELS[tab]}
          </button>
        </form>
      </div>
    </div>
  )
}
