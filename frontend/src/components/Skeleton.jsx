export function SkeletonCards({ count = 6 }) {
  return (
    <ul className="card-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="s-card">
          <div className="s-card-top">
            <div className="sk sk-badge" />
            <div style={{ flex: 1 }}>
              <div className="sk sk-line" style={{ width: '70%' }} />
              <div className="sk sk-line" style={{ width: '45%' }} />
            </div>
          </div>
          <div className="sk sk-line" style={{ width: '100%' }} />
          <div className="sk sk-line" style={{ width: '85%' }} />
          <div className="sk sk-bar" />
        </li>
      ))}
    </ul>
  )
}

export function SkeletonRows({ count = 3 }) {
  return (
    <div className="plain-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="row">
          <div className="sk sk-badge" />
          <div style={{ flex: 1 }}>
            <div className="sk sk-line" style={{ width: '40%' }} />
            <div className="sk sk-line" style={{ width: '25%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
