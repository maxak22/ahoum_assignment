const COLORS = [
  '#4f46e5', '#0f9d6b', '#d97706', '#dc2b3d',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
]

function colorFor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export default function Avatar({ name, email, src, size = 36 }) {
  const label = (name || email || '?').trim()
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  const base = { width: size, height: size, fontSize: Math.round(size * 0.4) }

  if (src) {
    return (
      <img
        className="avatar"
        src={src}
        alt={label}
        style={base}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span
      className="avatar"
      style={{ ...base, background: colorFor(label) }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  )
}
