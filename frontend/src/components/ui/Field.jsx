import { useId } from 'react'
import { cn } from '../../lib/cn'

/** Shared look for Input / Select / Textarea. */
export const controlClass = (invalid) =>
  cn(
    'w-full rounded-input border bg-surface px-3 text-sm text-text',
    'placeholder:text-muted transition-colors duration-150',
    'focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-muted',
    invalid
      ? 'border-danger focus:border-danger focus:ring-danger/30'
      : 'border-border-strong focus:border-primary-strong focus:ring-primary/30',
  )

/**
 * Label + control + hint/error. Wires up id, aria-invalid and aria-describedby.
 * children is a render function: ({ id, invalid, describedBy }) => <input ... />
 */
export function Field({ label, hint, error, required, className, children }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
          {required && <span className="ml-0.5 text-danger-text" aria-hidden="true">*</span>}
        </label>
      )}
      {children({ id, invalid: Boolean(error), describedBy })}
      {error ? (
        <p id={errorId} className="text-xs font-semibold text-danger-text">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
