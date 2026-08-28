import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="narrow">
      <h1>Not found</h1>
      <p className="muted">That page or session doesn’t exist.</p>
      <Link to="/">Back to the catalog</Link>
    </div>
  )
}
