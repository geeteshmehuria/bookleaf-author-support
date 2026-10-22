import { CircleCheck, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '../../lib/cn'

export const ALERT_STYLES = {
  info: { bg: 'bg-info-bg', bar: 'border-info', title: 'text-info-text', Icon: Info },
  success: { bg: 'bg-success-bg', bar: 'border-success', title: 'text-success-text', Icon: CircleCheck },
  warning: { bg: 'bg-warning-bg', bar: 'border-warning', title: 'text-warning-text', Icon: TriangleAlert },
  danger: { bg: 'bg-danger-bg', bar: 'border-danger', title: 'text-danger-text', Icon: CircleAlert },
}

/** Inline message, e.g. "AI unavailable — write the reply manually". */
export function Alert({ variant = 'info', title, onClose, className, children }) {
  const s = ALERT_STYLES[variant]
  const urgent = variant === 'danger' || variant === 'warning'
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-input border-l-4 p-4 text-sm', s.bg, s.bar, className)}
    >
      <s.Icon className={cn('mt-0.5 size-5 shrink-0', s.title)} aria-hidden="true" />
      <div className="flex-1">
        {title && <p className={cn('font-bold', s.title)}>{title}</p>}
        {children && <div className="text-text">{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-m-1 h-fit rounded-sm p-1 text-muted hover:bg-surface/60"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
