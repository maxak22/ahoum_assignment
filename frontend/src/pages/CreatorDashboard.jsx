import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client.js'
import { formatDateTime } from '../lib/format.js'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function CreatorDashboard() {
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setError('')
    api
      .get('/sessions/?mine=1')
      .then(({ data }) => setSessions(data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(load, [load])

  const remove = async (id) => {
    if (!window.confirm('Delete this session? Existing bookings will be removed.'))
      return
    setActionError('')
    setBusyId(id)
    try {
      await api.delete(`/sessions/${id}/`)
      load()
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not delete.'))
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!sessions) return <Loading label="Loading your sessions…" />

  return (
    <div>
      <div className="page-head">
        <h1>Your sessions</h1>
        <Link className="button" to="/sessions/new">
          New session
        </Link>
      </div>

      <ErrorNote>{actionError}</ErrorNote>

      {sessions.length === 0 ? (
        <EmptyState>
          You have not created any sessions yet.
        </EmptyState>
      ) : (
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
                <td>{formatDateTime(s.start_at)}</td>
                <td>
                  {s.seats_taken} / {s.capacity}
                </td>
                <td>{s.is_public ? 'Public' : 'Private'}</td>
                <td className="actions">
                  <Link to={`/sessions/${s.id}/edit`}>Edit</Link>
                  <button
                    className="link-button danger"
                    disabled={busyId === s.id}
                    onClick={() => remove(s.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
