import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, tokenStore } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch {
      tokenStore.clear()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const finishLogin = (data) => {
    tokenStore.set({ access: data.access, refresh: data.refresh })
    setUser(data.user)
    return data.user
  }

  const loginWithGoogle = useCallback(async (idToken) => {
    const { data } = await api.post('/auth/google/', { id_token: idToken })
    return finishLogin(data)
  }, [])

  const devLogin = useCallback(async (email, isCreator = false) => {
    const { data } = await api.post('/auth/dev-login/', {
      email,
      is_creator: isCreator,
    })
    return finishLogin(data)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const { data } = await api.patch('/auth/me/', patch)
    setUser(data)
    return data
  }, [])

  const value = {
    user,
    loading,
    loginWithGoogle,
    devLogin,
    logout,
    updateProfile,
    reloadUser: loadMe,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
