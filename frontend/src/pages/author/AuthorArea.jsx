import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { BookOpen, LayoutDashboard, LifeBuoy } from "lucide-react"
import { AuthorLayout } from "@/components/layout/AuthorLayout"
import { useAuth } from "@/context/auth"
import BookDetail from "./BookDetail"
import Dashboard from "./Dashboard"
import MyBooks from "./MyBooks"
import MyTickets from "./MyTickets"
import NewTicket from "./NewTicket"
import TicketDetail from "./TicketDetail"

const NAV = [
  { to: "/author", label: "Dashboard", icon: LayoutDashboard },
  // end: false keeps "My books" highlighted on /author/books/BK001 too
  { to: "/author/books", label: "My books", icon: BookOpen, end: false },
  { to: "/author/support", label: "Support", icon: LifeBuoy, end: false },
]

function titleFor(pathname) {
  if (pathname.startsWith("/author/books")) return "My books"
  if (pathname.startsWith("/author/support")) return "Support"
  return "Dashboard"
}

/** Everything under /author. Already guarded by <RequireRole role="author"> in App.jsx. */
export default function AuthorArea() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <AuthorLayout title={titleFor(pathname)} navItems={NAV} user={user} onLogout={logout}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="books" element={<MyBooks />} />
        <Route path="books/:bookId" element={<BookDetail />} />
        <Route path="support" element={<MyTickets />} />
        <Route path="support/new" element={<NewTicket />} />
        <Route path="support/:ticketId" element={<TicketDetail />} />
        <Route path="*" element={<Navigate to="/author" replace />} />
      </Routes>
    </AuthorLayout>
  )
}
