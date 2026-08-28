import { Link } from 'react-router-dom'
import { formatDateTime } from '../lib/format.js'

export default function SessionCard({ session }) {
  const seatsLeft = session.remaining_seats > 0

  return (
    <li className="card">
      <div className="card-body">
        <Link to={`/sessions/${session.id}`} className="card-title">
          {session.title}
        </Link>
        <p className="muted small">
          {formatDateTime(session.start_at)} · {session.duration_minutes} min
        </p>
        <p className="muted small">
          Hosted by {session.creator?.full_name || session.creator?.email || 'Unknown'}
        </p>
      </div>
      <div className="card-aside">
        <span className={seatsLeft ? 'pill pill-ok' : 'pill pill-muted'}>
          {seatsLeft
            ? `${session.remaining_seats} of ${session.capacity} seats`
            : 'Fully booked'}
        </span>
        {session.has_started && <span className="pill pill-muted">Started</span>}
      </div>
    </li>
  )
}
