export default function SeatMeter({ taken, capacity, started }) {
  const left = Math.max(capacity - taken, 0)
  const pct = capacity ? Math.min(100, Math.round((taken / capacity) * 100)) : 0
  const full = left === 0

  return (
    <div className="seat-meter">
      <div className="seat-meter-track">
        <div
          className="seat-meter-fill"
          style={{ width: `${pct}%` }}
          data-full={full || undefined}
        />
      </div>
      <span className="seat-meter-label">
        {started
          ? 'Started'
          : full
            ? 'Fully booked'
            : `${left} of ${capacity} seat${capacity === 1 ? '' : 's'} left`}
      </span>
    </div>
  )
}
