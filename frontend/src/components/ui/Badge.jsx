import { cn } from '../../lib/cn'

const VARIANTS = {
  brand: 'bg-tint text-primary-ink',
  neutral: 'bg-surface-3 text-muted',
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  info: 'bg-info-bg text-info-text',
  solid: 'bg-danger text-on-primary', // only for "Critical"
}

export function Badge({ variant = 'brand', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        VARIANTS[variant],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-pill bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

/* ---- App-specific badges: one place that maps ticket data to colors ---- */

const STATUS = {
  Open: 'info',
  'In Progress': 'warning',
  Resolved: 'success',
  Closed: 'neutral',
}

export function StatusBadge({ status }) {
  return <Badge variant={STATUS[status] ?? 'neutral'} dot>{status}</Badge>
}

const PRIORITY = {
  Critical: 'solid',
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
}

export function PriorityBadge({ priority }) {
  return <Badge variant={PRIORITY[priority] ?? 'neutral'}>{priority ?? 'Unscored'}</Badge>
}
