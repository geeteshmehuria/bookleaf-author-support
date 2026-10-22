import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"
import HealthCheck from "@/pages/HealthCheck"

// Dev-only styleguide: the import is dropped from production builds.
const ThemePreview = import.meta.env.DEV ? lazy(() => import("@/pages/ThemePreview")) : null

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HealthCheck />} />

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
    </Routes>
  )
}
