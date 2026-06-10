import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../api/client'

interface User { id: string; email: string; role: string }
interface AuthCtx {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      api.get('/auth/profile')
        .then(r => setUser(r.data.data))
        .catch(() => logout())
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const r = await api.post('/auth/login', { email, password })
    const { accessToken, user: u } = r.data.data
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
    setUser(u)
  }

  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>
}
