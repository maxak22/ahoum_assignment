import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client.js'
import SessionCard from '../components/SessionCard.jsx'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function Catalog() {
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api
      .get('/sessions/')
      .then(({ data }) => alive && setSessions(data))
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!sessions) return <Loading label="Loading sessions…" />

  return (
    <div>
      <h1>Sessions</h1>
      {sessions.length === 0 ? (
        <EmptyState>No public sessions yet. Check back soon.</EmptyState>
      ) : (
        <ul className="card-list">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
