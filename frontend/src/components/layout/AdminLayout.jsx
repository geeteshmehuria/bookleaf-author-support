import { AppShell } from "./AppShell"

/**
 * Admin area: neutral, dense, full width (grey sidebar from --sidebar).
 * Coral only for primary actions, the active nav item and alerts.
 */
function AdminLayout({ children, ...props }) {
  return (
    <AppShell navLabel="Admin navigation" contentClassName="py-5" {...props}>
      {children}
    </AppShell>
  )
}

export { AdminLayout }
