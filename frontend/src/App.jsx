import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HealthCheck from './pages/HealthCheck'

// Design-system preview: dev only. In a production build this branch is
// removed, so /theme-preview does not exist on the live site.
const ThemePreview = import.meta.env.DEV ? lazy(() => import('./pages/theme-preview/ThemePreview')) : null

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HealthCheck />} />
        {ThemePreview && <Route path="/theme-preview/*" element={<ThemePreview />} />}
      </Routes>
    </Suspense>
  )
}
