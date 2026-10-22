import { ChevronDown } from 'lucide-react'
import { Field, controlClass } from './Field'
import { cn } from '../../lib/cn'

/**
 * Native <select> (keyboard + screen-reader support for free).
 * options: [{ value, label }]  or pass <option> children.
 */
export function Select({ label, hint, error, required, options, placeholder, className, children, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, invalid, describedBy }) => (
        <div className="relative">
          <select
            id={id}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(controlClass(invalid), 'h-10 appearance-none pr-9')}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </div>
      )}
    </Field>
  )
}
