import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import { BookOpen, LayoutDashboard, LifeBuoy } from "lucide-react"
import { AuthorLayout } from "@/components/layout/AuthorLayout"
import { EmptyState } from "@/components/feedback"
import { useAuth } from "@/context/auth"
import BookDetail from "./BookDetail"
import Dashboard from "./Dashboard"
import MyBooks from "./MyBooks"

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
        <Route
          path="support"
          element={
            <EmptyState icon={LifeBuoy} title="Support tickets are coming soon">
              You'll be able to raise and follow your queries here.
            </EmptyState>
          }
        />
        <Route path="*" element={<Navigate to="/author" replace />} />
      </Routes>
    </AuthorLayout>
  )
}
