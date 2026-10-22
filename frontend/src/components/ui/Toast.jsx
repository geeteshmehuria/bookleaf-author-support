import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ALERT_STYLES } from './Alert'
import { cn } from '../../lib/cn'

const ToastContext = createContext(null)

/**
 * Wrap the app once: <ToastProvider><App/></ToastProvider>
 * Then anywhere: const { toast } = useToast(); toast({ variant: 'success', title: 'Reply sent' })
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    ({ variant = 'info', title, description, duration = 4000 }) => {
      const id = ++nextId.current
      setToasts((t) => [...t, { id, variant, title, description }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map(({ id, variant, title, description }) => {
          const s = ALERT_STYLES[variant]
          return (
            <div
              key={id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm gap-3 rounded-input border-l-4 bg-surface p-4 text-sm shadow-pop',
                s.bar,
              )}
            >
              <s.Icon className={cn('mt-0.5 size-5 shrink-0', s.title)} aria-hidden="true" />
              <div className="flex-1">
                <p className="font-bold text-text">{title}</p>
                {description && <p className="text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss notification"
                className="-m-1 h-fit rounded-sm p-1 text-muted hover:bg-surface-3"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
