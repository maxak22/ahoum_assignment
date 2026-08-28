import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage, asList } from '../api/client.js'
import { useToast } from '../components/ToastContext.jsx'
import { formatDateTime } from '../lib/format.js'
import DateBadge from '../components/DateBadge.jsx'
import { SkeletonRows } from '../components/Skeleton.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

function BookingRow({ booking, onCancel, busy }) {
  const s = booking.session
  const cancellable = !booking.is_past && booking.status === 'active'
  return (
    <li className="row">
      <div className="row-main">
        <DateBadge iso={s.start_at} />
        <div>
          <Link to={`/sessions/${s.id}`} className="row-title">
            {s.title}
          </Link>
          <p className="muted small">{formatDateTime(s.start_at)}</p>
        </div>
      </div>
      <div className="row-aside">
        <span
          className={
            booking.status === 'cancelled'
              ? 'tag'
              : booking.is_past
                ? 'tag'
                : 'tag tag-ok'
          }
        >
          {booking.status === 'cancelled'
            ? 'Cancelled'
            : booking.is_past
              ? 'Past'
              : 'Confirmed'}
        </span>
        {cancellable && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => onCancel(booking.id)}
          >
            {busy ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>
    </li>
  )
}

export default function MyBookings() {
  const toast = useToast()
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setError('')
    api
      .get('/bookings/')
      .then(({ data }) => setBookings(asList(data)))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(load, [load])

  const cancel = async (bookingId) => {
    setBusyId(bookingId)
    try {
      await api.post(`/bookings/${bookingId}/cancel/`)
      toast.success('Booking cancelled — the seat is freed')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not cancel.'))
    } finally {
      setBusyId(null)
    }
  }

  const active = (bookings || []).filter(
    (b) => !b.is_past && b.status === 'active',
  )
  const past = (bookings || []).filter((b) => b.is_past || b.status !== 'active')

  return (
    <div>
      <p className="eyebrow">Your schedule</p>
      <h1>My bookings</h1>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!bookings ? (
        <SkeletonRows count={3} />
      ) : (
        <>
          <h2>Upcoming</h2>
          {active.length === 0 ? (
            <div className="empty">
              <p className="muted">
                No upcoming bookings. <Link to="/">Browse sessions →</Link>
              </p>
            </div>
          ) : (
            <ul className="plain-list">
              {active.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  onCancel={cancel}
                  busy={busyId === b.id}
                />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <h2>Past</h2>
              <ul className="plain-list">
                {past.map((b) => (
                  <BookingRow key={b.id} booking={b} onCancel={cancel} busy={false} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
