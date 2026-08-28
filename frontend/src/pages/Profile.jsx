import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { apiErrorMessage } from '../api/client.js'
import Avatar from '../components/Avatar.jsx'

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(user.full_name || '')
  const [bio, setBio] = useState(user.bio || '')
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile({ full_name: fullName, bio })
      toast.success('Profile saved')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggleCreator = async () => {
    setBusy(true)
    try {
      await updateProfile({ is_creator: !user.is_creator })
      toast.success(
        user.is_creator ? 'Creator mode turned off' : 'You are now a creator',
      )
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="narrow">
      <p className="eyebrow">Account</p>
      <h1>Profile</h1>

      <div className="profile-head">
        <Avatar
          name={user.full_name}
          email={user.email}
          src={user.avatar_url}
          size={56}
        />
        <div>
          <strong>{user.full_name || 'Your account'}</strong>
          <p className="muted small" style={{ margin: 0 }}>
            {user.email} · <span className="tag">{user.role}</span>
          </p>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={save} style={{ margin: 0 }}>
          <label>
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label>
            Bio
            <textarea
              rows={4}
              value={bio}
              placeholder="A sentence or two about what you can help with."
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Creator mode</h2>
        <p className="muted">
          {user.is_creator
            ? 'You can publish and manage sessions. You keep every normal user ability, including booking other people’s sessions.'
            : 'Turn this on to publish your own sessions. It doesn’t remove any of your current abilities.'}
        </p>
        <button className="secondary" onClick={toggleCreator} disabled={busy}>
          {user.is_creator ? 'Turn off creator mode' : 'Become a creator'}
        </button>
      </div>
    </div>
  )
}
