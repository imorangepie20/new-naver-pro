import { create } from 'zustand'
import { API_BASE } from '../lib/api'
import { useAuthStore } from './authStore'

export const hexToRgb = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0'
}

export type ThemeMode = 'light' | 'dark' | 'system' | 'smart'
export type AccentColor = 'cyan' | 'indigo' | 'pink' | 'orange' | 'green' | 'red' | 'teal' | 'purple' | 'amber' | 'slate'
export type FontSize = 'small' | 'medium' | 'large'
export type BorderRadius = 'sharp' | 'medium' | 'rounded'

export interface AccentColorConfig {
  name: string
  primary: string
  info: string
  warning: string
  danger: string
  success: string
}

export const ACCENT_COLORS: Record<AccentColor, AccentColorConfig> = {
  cyan: { name: '시안', primary: '#00FFCC', info: '#00D4FF', warning: '#FFA500', danger: '#FF4444', success: '#00CC66' },
  indigo: { name: '인디고', primary: '#6366F1', info: '#8B5CF6', warning: '#F59E0B', danger: '#EF4444', success: '#10B981' },
  pink: { name: '핑크', primary: '#FF1493', info: '#FF69B4', warning: '#FFA500', danger: '#FF1744', success: '#00E676' },
  orange: { name: '오렌지', primary: '#FF6B00', info: '#FF9500', warning: '#FFCC00', danger: '#FF3D00', success: '#00C853' },
  green: { name: '그린', primary: '#10B981', info: '#34D399', warning: '#FBBF24', danger: '#EF4444', success: '#059669' },
  red: { name: '레드', primary: '#EF4444', info: '#F87171', warning: '#FB923C', danger: '#DC2626', success: '#22C55E' },
  teal: { name: '틸', primary: '#14B8A6', info: '#2DD4BF', warning: '#F59E0B', danger: '#EF4444', success: '#059669' },
  purple: { name: '퍼플', primary: '#A855F7', info: '#C084FC', warning: '#F59E0B', danger: '#EF4444', success: '#22C55E' },
  amber: { name: '앰버', primary: '#F59E0B', info: '#FBBF24', warning: '#FB923C', danger: '#EF4444', success: '#10B981' },
  slate: { name: '슬레이트', primary: '#64748B', info: '#94A3B8', warning: '#F59E0B', danger: '#EF4444', success: '#22C55E' },
}

interface ThemeState {
  mode: ThemeMode
  accentColor: AccentColor
  fontSize: FontSize
  borderRadius: BorderRadius
  compactMode: boolean
  isSaving: boolean
  setMode: (mode: ThemeMode) => Promise<{ success: boolean; error?: string }>
  setAccentColor: (color: AccentColor) => Promise<{ success: boolean; error?: string }>
  setFontSize: (size: FontSize) => Promise<{ success: boolean; error?: string }>
  setBorderRadius: (radius: BorderRadius) => Promise<{ success: boolean; error?: string }>
  setCompactMode: (compact: boolean) => Promise<{ success: boolean; error?: string }>
  resetTheme: () => Promise<{ success: boolean; error?: string }>
  loadFromServer: () => Promise<void>
  saveToServer: () => Promise<{ success: boolean; error?: string }>
  getEffectiveMode: () => 'light' | 'dark' | 'smart'
  getAccentColorConfig: () => AccentColorConfig
}

const DEFAULT_THEME = {
  mode: 'smart' as ThemeMode,
  accentColor: 'cyan' as AccentColor,
  fontSize: 'medium' as FontSize,
  borderRadius: 'medium' as BorderRadius,
  compactMode: false,
}

function applyAccentVariables(accentColor: AccentColor) {
  const config = ACCENT_COLORS[accentColor]
  if (!config || typeof document === 'undefined') return

  const root = document.documentElement
  root.style.setProperty('--hud-accent-primary-rgb', hexToRgb(config.primary))
  root.style.setProperty('--hud-accent-info-rgb', hexToRgb(config.info))
  root.style.setProperty('--hud-accent-warning-rgb', hexToRgb(config.warning))
  root.style.setProperty('--hud-accent-danger-rgb', hexToRgb(config.danger))
  root.style.setProperty('--hud-accent-success-rgb', hexToRgb(config.success))
  root.style.setProperty('--hud-accent-primary', config.primary)
  root.style.setProperty('--hud-accent-info', config.info)
  root.style.setProperty('--hud-accent-warning', config.warning)
  root.style.setProperty('--hud-accent-danger', config.danger)
  root.style.setProperty('--hud-accent-success', config.success)
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  ...DEFAULT_THEME,
  isSaving: false,

  setMode: async (mode) => {
    set({ mode })
    return get().saveToServer()
  },

  setAccentColor: async (accentColor) => {
    set({ accentColor })
    applyAccentVariables(accentColor)
    return get().saveToServer()
  },

  setFontSize: async (fontSize) => {
    set({ fontSize })
    return get().saveToServer()
  },

  setBorderRadius: async (borderRadius) => {
    set({ borderRadius })
    return get().saveToServer()
  },

  setCompactMode: async (compactMode) => {
    set({ compactMode })
    return get().saveToServer()
  },

  resetTheme: async () => {
    set(DEFAULT_THEME)
    applyAccentVariables(DEFAULT_THEME.accentColor)
    return get().saveToServer()
  },

  saveToServer: async () => {
    const { mode, accentColor, fontSize, borderRadius, compactMode } = get()
    const { authFetch } = useAuthStore.getState()

    try {
      set({ isSaving: true })

      const response = await authFetch(`${API_BASE}/api/global-theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeMode: mode,
          accentColor,
          fontSize,
          borderRadius,
          compactMode,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save theme')
      }

      return { success: true }
    } catch (error) {
      console.error('Failed to save theme:', error)
      await get().loadFromServer()
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    } finally {
      set({ isSaving: false })
    }
  },

  loadFromServer: async () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('theme-storage')
      }

      const response = await fetch(`${API_BASE}/api/global-theme`)
      if (!response.ok) return

      const theme = await response.json()
      const themeData = {
        mode: (theme.mode || DEFAULT_THEME.mode) as ThemeMode,
        accentColor: (theme.accentColor || DEFAULT_THEME.accentColor) as AccentColor,
        fontSize: (theme.fontSize || DEFAULT_THEME.fontSize) as FontSize,
        borderRadius: (theme.borderRadius || DEFAULT_THEME.borderRadius) as BorderRadius,
        compactMode: theme.compactMode ?? DEFAULT_THEME.compactMode,
      }

      set(themeData)
      applyAccentVariables(themeData.accentColor)

      if (typeof document !== 'undefined') {
        const root = document.documentElement
        root.classList.remove('light', 'dark', 'smart')
        if (themeData.mode === 'system') {
          root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        } else {
          root.classList.add(themeData.mode)
        }
      }
    } catch (error) {
      console.error('Failed to load global theme:', error)
    }
  },

  getEffectiveMode: () => {
    const { mode } = get()
    if (mode === 'system' && typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode === 'system' ? 'light' : mode
  },

  getAccentColorConfig: () => {
    const { accentColor } = get()
    return ACCENT_COLORS[accentColor]
  },
}))
