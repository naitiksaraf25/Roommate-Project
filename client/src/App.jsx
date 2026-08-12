import { useState, useEffect } from 'react'
import './index.css'

export function App() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div>
      <h1>RoomieMatch</h1>
      <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>
        AI-Assisted Roommate & PG Matching Platform — Base Setup Scaffolding
      </p>

      <div className="card">
        <h2>Backend Health Status Check</h2>
        {loading && <p>Checking backend connection...</p>}
        {error && (
          <div style={{ color: '#f87171' }}>
            <p>Failed to connect to backend API: {error}</p>
            <button onClick={checkHealth}>Retry Connection</button>
          </div>
        )}
        {health && (
          <div>
            <p>
              Status: <span className="badge badge-success">{health.status}</span>
            </p>
            <p>
              MongoDB Database:{' '}
              <span className={`badge ${health.mongodb === 'connected' ? 'badge-success' : 'badge-warning'}`}>
                {health.mongodb}
              </span>
            </p>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Timestamp: {health.timestamp}
            </p>
            <button onClick={checkHealth}>Refresh Health Check</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
