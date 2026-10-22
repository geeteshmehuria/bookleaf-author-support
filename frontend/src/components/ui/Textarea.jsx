import { Field, controlClass } from './Field'
import { cn } from '../../lib/cn'

export function Textarea({ label, hint, error, required, rows = 5, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, invalid, describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass(invalid), 'py-2 leading-relaxed resize-y')}
          {...props}
        />
      )}
    </Field>
  )
}
