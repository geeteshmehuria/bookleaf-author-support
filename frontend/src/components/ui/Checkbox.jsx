import { useId } from 'react'
import { cn } from '../../lib/cn'

export function Checkbox({ label, className, ...props }) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="checkbox"
        className="size-4 cursor-pointer rounded-sm border-border-strong accent-primary-strong disabled:cursor-not-allowed"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-text select-none">{label}</label>
    </div>
  )
}
