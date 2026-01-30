'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem('dyia-theme') as Theme | null
    const initial = stored || 'system'
    setThemeState(initial)
    applyTheme(initial)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const current = (localStorage.getItem('dyia-theme') || 'system') as Theme
      if (current === 'system') {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    // Enable transitions on all elements during theme switch
    document.documentElement.classList.add('theme-transition')
    setThemeState(newTheme)
    localStorage.setItem('dyia-theme', newTheme)
    applyTheme(newTheme)
    // Remove transition class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 400)
  }, [])

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  return { theme, setTheme, resolvedTheme }
}
