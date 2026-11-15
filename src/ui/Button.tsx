import type { ComponentPropsWithRef } from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'icon'
  | 'icon-danger'

export type ButtonSize = 'sm' | 'md' | 'icon'

const BASE =
  'action-control inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'rounded-[10px] bg-accent text-on-accent shadow-sm active:scale-[0.98] enabled:hover:bg-accent-hover enabled:hover:shadow-[0_8px_20px_-12px_var(--accent)]',
  secondary:
    'rounded-[10px] border border-line bg-surface text-ink active:scale-[0.98] enabled:hover:border-line-strong enabled:hover:bg-surface-3',
  soft:
    'rounded-[10px] border border-accent-line bg-accent-soft text-accent active:scale-[0.98] enabled:hover:border-accent enabled:hover:bg-surface-3',
  ghost:
    'rounded-lg text-muted active:scale-[0.98] enabled:hover:bg-surface-3 enabled:hover:text-ink',
  danger:
    'rounded-[10px] border border-line bg-surface text-muted active:scale-[0.98] enabled:hover:border-warn-line enabled:hover:bg-warn-soft enabled:hover:text-warn',
  icon:
    'rounded-lg text-muted active:scale-90 enabled:hover:bg-surface-3 enabled:hover:text-ink',
  'icon-danger':
    'rounded-lg text-subtle active:scale-90 enabled:hover:bg-warn-soft enabled:hover:text-warn',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-9 px-3 text-[13px]',
  icon: 'h-8 w-8',
}

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ''}`}
      {...props}
    />
  )
}
