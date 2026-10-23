import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/services/api"

/** While nothing changes, each refresh waits twice as long as the last, up to this many times pollMs. */
const MAX_SLOWDOWN = 3

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
 * - backs off while nothing changes: 10 s -> 20 s -> 30 s (for pollMs = 10 s; 5 s -> 10 s -> 15 s for authors),
 *   and goes back to pollMs as soon as something changes or the user does something
 * - pauses while the browser tab is hidden, and refreshes as soon as it is visible again
 * - never overwrites newer data: a refresh that started before a setData() is dropped
 */
export function useApi(path, { pollMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)
  // Bumped whenever data is replaced; a refresh only lands if nothing changed while it was in flight.
  const version = useRef(0)
  // Set by the poller; setData calls it so a user action brings polling back to full speed.
  const speedUp = useRef(() => {})

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
    let timer = null
    let delay = pollMs
    let last = null // the previous response as text, to tell "changed" from "same again"

    function schedule() {
      clearTimeout(timer)
      if (!cancelled) timer = setTimeout(refresh, delay)
    }

    async function refresh() {
      if (document.hidden) return // the visibilitychange listener restarts us
      const startedAt = version.current
      try {
        const data = await api.get(path)
        const text = JSON.stringify(data)
        const changed = text !== last
        last = text
        delay = changed ? pollMs : Math.min(delay * 2, pollMs * MAX_SLOWDOWN)
        if (!cancelled && changed && version.current === startedAt) {
          version.current += 1
          setState({ data, error: null, loading: false })
        }
      } catch {
        // Keep showing the last good data; try again later. (A 401 logs out via api.js.)
      }
      schedule()
    }

    function onVisible() {
      if (document.hidden) return
      clearTimeout(timer) // don't let a pending tick fire alongside this refresh
      delay = pollMs
      refresh()
    }

    speedUp.current = () => {
      delay = pollMs
      schedule()
    }
    schedule()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [path, pollMs])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const setData = useCallback((data) => {
    version.current += 1
    speedUp.current()
    setState({ data, error: null, loading: false })
  }, [])
  return { ...state, reload, setData }
}
