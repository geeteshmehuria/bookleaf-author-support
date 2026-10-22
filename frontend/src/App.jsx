import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { RequireRole } from "@/components/auth/RequireRole"
import HealthCheck from "@/pages/HealthCheck"
import Login from "@/pages/Login"
import AuthorArea from "@/pages/author/AuthorArea"
import AdminArea from "@/pages/admin/AdminArea"

// Dev-only styleguide: the import is dropped from production builds.
const ThemePreview = import.meta.env.DEV ? lazy(() => import("@/pages/ThemePreview")) : null

export default function App() {
  return (
    <Routes>
      {/* One login for everyone; the API's role decides where they go next */}
      <Route path="/" element={<Login />} />

      <Route
        path="/author/*"
        element={
          <RequireRole role="author">
            <AuthorArea />
          </RequireRole>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireRole role="admin">
            <AdminArea />
          </RequireRole>
        }
      />

      {/* Backend connection check (handy after deploy) */}
      <Route path="/health" element={<HealthCheck />} />

      {ThemePreview && (
        <Route
          path="/theme-preview"
          element={
            <Suspense fallback={null}>
              <ThemePreview />
            </Suspense>
          }
        />
      )}

      {/* Old login URLs and anything unknown go to the login page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
