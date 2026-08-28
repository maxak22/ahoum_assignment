import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiErrorMessage } from '../api/client.js'
import ErrorNote from '../components/ErrorNote.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  const { user, loginWithGoogle, devLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const redirectTo = location.state?.from?.pathname || '/'

  if (user) return <Navigate to={redirectTo} replace />

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('')
    setBusy(true)
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Google sign-in failed.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDevLogin = async (email, isCreator) => {
    setError('')
    setBusy(true)
    try {
      await devLogin(email, isCreator)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Dev login failed (is DEBUG on?).'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-hero">
      <p className="eyebrow">Sessions Marketplace</p>
      <h1>Welcome</h1>
      <p className="muted">
        Sign in to book sessions or publish your own.
      </p>

      <div className="panel" style={{ marginTop: 24 }}>
        <ErrorNote>{error}</ErrorNote>

        {googleClientId ? (
          <div className="login-google">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in was cancelled or failed.')}
              shape="pill"
              size="large"
              text="continue_with"
            />
          </div>
        ) : (
          <p className="warn">
            <code>VITE_GOOGLE_CLIENT_ID</code> is not set — the Google button is
            hidden. Use the dev login below.
          </p>
        )}

        {(import.meta.env.DEV || !googleClientId) && (
          <DevLoginBox busy={busy} onSubmit={handleDevLogin} />
        )}
      </div>
    </div>
  )
}

function DevLoginBox({ busy, onSubmit }) {
  const [email, setEmail] = useState('reviewer@example.com')
  const [isCreator, setIsCreator] = useState(true)

  return (
    <form
      className="dev-box"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(email.trim(), isCreator)
      }}
    >
      <p className="eyebrow">Dev login</p>
      <p className="muted small" style={{ margin: 0 }}>
        Only in <code>npm run dev</code> or with no Google client id. Backend
        needs <code>DEBUG=1</code>.
      </p>
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
        Create as a creator
      </label>
      <button type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Continue'}
      </button>
    </form>
  )
}
