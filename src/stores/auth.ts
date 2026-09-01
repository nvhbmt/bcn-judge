/** Phiên đăng nhập phía client (zustand, mẫu imath authStore). */
import { create } from 'zustand'
import { api, ApiFailure } from '@/lib/api'
import type { Me } from '@/types/api'

interface AuthState {
  me: Me | null
  loading: boolean
  error: string | null
  bootstrap: () => Promise<void>
  login: (emailOrUsername: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: true,
  error: null,

  async bootstrap() {
    try {
      set({ me: await api.get<Me>('/auth/me'), loading: false, error: null })
    } catch {
      set({ me: null, loading: false })
    }
  },

  async login(emailOrUsername, password) {
    set({ error: null })
    try {
      const me = await api.post<Me>('/auth/login', { emailOrUsername, password })
      set({ me, error: null })
      return true
    } catch (err) {
      set({ error: err instanceof ApiFailure ? err.error.message : 'Không đăng nhập được.' })
      return false
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      set({ me: null })
    }
  },

  async changePassword(currentPassword, newPassword) {
    set({ error: null })
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      set((s) => ({ me: s.me ? { ...s.me, mustChangePassword: false } : null }))
      return true
    } catch (err) {
      set({ error: err instanceof ApiFailure ? err.error.message : 'Không đổi được mật khẩu.' })
      return false
    }
  },
}))
