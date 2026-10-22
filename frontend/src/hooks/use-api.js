import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/services/api"

/**
 * Load data from a GET endpoint.
 *   const { data, error, loading, reload, setData } = useApi("/books")
 *   const { data } = useApi("/tickets", { pollMs: 5000 })   // also refresh every 5 s
 *
 * setData replaces the data with a fresher copy (e.g. the ticket an update call returned).
 * Ignores a response that arrives after the component unmounted or the path changed.
 *
 * Polling (near-real-time updates without WebSockets):
 * - refreshes quietly: no loading state, and a failed refresh keeps showing the last data
 * - pauses while the browser tab is hidden, and refreshes as soon as it is visible again
 * - never overwrites newer data: a refresh that started before a setData() is dropped
 */
export function useApi(path, { pollMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)
  // Bumped whenever data is replaced; a refresh only lands if nothing changed while it was in flight.
  const version = useRef(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, error: null, loading: true }))
    api
      .get(path)
      .then((data) => {
        if (cancelled) return
        version.current += 1
        setState({ data, error: null, loading: false })
      })
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [path, attempt])

  useEffect(() => {
    if (!pollMs) return
    let cancelled = false
    let inFlight = false

    async function refresh() {
      if (document.hidden || inFlight) return
      inFlight = true
      const startedAt = version.current
      try {
        const data = await api.get(path)
        if (!cancelled && version.current === startedAt) {
          version.current += 1
          setState({ data, error: null, loading: false })
        }
      } catch {
        // Keep showing the last good data; the next tick tries again. (A 401 logs out via api.js.)
      } finally {
        inFlight = false
      }
    }

    const timer = setInterval(refresh, pollMs)
    const onVisible = () => !document.hidden && refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [path, pollMs])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const setData = useCallback((data) => {
    version.current += 1
    setState({ data, error: null, loading: false })
  }, [])
  return { ...state, reload, setData }
}
