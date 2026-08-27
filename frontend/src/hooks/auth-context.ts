import { createContext } from 'react'

import type { AuthResponse, Profile } from '@/types/api'

export interface AuthContextValue {
  profile: Profile | undefined
  isLoading: boolean
  isAuthenticated: boolean
  isStaff: boolean
  login: (email: string, password: string) => Promise<AuthResponse>
  register: (payload: { email: string; password: string; full_name: string; phone?: string }) => Promise<AuthResponse>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
