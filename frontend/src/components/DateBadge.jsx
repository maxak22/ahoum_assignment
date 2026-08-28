export default function DateBadge({ iso }) {
  const d = new Date(iso)
  const month = d.toLocaleString(undefined, { month: 'short' })
  const day = d.getDate()
  return (
    <div className="date-badge" aria-hidden="true">
      <span className="db-month">{month}</span>
      <span className="db-day">{day}</span>
    </div>
  )
}
