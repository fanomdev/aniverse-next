"use client"
// ThemeFlow — GradFlow WebGL background that follows the active AniVerse theme.
// fold = creased sheets of light (app), nebula = login page.
import { GradFlow } from "gradflow"
import { useEffect, useState } from "react"
import { DEFAULT_THEME, type ThemeId } from "@/lib/theme"

type Colors = { color1: string; color2: string; color3: string }
type Theme = ThemeId

const FOLD: Record<Theme, Colors> = {
  ember: { color1: "#ff8a00", color2: "#ff3d00", color3: "#2b1830" },
  aurora: { color1: "#c07bff", color2: "#8b4dff", color3: "#10122a" },
  pink: { color1: "#ff7ab8", color2: "#ff3d8b", color3: "#1f0d1a" },
  midnight: { color1: "#38b6ff", color2: "#0e8fdd", color3: "#0a0f1a" },
  daylight: { color1: "#e66d00", color2: "#ffb74d", color3: "#f5f4f0" },
}
const NEBULA: Colors = { color1: "#ff8a00", color2: "#8b4dff", color3: "#0e0f24" }

export default function ThemeFlow({ variant = "fold" }: { variant?: "fold" | "nebula" }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  useEffect(() => {
    const read = () => {
      const t = (document.documentElement.dataset.theme || DEFAULT_THEME) as Theme
      setTheme(FOLD[t] ? t : "ember")
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => obs.disconnect()
  }, [])

  if (variant === "nebula") {
    return <GradFlow className="theme-flow" interactive config={{ ...NEBULA, type: "nebula", speed: 0.35, scale: 1.1, noise: 0.28 }} />
  }
  const c = FOLD[theme]
  return <GradFlow className="theme-flow" interactive config={{ ...c, type: "fold", speed: 0.3, scale: 1.15, noise: 0.18 }} />
}
