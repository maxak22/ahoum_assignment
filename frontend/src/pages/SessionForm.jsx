import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client.js'
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from '../lib/format.js'
import Loading from '../components/Loading.jsx'
import ErrorNote from '../components/ErrorNote.jsx'

const EMPTY = {
  title: '',
  description: '',
  start_at: '',
  duration_minutes: 60,
  capacity: 10,
  is_public: true,
}

export default function SessionForm({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(isEdit ? null : EMPTY)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api
      .get(`/sessions/${id}/`)
      .then(({ data }) =>
        setForm({
          title: data.title,
          description: data.description,
          start_at: toDatetimeLocalValue(data.start_at),
          duration_minutes: data.duration_minutes,
          capacity: data.capacity,
          is_public: data.is_public,
        }),
      )
      .catch((err) => {
        if (err?.response?.status === 403) setLoadError('This is not your session.')
        else if (err?.response?.status === 404) navigate('/404', { replace: true })
        else setLoadError(apiErrorMessage(err))
      })
  }, [id, isEdit, navigate])

  const set = (key) => (e) => {
    const value =
      e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    const payload = {
      title: form.title,
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      capacity: Number(form.capacity),
      is_public: form.is_public,
      start_at: fromDatetimeLocalValue(form.start_at),
    }

    try {
      if (isEdit) {
        await api.patch(`/sessions/${id}/`, payload)
      } else {
        const { data } = await api.post('/sessions/', payload)
        navigate(`/sessions/${data.id}`)
        return
      }
      navigate('/dashboard')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the session.'))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>
  if (!form) return <Loading />

  return (
    <div className="narrow">
      <Link to="/dashboard" className="back-link">
        ← Your sessions
      </Link>
      <h1>{isEdit ? 'Edit session' : 'New session'}</h1>

      <ErrorNote>{error}</ErrorNote>

      <form className="panel" onSubmit={submit}>
        <label>
          Title
          <input value={form.title} onChange={set('title')} required />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={set('description')}
          />
        </label>
        <label>
          Starts at
          <input
            type="datetime-local"
            value={form.start_at}
            onChange={set('start_at')}
            required
          />
        </label>
        <div className="grid-2">
          <label>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={form.duration_minutes}
              onChange={set('duration_minutes')}
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={set('capacity')}
              required
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={set('is_public')}
          />
          Public (listed in the catalog)
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create session'}
        </button>
      </form>
    </div>
  )
}
