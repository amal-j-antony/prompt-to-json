import { useCallback, useMemo, useState } from 'react'
import { History as HistoryIcon, RotateCcw } from 'lucide-react'
import { compileBrief } from './brief/compile'
import { FIELD_REGISTRY } from './brief/registry'
import type { HistoryEntry } from './history/entry'
import { useAuth } from './state/useAuth'
import { useBriefDraft } from './state/useBriefDraft'
import { HISTORY_WRITE_ERROR, useHistory } from './state/useHistory'
import { useServerStatus } from './state/useServerStatus'
import { useTheme } from './state/useTheme'
import { AccountMenu } from './ui/AccountMenu'
import { AuthDialog } from './ui/AuthDialog'
import { BriefForm } from './ui/BriefForm'
import { Button } from './ui/Button'
import { HistoryDrawer } from './ui/HistoryDrawer'
import { OutputPanel } from './ui/OutputPanel'
import { ServerStatusPill } from './ui/ServerStatusPill'
import { ThemeToggle } from './ui/ThemeToggle'
import { Toast, type ToastAction } from './ui/Toast'

function CompletionMeter({ started }: { started: number }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={FIELD_REGISTRY.length}
      aria-valuenow={started}
      aria-label="Fields started"
      className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 py-1.5"
    >
      <span aria-hidden="true" className="flex items-center gap-1">
        {FIELD_REGISTRY.map((spec, index) => (
          <span
            key={spec.id}
            className={`h-1.5 w-4 rounded-full transition-colors duration-[160ms] ${
              index < started ? 'bg-accent' : 'bg-surface-3'
            }`}
          />
        ))}
      </span>
      <span className="whitespace-nowrap text-[11.5px] font-medium text-muted">
        {started} of {FIELD_REGISTRY.length} started
      </span>
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  const { user, status: authStatus, busy: authBusy } = auth
  const { status: serverStatus, check, reportWake } = useServerStatus()
  const { docs, setField, replace, reset, resetToken, started } = useBriefDraft()
  const { entries, source, loading, saving, save, remove, clear, error } = useHistory(
    user,
    authStatus === 'ready',
  )
  const { preference, setPreference } = useTheme()
  const compiled = useMemo(() => compileBrief(docs), [docs])
  const [toast, setToast] = useState<{
    id: number
    message: string
    action?: ToastAction
  } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const notify = useCallback((message: string, action?: ToastAction) => {
    setToast({ id: Date.now(), message, action })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const closeHistory = useCallback(() => setHistoryOpen(false), [])

  const closeAuth = useCallback(() => setAuthOpen(false), [])

  const handleSave = useCallback(async () => {
    if (!compiled.ok) return

    const outcome = await save(docs, {
      onRetry: () => {
        notify('Server is waking up. Retrying save.')
        reportWake()
      },
    })

    if (outcome === 'saved') notify('Saved to history.')
    else if (outcome === 'duplicate') notify('This brief is already the newest save.')
    else if (source === 'account') {
      notify('Save failed. Try again.')
      reportWake()
    } else notify(HISTORY_WRITE_ERROR)
  }, [compiled, docs, notify, reportWake, save, source])

  const handleLoad = useCallback(
    (entry: HistoryEntry) => {
      replace(entry.docs)
      setHistoryOpen(false)
      notify('Saved brief loaded.')
    },
    [notify, replace],
  )

  const handleReset = () => {
    if (!window.confirm('Clear all four fields and the autosaved draft?')) return
    reset()
    notify('Draft cleared.')
  }

  const handleSignedIn = useCallback(() => {
    setAuthOpen(false)
    notify('Signed in.')
  }, [notify])

  const handleSignOut = useCallback(async () => {
    const signedOut = await auth.logout()
    if (signedOut) notify('Signed out.')
  }, [auth, notify])

  const handleHistorySignIn = useCallback(() => {
    setHistoryOpen(false)
    setAuthOpen(true)
  }, [])

  return (
    <div className="app-backdrop min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-accent-line bg-accent-soft font-mono text-[13px] font-semibold text-accent"
            >
              {'{}'}
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-ink">
                Prompt Studio
              </h1>
              <p className="hidden text-[12px] leading-4 text-muted sm:block">
                Four fields in. One agent-ready brief out.
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <div className="hidden lg:block">
              <CompletionMeter started={started} />
            </div>
            <ServerStatusPill status={serverStatus} onCheck={check} />
            <AccountMenu
              key={user?.id ?? 'guest'}
              user={user}
              busy={authBusy}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={handleSignOut}
            />
            <Button
              variant="secondary"
              size="sm"
              aria-haspopup="dialog"
              aria-expanded={historyOpen}
              aria-label={`History, ${entries.length} saved ${
                entries.length === 1 ? 'brief' : 'briefs'
              }`}
              onClick={() => setHistoryOpen(true)}
              className="gap-1.5"
            >
              <HistoryIcon aria-hidden="true" size={14} />
              <span className="hidden xl:inline">History</span>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[10.5px] font-semibold leading-4 text-muted">
                {entries.length}
              </span>
            </Button>
            <ThemeToggle preference={preference} onChange={setPreference} />
            <Button
              variant="secondary"
              size="sm"
              title="Clear the draft"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw aria-hidden="true" size={14} />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <BriefForm
            docs={docs}
            issues={started > 0 ? compiled.issues : []}
            resetToken={resetToken}
            onChange={setField}
            onNotify={notify}
          />

          <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start">
            <OutputPanel
              compiled={compiled}
              saving={saving}
              onNotify={notify}
              onSave={handleSave}
            />
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-4 text-[11.5px] leading-5 text-subtle">
          <p>
            {user
              ? 'Saved briefs sync to your account. The draft stays in this browser.'
              : 'Stored in this browser. Nothing is sent anywhere.'}
          </p>
          <p>Paste the JSON into your coding agent.</p>
        </footer>
      </main>

      {historyOpen ? (
        <HistoryDrawer
          entries={entries}
          source={source}
          loading={loading}
          error={error}
          signedIn={user !== null}
          onSignIn={handleHistorySignIn}
          onClose={closeHistory}
          onLoad={handleLoad}
          onDelete={remove}
          onClear={clear}
        />
      ) : null}

      {authOpen ? (
        <AuthDialog auth={auth} onClose={closeAuth} onSignedIn={handleSignedIn} />
      ) : null}

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          action={toast.action}
          onDismiss={dismissToast}
        />
      ) : null}
    </div>
  )
}
