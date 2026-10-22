import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { Logo } from './AuthLayout'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

/**
 * Sidebar + top bar shell for both portals.
 *   area="author" → calm: white sidebar, roomy nav, content max 1024px
 *   area="admin"  → dense: grey sidebar, tighter nav, full-width content
 * navItems: [{ to, label, icon: LucideIcon, end?: bool }]
 * Below 768px the sidebar becomes a slide-in drawer.
 */
export function AppShell({ area = 'author', navItems, title, user, onLogout, actions, children }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const closeBtn = useRef(null)
  const admin = area === 'admin'

  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [location.pathname])

  // Drawer: Escape closes, focus moves inside, page behind doesn't scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const sidebar = (
    <nav aria-label={admin ? 'Admin navigation' : 'Author navigation'} className="flex flex-col gap-1 p-3">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-sm px-3 font-semibold transition-colors',
              admin ? 'py-2 text-sm' : 'py-2.5 text-[15px]',
              isActive
                ? 'bg-tint text-primary-ink before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-primary'
                : 'text-muted hover:bg-surface-3 hover:text-text',
            )
          }
        >
          {Icon && <Icon className="size-[18px] shrink-0" aria-hidden="true" />}
          {label}
        </NavLink>
      ))}
    </nav>
  )

  const sidebarBg = admin ? 'bg-surface-3' : 'bg-surface'

  return (
    <div className="flex min-h-dvh bg-surface-2">
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border md:flex', sidebarBg)}>
        <div className="flex h-14 items-center border-b border-border px-5">
          <Logo />
        </div>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className={cn('absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col shadow-pop', sidebarBg)}>
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Logo />
              <button
                ref={closeBtn}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-sm p-2 text-muted hover:bg-surface-3"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="-ml-2 rounded-sm p-2 text-muted hover:bg-surface-3 md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg">{title}</h1>
          {actions}
          {user && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm font-semibold">{user.name}</span>
              <Badge variant={admin ? 'neutral' : 'brand'}>{admin ? 'Admin' : 'Author'}</Badge>
            </div>
          )}
          {onLogout && (
            <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Log out">
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          )}
        </header>

        <main className={cn('w-full flex-1 px-4 py-6 md:px-6', !admin && 'mx-auto max-w-5xl md:py-8')}>
          {children}
        </main>
      </div>
    </div>
  )
}
