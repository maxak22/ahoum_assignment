import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client.js'
import { formatDateTime } from '../lib/format.js'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function MyBookings() {
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setError('')
    api
      .get('/bookings/')
      .then(({ data }) => setBookings(data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(load, [load])

  const cancel = async (bookingId) => {
    setActionError('')
    setBusyId(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/cancel/`)
      load()
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not cancel.'))
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!bookings) return <Loading label="Loading your bookings…" />

  const active = bookings.filter((b) => !b.is_past && b.status === 'active')
  const past = bookings.filter((b) => b.is_past || b.status !== 'active')

  return (
    <div>
      <h1>My bookings</h1>
      <ErrorNote>{actionError}</ErrorNote>

      <h2>Active</h2>
      {active.length === 0 ? (
        <EmptyState>
          No active bookings. <Link to="/">Browse sessions</Link>.
        </EmptyState>
      ) : (
        <ul className="plain-list">
          {active.map((b) => (
            <li key={b.id} className="row">
              <div>
                <Link to={`/sessions/${b.session.id}`}>{b.session.title}</Link>
                <p className="muted small">
                  {formatDateTime(b.session.start_at)}
                </p>
              </div>
              <button
                className="danger"
                disabled={busyId === b.id}
                onClick={() => cancel(b.id)}
              >
                {busyId === b.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Past</h2>
      {past.length === 0 ? (
        <EmptyState>Nothing here yet.</EmptyState>
      ) : (
        <ul className="plain-list">
          {past.map((b) => (
            <li key={b.id} className="row">
              <div>
                <Link to={`/sessions/${b.session.id}`}>{b.session.title}</Link>
                <p className="muted small">
                  {formatDateTime(b.session.start_at)} ·{' '}
                  {b.status === 'cancelled' ? 'cancelled' : 'completed / started'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
