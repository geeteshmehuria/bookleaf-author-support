import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { Inbox } from "lucide-react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useAuth } from "@/context/auth"
import Queue from "./Queue"
import TicketView from "./TicketView"

const NAV = [{ to: "/admin", label: "Ticket queue", icon: Inbox, end: false }]

/** Everything under /admin. Already guarded by <RequireRole role="admin"> in App.jsx. */
export default function AdminArea() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const title = pathname.startsWith("/admin/tickets/") ? "Ticket" : "Ticket queue"

  return (
    <AdminLayout title={title} navItems={NAV} user={user} onLogout={logout}>
      <Routes>
        <Route index element={<Queue />} />
        <Route path="tickets/:ticketId" element={<TicketView />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  )
}
