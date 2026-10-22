import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth"
import { homeFor } from "@/lib/roles"
import { FullPageLoader } from "./FullPageLoader"

/**
 * Guards a whole area of the app.
 *  - not logged in    -> login page ("/"), remembering where they were going
 *  - wrong role       -> their own home (an author opening /admin lands on /author)
 *
 * This is for user experience only. The real protection is on the API:
 * every admin endpoint checks the role on the server.
 */
export function RequireRole({ role, children }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === "loading") return <FullPageLoader />
  if (!user) return <Navigate to="/" replace state={{ from: location }} />
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />
  return children
}
