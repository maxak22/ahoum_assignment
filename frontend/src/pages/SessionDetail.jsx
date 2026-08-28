import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import Avatar from '../components/Avatar.jsx'
import SeatMeter from '../components/SeatMeter.jsx'
import DateBadge from '../components/DateBadge.jsx'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

function fullDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SessionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoadError('')
    api
      .get(`/sessions/${id}/`)
      .then(({ data }) => setSession(data))
      .catch((err) => {
        if (err?.response?.status === 404) navigate('/404', { replace: true })
        else setLoadError(apiErrorMessage(err))
      })
  }

  useEffect(load, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const book = async () => {
    setBusy(true)
    try {
      await api.post(`/sessions/${id}/book/`)
      toast.success('Booked — see it under My bookings')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not book this session.'))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>
  if (!session) return <Loading />

  const host = session.creator || {}
  const isOwner = user && host.id === user.id
  const canBook =
    user && !isOwner && !session.has_started && session.remaining_seats > 0

  const bookLabel = session.has_started
    ? 'Session has started'
    : session.remaining_seats > 0
      ? 'Book this session'
      : 'Fully booked'

  return (
    <article>
      <Link to="/" className="back-link">
        ← All sessions
      </Link>

      <div className="detail-grid">
        <div>
          <div className="detail-title">
            <DateBadge iso={session.start_at} />
            <div>
              <h1>{session.title}</h1>
              <p className="muted">{fullDateTime(session.start_at)}</p>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>About this session</h2>
            <p style={{ marginBottom: 0 }}>
              {session.description || (
                <span className="muted">No description provided.</span>
              )}
            </p>
          </div>

          <div className="panel host-panel">
            <Avatar name={host.full_name} email={host.email} size={48} />
            <div>
              <p className="eyebrow">Hosted by</p>
              <strong>{host.full_name || host.email}</strong>
            </div>
          </div>
        </div>

        <aside className="booking-card">
          <div className="booking-card-inner">
            <p className="stat-big">
              {session.duration_minutes}
              <span> min</span>
            </p>
            <SeatMeter
              taken={session.seats_taken}
              capacity={session.capacity}
              started={session.has_started}
            />

            {!user && (
              <>
                <Link className="button block" to="/login">
                  Sign in to book
                </Link>
                <p className="muted small center">
                  Browsing is open — booking needs an account.
                </p>
              </>
            )}
            {isOwner && (
              <Link className="button secondary block" to={`/sessions/${id}/edit`}>
                Edit session
              </Link>
            )}
            {user && !isOwner && (
              <button
                className="block"
                onClick={book}
                disabled={!canBook || busy}
              >
                {busy ? 'Booking…' : bookLabel}
              </button>
            )}
          </div>
        </aside>
      </div>
    </article>
  )
}
