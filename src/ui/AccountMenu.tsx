import { LogOut, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UserDto } from '../../shared/api'

interface AccountMenuProps {
  user: UserDto | null
  busy: boolean
  onSignIn(): void
  onSignOut(): void
}

export function AccountMenu({ user, busy, onSignIn, onSignOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || !containerRef.current?.contains(target)) setOpen(false)
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!user) {
    return (
      <button
        type="button"
        aria-label="Sign in"
        onClick={onSignIn}
        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-ink"
      >
        <User aria-hidden="true" size={14} />
        <span className="hidden whitespace-nowrap sm:inline">Sign in</span>
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.email} account menu`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 max-w-[13rem] items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-ink"
      >
        <User aria-hidden="true" size={14} className="shrink-0" />
        <span className="hidden min-w-0 truncate xl:inline">{user.email}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-float"
        >
          <p className="truncate px-2.5 py-2 text-[11.5px] leading-4 text-subtle">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-medium text-ink transition-colors duration-[160ms] hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-45"
          >
            <LogOut aria-hidden="true" size={14} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
