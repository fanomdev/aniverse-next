// lib/theme.ts — app theme persistence (localStorage + <html data-theme>)
export const THEMES = [
  { id: "ember", name: "Ember" },
  { id: "aurora", name: "Aurora · Glass" },
  { id: "pink", name: "Pink" },
  { id: "midnight", name: "Midnight" },
  { id: "daylight", name: "Daylight" },
] as const
export type ThemeId = (typeof THEMES)[number]["id"]
export const DEFAULT_THEME: ThemeId = "aurora"
const KEY = "aniverse_theme"

export function applyTheme(t: string) {
  try {
    document.documentElement.dataset.theme = t
  } catch {}
}
export function saveTheme(t: string) {
  try {
    localStorage.setItem(KEY, t)
  } catch {}
  applyTheme(t)
}
export function getTheme(): ThemeId {
  try {
    const t = localStorage.getItem(KEY)
    return (THEMES.some((x) => x.id === t) ? t : DEFAULT_THEME) as ThemeId
  } catch {
    return DEFAULT_THEME
  }
}
