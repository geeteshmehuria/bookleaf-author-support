/** Shown while we check a saved login on page load, so protected pages never flash. */
export function FullPageLoader({ label = "Loading…" }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}
