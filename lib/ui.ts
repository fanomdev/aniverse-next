// lib/ui.ts — small helpers shared by pages (client-side).
export const $ = (s: string, root: ParentNode = document) => root.querySelector(s)
export const $$ = (s: string, root: ParentNode = document) => Array.from(root.querySelectorAll(s))
export const fmtRating = (r?: string | number | null) => {
  const n = r && r !== "0" ? Number(r) : NaN
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : null
}
export const yearOf = (d?: string) => {
  const y = (d || "").slice(0, 4)
  return /^\d{4}$/.test(y) ? y : ""
}
export const genres = (g?: string) =>
  (g || "").split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !/^(animation|anime)$/i.test(s))

// toast helper (vanilla-style DOM node so it works anywhere)
let toastEl: HTMLDivElement | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
export function toast(msg: string) {
  if (typeof document === "undefined") return
  if (!toastEl) {
    toastEl = document.createElement("div")
    toastEl.id = "toast"
    document.body.appendChild(toastEl)
  }
  toastEl.textContent = msg
  toastEl.classList.add("show")
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl?.classList.remove("show"), 3400)
}
