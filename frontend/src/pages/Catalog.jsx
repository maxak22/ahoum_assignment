import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage, asList } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import SessionCard from '../components/SessionCard.jsx'
import { SkeletonCards } from '../components/Skeleton.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

export default function Catalog() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // all | available

  useEffect(() => {
    let alive = true
    api
      .get('/sessions/')
      .then(({ data }) => alive && setSessions(asList(data)))
      .catch((err) => alive && setError(apiErrorMessage(err)))
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(() => {
    if (!sessions) return []
    const q = query.trim().toLowerCase()
    return sessions.filter((s) => {
      if (filter === 'available' && (s.remaining_seats <= 0 || s.has_started))
        return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (s.creator?.full_name || '').toLowerCase().includes(q)
      )
    })
  }, [sessions, query, filter])

  return (
    <div>
      <section className="hero">
        <h1>Find your next session.</h1>
        <p className="muted">
          Coaching, lessons, mock interviews and office hours — hosted by real
          people, with a real seat count.
        </p>
        {user?.is_creator && (
          <Link className="button" to="/sessions/new">
            Host a session
          </Link>
        )}
      </section>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search sessions or hosts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="segmented">
          <button
            className={filter === 'all' ? 'on' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'available' ? 'on' : ''}
            onClick={() => setFilter('available')}
          >
            Available
          </button>
        </div>
      </div>

      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !sessions ? (
        <SkeletonCards />
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden="true">
            ✳
          </div>
          <h3>{sessions.length === 0 ? 'No sessions yet' : 'Nothing matches'}</h3>
          <p className="muted">
            {sessions.length === 0
              ? 'Once creators publish sessions they’ll show up here.'
              : 'Try a different search or clear the filter.'}
          </p>
        </div>
      ) : (
        <ul className="card-list">
          {visible.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
