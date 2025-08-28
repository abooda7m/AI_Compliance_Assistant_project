import axios from 'axios'
import { supabase } from '../supabaseClient'

function getApiBaseUrl(): string {
  const stored = localStorage.getItem('smart-dataguard-api-url')
  return stored || (import.meta.env.VITE_API_BASE_URL as string) || ''
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 180000,
})

// attach JWT from Supabase for backend auth
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers = config.headers || {}
    ;(config.headers as any).Authorization = `Bearer ${token}`
  }
  return config
})

// normalize errors
api.interceptors.response.use(
  (r) => r,
  (e) => {
    const msg =
      e?.response?.data?.detail ||
      e?.response?.data?.message ||
      e?.message ||
      'Request failed'
    return Promise.reject(new Error(msg))
  }
)
