import { cn } from '../../lib/cn'

/** White card. Optional title + actions header. padding={false} for edge-to-edge tables. */
export function Card({ title, actions, padding = true, className, children, ...props }) {
  return (
    <section className={cn('rounded-card bg-surface shadow-card', padding && 'p-6', className)} {...props}>
      {(title || actions) && (
        <header className={cn('mb-4 flex items-center justify-between gap-3', !padding && 'px-6 pt-6')}>
          {title && <h2 className="text-lg">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
