import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({ baseURL })

const ACCESS_KEY = 'sm_access'
const REFRESH_KEY = 'sm_refresh'

// Tokens live in localStorage. Trade-off (XSS exposure vs simplicity) is
// documented in DECISIONS.md #1.
export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On a 401, try to refresh the access token exactly once, then replay the
// request. If refresh fails, clear tokens and bounce to /login.
let refreshRequest = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error
    if (!response || response.status !== 401 || !config || config._retried) {
      return Promise.reject(error)
    }

    const refresh = tokenStore.refresh
    if (!refresh) {
      tokenStore.clear()
      return Promise.reject(error)
    }

    try {
      refreshRequest =
        refreshRequest || axios.post(`${baseURL}/auth/refresh/`, { refresh })
      const { data } = await refreshRequest
      refreshRequest = null
      tokenStore.set({ access: data.access })

      config._retried = true
      config.headers.Authorization = `Bearer ${data.access}`
      return api(config)
    } catch (refreshError) {
      refreshRequest = null
      tokenStore.clear()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
      return Promise.reject(refreshError)
    }
  },
)

// Turn a DRF error payload into a readable string.
export function apiErrorMessage(error, fallback = 'Something went wrong.') {
  const data = error?.response?.data
  if (!data) return error?.message || fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (typeof data === 'object') {
    const parts = []
    for (const [key, value] of Object.entries(data)) {
      const text = Array.isArray(value) ? value.join(' ') : String(value)
      parts.push(key === 'non_field_errors' ? text : `${key}: ${text}`)
    }
    if (parts.length) return parts.join(' • ')
  }
  return fallback
}
