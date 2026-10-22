import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert } from '../components/ui'

/** Phase 0 check: proves the frontend can reach the backend. */
export default function HealthCheck() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/health').then(setHealth).catch((err) => setError(err.message))
  }, [])

  return (
    <AuthLayout title="BookLeaf Portal" subtitle="Author Support & Communication">
      {!health && !error && <p className="text-center text-muted">Checking backend API…</p>}
      {error && <Alert variant="danger" title="Cannot reach the API">{error}</Alert>}
      {health && (
        <Alert variant="success" title={`Status: ${health.status}`}>
          {health.service} · {new Date(health.timestamp).toLocaleString()}
        </Alert>
      )}
    </AuthLayout>
  )
}
