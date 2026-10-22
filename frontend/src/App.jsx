import { useState, useEffect } from 'react'
import { api } from './services/api'

export default function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/health')
      .then((data) => {
        setHealth(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-slate-200 p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-indigo-600 mb-2">BookLeaf Portal</h1>
        <p className="text-sm text-slate-500 mb-6">Author Support & Communication Platform</p>
        
        <div className="bg-slate-100 rounded-lg p-4 text-left font-mono text-xs">
          <p className="text-slate-600 font-semibold mb-2">Phase 0: Health Check Status</p>
          {loading && <p className="text-amber-600 animate-pulse">Checking backend API...</p>}
          {error && <p className="text-red-600">Error connecting to API: {error}</p>}
          {health && (
            <div className="space-y-1">
              <p className="text-emerald-600 font-bold">● Status: {health.status}</p>
              <p className="text-slate-600">Service: {health.service}</p>
              <p className="text-slate-400">Timestamp: {health.timestamp}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
