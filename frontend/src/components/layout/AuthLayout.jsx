import { BookOpen } from 'lucide-react'

/** Login screen frame: pink grid background + centered 420px white card. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="bg-grid flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-card bg-surface p-8 shadow-pop sm:p-10">
        <Logo className="mb-8 justify-center" />
        {title && <h1 className="text-center text-2xl">{title}</h1>}
        {subtitle && <p className="mt-2 text-center text-lg font-light text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  )
}

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex size-9 items-center justify-center rounded-input bg-primary-strong text-on-primary">
        <BookOpen className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-text">
        Book<span className="text-primary-ink">Leaf</span>
      </span>
    </div>
  )
}
