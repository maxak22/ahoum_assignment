export function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in *local* time.
export function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function fromDatetimeLocalValue(value) {
  // value is local time without a zone; Date() parses it as local, toISOString
  // converts to UTC for the API.
  return value ? new Date(value).toISOString() : null
}
