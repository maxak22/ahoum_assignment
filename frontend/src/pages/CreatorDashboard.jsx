import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage, asList } from '../api/client.js'
import { useToast } from '../components/ToastContext.jsx'
import { formatDateTime } from '../lib/format.js'
import { SkeletonRows } from '../components/Skeleton.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

export default function CreatorDashboard() {
  const toast = useToast()
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setError('')
    api
      .get('/sessions/?mine=1')
      .then(({ data }) => setSessions(asList(data)))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(load, [load])

  const stats = useMemo(() => {
    const list = sessions || []
    const booked = list.reduce((n, s) => n + s.seats_taken, 0)
    const capacity = list.reduce((n, s) => n + s.capacity, 0)
    return {
      count: list.length,
      booked,
      fill: capacity ? Math.round((booked / capacity) * 100) : 0,
    }
  }, [sessions])

  const remove = async (session) => {
    if (
      !window.confirm(
        `Delete "${session.title}"? Its ${session.seats_taken} booking(s) will be removed.`,
      )
    )
      return
    setBusyId(session.id)
    try {
      await api.delete(`/sessions/${session.id}/`)
      toast.success('Session deleted')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Creator</p>
          <h1>Dashboard</h1>
        </div>
        <Link className="button" to="/sessions/new">
          + New session
        </Link>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="stat-row">
        <div className="stat">
          <span className="stat-num">{sessions ? stats.count : '—'}</span>
          <span className="stat-label">Sessions</span>
        </div>
        <div className="stat">
          <span className="stat-num">{sessions ? stats.booked : '—'}</span>
          <span className="stat-label">Seats booked</span>
        </div>
        <div className="stat">
          <span className="stat-num">{sessions ? `${stats.fill}%` : '—'}</span>
          <span className="stat-label">Fill rate</span>
        </div>
      </div>

      {!sessions ? (
        <SkeletonRows count={3} />
      ) : sessions.length === 0 ? (
        <div className="empty">
          <div className="empty-icon" aria-hidden="true">
            ✳
          </div>
          <h3>No sessions yet</h3>
          <p className="muted">Publish your first session to start taking bookings.</p>
          <Link className="button" to="/sessions/new">
            Create a session
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Starts</th>
                <th>Booked</th>
                <th>Visibility</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sessions/${s.id}`}>{s.title}</Link>
                  </td>
                  <td className="muted">{formatDateTime(s.start_at)}</td>
                  <td>
                    <span className="count-pill">
                      {s.seats_taken} / {s.capacity}
                    </span>
                  </td>
                  <td>
                    <span className={s.is_public ? 'tag tag-ok' : 'tag'}>
                      {s.is_public ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td className="actions">
                    <Link to={`/sessions/${s.id}/edit`}>Edit</Link>
                    <button
                      className="link-button danger"
                      disabled={busyId === s.id}
                      onClick={() => remove(s)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
