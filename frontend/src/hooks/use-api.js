import { useCallback, useEffect, useState } from "react"
import { api } from "@/services/api"

/**
 * Load data from a GET endpoint.
 *   const { data, error, loading, reload } = useApi("/books")
 * Ignores a response that arrives after the component unmounted or the path changed.
 */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, error: null, loading: true }))
    api
      .get(path)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [path, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, reload }
}
