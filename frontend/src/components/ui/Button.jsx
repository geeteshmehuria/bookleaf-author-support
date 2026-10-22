import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary:
    'bg-primary-strong text-on-primary hover:bg-primary-hover active:bg-primary-ink',
  secondary:
    'bg-surface text-primary-ink border border-primary-strong hover:bg-tint active:bg-tint-2',
  ghost: 'bg-transparent text-text hover:bg-surface-3 active:bg-border',
  // Outlined by default so it never looks like the coral primary button;
  // fills red on hover to confirm the destructive intent.
  danger:
    'bg-surface text-danger-text border border-danger hover:bg-danger hover:text-on-primary',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-[52px] px-8 text-base gap-2', // login / CTA only
}

const SHAPES = {
  pill: 'rounded-pill', // CTA, login
  rounded: 'rounded-sm', // dense admin toolbars
}

/** Same classes as <Button>, for links that should look like buttons: <Link className={buttonClass({...})}> */
export const buttonClass = ({ variant = 'primary', size = 'md', shape = 'rounded', className } = {}) =>
  cn(
    'inline-flex items-center justify-center whitespace-nowrap font-cta font-medium',
    'transition-colors duration-150 select-none no-underline',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    SHAPES[shape],
    className,
  )

/**
 * <Button variant="primary|secondary|ghost|danger" size="sm|md|lg" shape="pill|rounded" loading />
 */
export function Button({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, shape, className })}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
