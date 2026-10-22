import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, AUTH_EXPIRED_EVENT, tokenStore } from "@/services/api"

const AuthContext = createContext(null)

/**
 * Holds the logged-in user for the whole app.
 *  status: "loading" while we check a saved token on page load, then "ready".
 *  user:   { id, name, email, role } or null.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (tokenStore.get() ? "loading" : "ready"))

  // Page load with a saved token: ask the server who it belongs to (it may have expired).
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    api
      .get("/auth/me")
      .then((me) => !cancelled && setUser(me))
      .catch(() => {}) // a 401 already cleared the token in api.js; anything else: just show login
      .finally(() => !cancelled && setStatus("ready"))
    return () => {
      cancelled = true
    }
  }, [])

  // Any API call that comes back 401 logs the user out everywhere.
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password })
    tokenStore.set(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
