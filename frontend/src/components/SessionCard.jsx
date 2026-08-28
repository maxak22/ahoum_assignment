import { Link } from 'react-router-dom'
import DateBadge from './DateBadge.jsx'
import SeatMeter from './SeatMeter.jsx'
import Avatar from './Avatar.jsx'

function timeLabel(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SessionCard({ session }) {
  const host = session.creator || {}
  return (
    <li className="s-card">
      <Link to={`/sessions/${session.id}`} className="s-card-link">
        <div className="s-card-top">
          <DateBadge iso={session.start_at} />
          <div className="s-card-head">
            <h3>{session.title}</h3>
            <p className="muted small">
              {timeLabel(session.start_at)} · {session.duration_minutes} min
            </p>
          </div>
        </div>

        <p className="s-card-desc">
          {session.description || 'No description provided.'}
        </p>

        <SeatMeter
          taken={session.seats_taken}
          capacity={session.capacity}
          started={session.has_started}
        />

        <div className="s-card-foot">
          <Avatar name={host.full_name} email={host.email} size={24} />
          <span className="muted small">
            {host.full_name || host.email || 'Unknown host'}
          </span>
        </div>
      </Link>
    </li>
  )
}
