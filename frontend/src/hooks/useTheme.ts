import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { usersApi } from '@/services/api'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

/** Hook to manage theme state: local-first, backend sync fallback */
export function useThemeProvider(): ThemeContextValue {
  const [theme, setTheme] = useState<Theme>(() => {
    // Priority: localStorage > user preference stored in user object > system
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const parsed = JSON.parse(user)
        if (parsed.theme === 'dark') return 'dark'
      } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      // Sync to backend in background — don't block UI on failure
      usersApi.updateTheme(next).catch(() => {
        // Silently ignore — local-first approach
      })
      // Update localStorage user object
      const stored = localStorage.getItem('user')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          localStorage.setItem('user', JSON.stringify({ ...parsed, theme: next }))
        } catch { /* ignore */ }
      }
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
