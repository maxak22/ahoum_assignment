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

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Browse</p>
          <h1>Upcoming sessions</h1>
        </div>
        {Array.isArray(sessions) && sessions.length > 0 && (
          <span className="muted small">
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !sessions ? (
        <Loading label="Loading sessions…" />
      ) : sessions.length === 0 ? (
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
