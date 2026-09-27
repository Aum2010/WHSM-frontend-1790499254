import axios from 'axios'
import { useAuthStore } from '../stores/auth.store'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
})

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const apiGet   = <T>(url: string) =>
  api.get<T>(url).then(r => r.data)
export const apiPost  = <T>(url: string, data?: unknown) =>
  api.post<T>(url, data).then(r => r.data)
export const apiPatch = <T>(url: string, data?: unknown) =>
  api.patch<T>(url, data).then(r => r.data)