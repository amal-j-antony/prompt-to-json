import { LogOut, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { UserDto } from '../../shared/api'
import { Button } from './Button'

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
      <Button variant="secondary" size="sm" aria-label="Sign in" onClick={onSignIn} className="gap-1.5">
        <User aria-hidden="true" size={14} />
        <span className="hidden whitespace-nowrap sm:inline">Sign in</span>
      </Button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.email} account menu`}
        onClick={() => setOpen((value) => !value)}
        className="max-w-[13rem] gap-1.5"
      >
        <User aria-hidden="true" size={14} className="shrink-0" />
        <span className="hidden min-w-0 truncate xl:inline">{user.email}</span>
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-float"
        >
          <p className="truncate px-2.5 py-2 text-[11.5px] leading-4 text-subtle">{user.email}</p>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className="w-full justify-start px-2.5 py-1.5 text-[12.5px] text-ink"
          >
            <LogOut aria-hidden="true" size={14} />
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  )
}
