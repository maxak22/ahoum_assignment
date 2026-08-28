import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { formatDateTime } from '../lib/format.js'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

export default function SessionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
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
    setActionError('')
    setNotice('')
    setBusy(true)
    try {
      await api.post(`/sessions/${id}/book/`)
      setNotice('Booked. Find it under My bookings.')
      load()
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not book this session.'))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>
  if (!session) return <Loading />

  const isOwner = user && session.creator?.id === user.id
  const canBook =
    user && !isOwner && !session.has_started && session.remaining_seats > 0

  return (
    <article className="narrow">
      <Link to="/" className="back-link">
        ← All sessions
      </Link>
      <h1>{session.title}</h1>

      <div className="detail-meta">
        <span>{formatDateTime(session.start_at)}</span>
        <span>{session.duration_minutes} min</span>
        <span>
          Hosted by {session.creator?.full_name || session.creator?.email}
        </span>
      </div>

      <div className="panel">
        <p style={{ marginBottom: session.description ? 16 : 0 }}>
          {session.description || (
            <span className="muted">No description provided.</span>
          )}
        </p>

        <p className="seat-line">
          {session.remaining_seats > 0
            ? `${session.remaining_seats} of ${session.capacity} seats left`
            : 'Fully booked'}
          {session.has_started && ' · already started'}
        </p>

        {notice && <p className="success">{notice}</p>}
        <ErrorNote>{actionError}</ErrorNote>

        {!user && (
          <p className="muted" style={{ margin: 0 }}>
            <Link to="/login">Sign in</Link> to book this session.
          </p>
        )}
        {isOwner && (
          <p className="muted" style={{ margin: 0 }}>
            You host this session ·{' '}
            <Link to={`/sessions/${session.id}/edit`}>edit it</Link>
          </p>
        )}
        {user && !isOwner && (
          <button onClick={book} disabled={!canBook || busy}>
            {busy
              ? 'Booking…'
              : session.has_started
                ? 'Session has started'
                : session.remaining_seats > 0
                  ? 'Book this session'
                  : 'Fully booked'}
          </button>
        )}
      </div>
    </article>
  )
}
