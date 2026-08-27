import { type ReactNode, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { AuthContext, type AuthContextValue } from '@/hooks/auth-context'
import { AUTH_EXPIRED_EVENT } from '@/lib/authEvents'
import { tokenStore } from '@/lib/tokenStore'
import { authService } from '@/services/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const enabled = Boolean(tokenStore.getAccess() || tokenStore.getRefresh())

  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: authService.me,
    enabled,
    retry: false,
  })

  useEffect(() => {
    function onExpired() {
      tokenStore.clear()
      queryClient.removeQueries({ queryKey: ['me'] })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [queryClient])

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authService.login({ email, password }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      profile: profileQuery.data,
      isLoading: profileQuery.isLoading && enabled,
      isAuthenticated: Boolean(profileQuery.data),
      isStaff: Boolean(profileQuery.data && profileQuery.data.role !== 'CUSTOMER'),
      login: async (email, password) => loginMutation.mutateAsync({ email, password }),
      register: async (payload) => registerMutation.mutateAsync(payload),
      logout: async () => {
        await authService.logout()
        queryClient.clear()
        navigate('/')
      },
    }),
    [enabled, loginMutation, profileQuery.data, profileQuery.isLoading, queryClient, registerMutation, navigate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
