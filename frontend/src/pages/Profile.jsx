import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiErrorMessage } from '../api/client.js'
import ErrorNote from '../components/ErrorNote.jsx'

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState(user.full_name || '')
  const [bio, setBio] = useState(user.bio || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await updateProfile({ full_name: fullName, bio })
      setNotice('Saved.')
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleCreator = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await updateProfile({ is_creator: !user.is_creator })
      setNotice(
        user.is_creator ? 'Creator mode turned off.' : 'You are now a creator.',
      )
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="narrow">
      <h1>Profile</h1>
      <p className="muted">
        {user.email} · role: <strong>{user.role}</strong>
      </p>

      <ErrorNote>{error}</ErrorNote>
      {notice && <p className="success">{notice}</p>}

      <form onSubmit={save}>
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label>
          Bio
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <hr />

      <h2>Creator mode</h2>
      <p className="muted">
        {user.is_creator
          ? 'You can publish and manage sessions. You can still book other people’s sessions.'
          : 'Turn this on to publish your own sessions. It does not remove any of your current abilities.'}
      </p>
      <button className="secondary" onClick={toggleCreator} disabled={busy}>
        {user.is_creator ? 'Turn off creator mode' : 'Become a creator'}
      </button>
    </div>
  )
}
