import { AppShell } from "./AppShell"

/**
 * Author area: calm and mostly white. Coral only for actions and progress.
 * Reading/writing column capped at 720px.
 */
function AuthorLayout({ children, ...props }) {
  return (
    <AppShell
      navLabel="Author navigation"
      sidebarStyle={{ "--sidebar": "var(--brand-surface)" }}
      contentClassName="mx-auto max-w-[720px] md:py-10"
      {...props}
    >
      {children}
    </AppShell>
  )
}

export { AuthorLayout }
