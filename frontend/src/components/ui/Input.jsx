import { Field, controlClass } from './Field'
import { cn } from '../../lib/cn'

export function Input({ label, hint, error, required, className, inputClassName, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, invalid, describedBy }) => (
        <input
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass(invalid), 'h-10', inputClassName)}
          {...props}
        />
      )}
    </Field>
  )
}
