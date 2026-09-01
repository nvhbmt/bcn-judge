/**
 * Theo dõi theme đang áp. Dùng cho component KHÔNG tô màu bằng biến CSS được —
 * cụ thể là CodeMirror, vốn nhận chủ đề bằng extension chứ không bằng class.
 */
import { useEffect, useState } from 'react'
import { currentTheme, THEME_EVENT, type Theme } from '@/lib/theme'

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => currentTheme())
  useEffect(() => {
    const onChange = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, onChange)
    return () => window.removeEventListener(THEME_EVENT, onChange)
  }, [])
  return theme
}
