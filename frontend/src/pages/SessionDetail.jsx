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
      setNotice('Booked! See it under My bookings.')
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
      <p>
        <Link to="/">← All sessions</Link>
      </p>
      <h1>{session.title}</h1>
      <p className="muted">
        {formatDateTime(session.start_at)} · {session.duration_minutes} min ·
        hosted by {session.creator?.full_name || session.creator?.email}
      </p>

      <p>{session.description || <span className="muted">No description.</span>}</p>

      <p>
        <strong>
          {session.remaining_seats > 0
            ? `${session.remaining_seats} of ${session.capacity} seats left`
            : 'Fully booked'}
        </strong>
        {session.has_started && ' · already started'}
      </p>

      {notice && <p className="success">{notice}</p>}
      <ErrorNote>{actionError}</ErrorNote>

      {!user && (
        <p className="muted">
          <Link to="/login">Sign in</Link> to book this session.
        </p>
      )}
      {isOwner && (
        <p className="muted">
          You host this session.{' '}
          <Link to={`/sessions/${session.id}/edit`}>Edit it</Link>.
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
                : 'Full'}
        </button>
      )}
    </article>
  )
}
