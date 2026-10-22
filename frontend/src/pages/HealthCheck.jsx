import { useEffect, useState } from "react"
import { api } from "@/services/api"
import { LoginLayout } from "@/components/layout/LoginLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

/** Phase 0 check: proves the frontend can reach the backend. */
export default function HealthCheck() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get("/health").then(setHealth).catch((err) => setError(err.message))
  }, [])

  return (
    <LoginLayout title="BookLeaf Portal" subtitle="Author Support & Communication">
      {!health && !error && (
        <div className="grid gap-2" aria-busy="true" aria-label="Checking backend API">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}
      {error && (
        <Alert variant="danger">
          <AlertTitle>Cannot reach the API</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {health && (
        <Alert variant="success">
          <AlertTitle>Status: {health.status}</AlertTitle>
          <AlertDescription>
            {health.service} · {new Date(health.timestamp).toLocaleString()}
          </AlertDescription>
        </Alert>
      )}
    </LoginLayout>
  )
}
