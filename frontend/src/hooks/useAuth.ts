import { useEffect, useState } from 'react'

interface AuthUser {
  accountName: string
  gggUuid: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    fetch('/auth/me')
      .then(res => {
        if (res.ok) return res.json() as Promise<AuthUser>
        return null
      })
      .then(user => setState({ user, loading: false }))
      .catch(() => setState({ user: null, loading: false }))
  }, [])

  return state
}
