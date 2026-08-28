import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiErrorMessage } from '../api/client.js'
import BrandMark from '../components/BrandMark.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const showDev = import.meta.env.DEV || !googleClientId

export default function Login() {
  const { user, loginWithGoogle, devLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const redirectTo = location.state?.from?.pathname || '/'
  if (user) return <Navigate to={redirectTo} replace />

  const done = () => navigate(redirectTo, { replace: true })

  const onGoogle = async (res) => {
    setError('')
    setBusy(true)
    try {
      await loginWithGoogle(res.credential)
      done()
    } catch (err) {
      setError(apiErrorMessage(err, 'Google sign-in failed.'))
    } finally {
      setBusy(false)
    }
  }

  const onDev = async (email, isCreator) => {
    setError('')
    setBusy(true)
    try {
      await devLogin(email, isCreator)
      done()
    } catch (err) {
      setError(apiErrorMessage(err, 'Dev login failed — is the backend in DEBUG mode?'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-split">
      <aside className="auth-brand">
        <Link to="/" className="auth-brand-logo">
          <BrandMark size={30} />
          <span>Sessions</span>
        </Link>

        <div className="auth-brand-body">
          <h1>
            Small groups.
            <br />
            Real seats.
            <br />
            <em>No double-bookings.</em>
          </h1>
          <p>
            A marketplace for mentoring, mock interviews and workshops — where the
            last seat can only be sold once.
          </p>

          <ul className="auth-points">
            <li>Browse and book public sessions in seconds</li>
            <li>Capacity enforced by the database, not a guess</li>
            <li>Become a creator and host your own</li>
          </ul>
        </div>

        <figure className="auth-preview" aria-hidden="true">
          <div className="ap-badge">
            <span>SEP</span>
            <strong>15</strong>
          </div>
          <div className="ap-body">
            <strong>Deep Dive: Postgres Locking</strong>
            <span>Tue 10:30 PM · 90 min</span>
            <div className="ap-meter">
              <i />
            </div>
            <span className="ap-left">1 seat left</span>
          </div>
        </figure>

        <p className="auth-brand-foot">Concurrency-safe booking demo</p>
      </aside>

      <main className="auth-form-wrap">
        <div className="auth-form">
          <p className="eyebrow">Get started</p>
          <h2>Sign in to continue</h2>
          <p className="muted">Use your Google account — we never see your password.</p>

          {error && (
            <p className="error" role="alert" style={{ marginTop: 16 }}>
              {error}
            </p>
          )}

          <div className="auth-google">
            {googleClientId ? (
              <GoogleLogin
                onSuccess={onGoogle}
                onError={() => setError('Google sign-in was cancelled or failed.')}
                shape="pill"
                size="large"
                width="320"
                text="continue_with"
              />
            ) : (
              <p className="muted small">
                Google isn’t configured — use the test sign-in below.
              </p>
            )}
          </div>

          {showDev && (
            <>
              <div className="auth-divider">
                <span>{googleClientId ? 'or for reviewers' : 'test sign-in'}</span>
              </div>
              <DevForm busy={busy} onSubmit={onDev} />
            </>
          )}

          <p className="auth-fineprint">
            By continuing you agree this is a demo app and not a real service.
          </p>
        </div>
      </main>
    </div>
  )
}

function DevForm({ busy, onSubmit }) {
  const [email, setEmail] = useState('reviewer@example.com')
  const [isCreator, setIsCreator] = useState(true)
  return (
    <form
      className="auth-dev"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(email.trim(), isCreator)
      }}
    >
      <label>
        Email
        <input
          type="email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={isCreator}
          onChange={(e) => setIsCreator(e.target.checked)}
        />
        Sign in as a creator
      </label>
      <button type="submit" className="block" disabled={busy}>
        {busy ? 'Signing in…' : 'Continue'}
      </button>
      <span className="muted small">Needs the backend running with DEBUG=1.</span>
    </form>
  )
}
