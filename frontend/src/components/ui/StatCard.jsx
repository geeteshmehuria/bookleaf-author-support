import { cn } from '../../lib/cn'

/** Big coral number + muted label. value should be pre-formatted (e.g. "₹3,570"). */
export function StatCard({ value, label, hint, className }) {
  return (
    <div className={cn('rounded-card bg-surface p-5 shadow-card', className)}>
      <p className="text-3xl font-extrabold leading-none text-accent">{value}</p>
      <p className="mt-2 text-sm text-muted">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
