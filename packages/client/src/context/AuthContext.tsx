import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'
import api from '../api/client'
import Keycloak from 'keycloak-js'

export interface User {
  id: string
  email: string
  role: string
  keycloakId?: string
}

interface AuthCtx {
  user: User | null
  token: string | null
  loading: boolean
  isKeycloak: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithKeycloak: () => void
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(AuthContext)

// Keycloak client config
const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'food-ordering',
  clientId: 'food-ordering-app',
}

// ─── Singleton Keycloak instance ─────────────────────────────────────────────
// Prevents React 18 Strict Mode from calling kc.init() twice
let globalKc: Keycloak | null = null
let globalKcInitPromise: Promise<boolean> | null = null

function getOrCreateKc(): Keycloak {
  if (!globalKc) {
    globalKc = new Keycloak(keycloakConfig)
  }
  return globalKc
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isKeycloak, setIsKeycloak] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const keycloakRef = useRef<Keycloak | null>(null)

  // ─── Init: Restore session or handle OIDC callback ─────────────────────────
  useEffect(() => {
    let cancelled = false

    const initAuth = async () => {
      const authType = localStorage.getItem('auth_type')
      const storedToken = localStorage.getItem('token')

      // Detect Keycloak OIDC redirect code in URL
      const urlParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const hasCode = urlParams.has('code') || hashParams.has('code')

      try {
        if (hasCode) {
          // ── Case 1: Returning from Keycloak login redirect with code ──────────
          const kc = getOrCreateKc()
          keycloakRef.current = kc

          if (!globalKcInitPromise) {
            globalKcInitPromise = kc.init({
              pkceMethod: 'S256',
              checkLoginIframe: false,
            })
          }

          const authenticated = await globalKcInitPromise

          // Clean up OIDC state from URL immediately
          window.history.replaceState(null, '', window.location.pathname)

          if (!cancelled && authenticated && kc.token) {
            localStorage.setItem('token', kc.token)
            localStorage.setItem('auth_type', 'keycloak')
            if (kc.refreshToken) {
              localStorage.setItem('refresh_token', kc.refreshToken)
            }
            setToken(kc.token)
            setIsKeycloak(true)

            // Sync user to DB and get profile (role sync happens here)
            const response = await api.get('/auth/profile', {
              headers: { Authorization: `Bearer ${kc.token}` },
            })
            if (!cancelled) setUser(response.data.data)
          }

        } else if (storedToken && authType === 'keycloak') {
          // ── Case 2: Existing Keycloak session — validate stored token via API ─
          // NO check-sso iframe, NO Keycloak.init() needed here
          // Just validate against our backend which also does Keycloak introspection
          try {
            const response = await api.get('/auth/profile', {
              headers: { Authorization: `Bearer ${storedToken}` },
            })
            if (!cancelled) {
              // Token still valid — restore session without touching Keycloak JS
              // Also set up Keycloak instance for token refresh later
              const kc = getOrCreateKc()
              keycloakRef.current = kc
              if (!globalKcInitPromise) {
                // Init silently (no onLoad) so kc has access to token for refresh
                globalKcInitPromise = kc.init({
                  token: storedToken,
                  refreshToken: localStorage.getItem('refresh_token') ?? undefined,
                  pkceMethod: 'S256',
                  checkLoginIframe: false,
                })
                await globalKcInitPromise
              }
              setToken(storedToken)
              setIsKeycloak(true)
              setUser(response.data.data)
            }
          } catch {
            // Token expired or revoked — clear session
            if (!cancelled) clearAuthData()
          }

        } else if (storedToken && authType === 'local') {
          // ── Case 3: Local email/password session ──────────────────────────────
          try {
            const response = await api.get('/auth/profile', {
              headers: { Authorization: `Bearer ${storedToken}` },
            })
            if (!cancelled) {
              setToken(storedToken)
              setIsKeycloak(false)
              setUser(response.data.data)
            }
          } catch {
            if (!cancelled) clearAuthData()
          }

        } else {
          // ── Case 4: No session — anonymous user ───────────────────────────────
          if (!cancelled) clearAuthData()
        }
      } catch (err) {
        console.error('[AuthContext] Init error:', err)
        // Clean up any OIDC state from URL
        if (window.location.hash.includes('state=') || window.location.search.includes('state=')) {
          window.history.replaceState(null, '', window.location.pathname)
        }
        if (!cancelled) clearAuthData()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initAuth()

    return () => {
      cancelled = true
    }
  }, [])

  // ─── Auto Token Refresh (Keycloak only) ─────────────────────────────────────
  useEffect(() => {
    if (!isKeycloak || !keycloakRef.current) return

    const interval = setInterval(async () => {
      const kc = keycloakRef.current
      if (!kc) return

      try {
        // Only refresh if token expires within the next 70 seconds
        if (kc.isTokenExpired(70)) {
          const refreshed = await kc.updateToken(70)
          if (refreshed && kc.token) {
            localStorage.setItem('token', kc.token)
            if (kc.refreshToken) {
              localStorage.setItem('refresh_token', kc.refreshToken)
            }
            setToken(kc.token)
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Token refresh failed, logging out:', err)
        logout()
      }
    }, 30_000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isKeycloak, token])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const clearAuthData = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_type')
    setToken(null)
    setUser(null)
    setIsKeycloak(false)
    // Reset singletons so next login is fresh
    globalKc = null
    globalKcInitPromise = null
    keycloakRef.current = null
  }

  // ─── Auth Operations ─────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await api.post('/auth/login', { email, password })
      const { accessToken, user: u } = response.data.data
      localStorage.setItem('token', accessToken)
      localStorage.setItem('auth_type', 'local')
      setToken(accessToken)
      setUser(u)
      setIsKeycloak(false)
    } finally {
      setLoading(false)
    }
  }

  const loginWithKeycloak = () => {
    // Always create a fresh Keycloak instance for login flow
    if (!globalKc) globalKc = new Keycloak(keycloakConfig)
    keycloakRef.current = globalKc

    if (!globalKcInitPromise) {
      globalKcInitPromise = globalKc.init({
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
    }

    globalKcInitPromise.then(() => {
      keycloakRef.current?.login()
    }).catch(() => {
      // init might have already authenticated; just call login anyway
      keycloakRef.current?.login()
    })
  }

  const register = async (email: string, password: string) => {
    await api.post('/auth/register', { email, password })
  }

  const logout = async () => {
    setLoading(true)
    const authType = localStorage.getItem('auth_type')
    const currentToken = token

    try {
      if (authType === 'keycloak') {
        // Silent backchannel logout — backend revokes session in Keycloak
        const refreshToken =
          keycloakRef.current?.refreshToken ?? localStorage.getItem('refresh_token')
        if (currentToken) {
          await api.post('/auth/logout', { accessToken: currentToken, refreshToken }).catch(() => {})
        }
      } else {
        // Local auth logout
        if (currentToken) {
          await api.post('/auth/logout', { refreshToken: currentToken }).catch(() => {})
        }
      }
    } catch (err) {
      console.error('[AuthContext] Logout error:', err)
    } finally {
      clearAuthData()
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, isKeycloak, login, loginWithKeycloak, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
