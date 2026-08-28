import { Link } from 'react-router-dom'
import { formatDateTime } from '../lib/format.js'

export default function SessionCard({ session }) {
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
          by {session.creator?.full_name || session.creator?.email || 'Unknown'}
        </p>
      </div>
      <div className="card-aside">
        <span className={session.remaining_seats > 0 ? 'pill' : 'pill pill-muted'}>
          {session.remaining_seats > 0
            ? `${session.remaining_seats} / ${session.capacity} seats left`
            : 'Full'}
        </span>
        {session.has_started && <span className="pill pill-muted">Started</span>}
      </div>
    </li>
  )
}
