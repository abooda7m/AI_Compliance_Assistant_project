// src/lib/hooks.ts
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from './api'
import type {
  UploadResponse,
  SensitivityReport,
  ComplianceReport,
} from '../types'
import { useI18n } from './i18n'

/* =========================
   Data hooks (مشتركة)
   ========================= */

// Health check
export function useHealth() {
  return useQuery<{ status: string; org_id?: string }, Error>({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health')).data,
  })
}

// Upload (POST /upload multipart)
export function useUpload() {
  return useMutation<UploadResponse, Error, File>({
    mutationFn: async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post<UploadResponse>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
  })
}

// Sensitivity (GET /sensitivity?file_id=...)
export function useSensitivity(file_id: string | null) {
  return useQuery<SensitivityReport, Error>({
    queryKey: ['sensitivity', file_id],
    enabled: !!file_id,
    queryFn: async () =>
      (await api.get('/sensitivity', { params: { file_id } })).data,
  })
}

// Audit (GET /audit?file_id=...)
export function useAudit(file_id: string | null) {
  return useQuery<ComplianceReport, Error>({
    queryKey: ['audit', file_id],
    enabled: !!file_id,
    queryFn: async () =>
      (await api.get('/audit', { params: { file_id } })).data,
  })
}

/* =========================
   UI Pref hooks (ثيم + لغة)
   ========================= */

export type Theme = 'light' | 'dark'

export function useTheme() {
  const initial: Theme = useMemo(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved === 'light' || saved === 'dark') return saved
    } catch {}
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  }, [])

  const [theme, setTheme] = useState<Theme>(initial)

  // طبّق كلاس dark على <html> وخزّن الاختيار
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  // (اختياري) تزامن تلقائي مع تغيّر ثيم النظام إذا المستخدم ما خزّن اختيار يدوي
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved) return // المستخدم مختار يدويًا؛ لا نغيّر
      setTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  return { theme, setTheme }
}

export function useLang() {
  const { lang, setLang } = useI18n()
  return { lang, setLang }
}
