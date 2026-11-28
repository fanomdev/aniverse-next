"use client"
// GlassyNavbar — CodeXr Glassy Navbar v1, rebuilt cleanly:
// AniVerse logo/icons, plain links (no chevrons/dropdowns), guest-only login,
// expanding search pill that never pushes the logo or profile icon.
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { AuthSession } from "@/lib/auth"
import { Auth } from "@/lib/auth"

const links = [
  { href: "/home", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/trending", label: "Top" },
  { href: "/search", label: "Search" },
]

export default function GlassyNavbar() {
  const router = useRouter()
  const pathname = usePathname() || "/home"
  const barRef = useRef<HTMLElement | null>(null)
  const [user, setUser] = useState<AuthSession | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [wave, setWave] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { setUser(Auth.user()) }, [pathname])
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && searchOpen) { setSearchOpen(false); setQuery("") } }
    const outside = (e: MouseEvent) => { if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setQuery("") } }
    window.addEventListener("keydown", key)
    document.addEventListener("mousedown", outside)
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("mousedown", outside) }
  }, [searchOpen])
  useEffect(() => {
    let last = 0
    const onScroll = () => {
      const y = Math.max(0, window.scrollY)
      const d = y - last
      if (y <= 30) setScrolled(false)
      else if (d > 4) setScrolled(true)
      else if (d < -4) setScrolled(false)
      last = y
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const move = (e: React.MouseEvent) => {
    const bar = barRef.current
    if (!bar) return
    const r = bar.getBoundingClientRect()
    bar.style.setProperty("--mouse-x", `${e.clientX - r.left}px`)
    bar.style.setProperty("--mouse-y", `${e.clientY - r.top}px`)
  }
  const enter = () => barRef.current?.style.setProperty("--spotlight-opacity", "1")
  const leave = () => barRef.current?.style.setProperty("--spotlight-opacity", "0")
  const submitSearch = () => {
    const q = query.trim()
    if (!q) return
    setSearchOpen(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const active = pathname.split("/")[1] || "home"
  const showLogin = !user || !!user.guest

  return (
    <header className={`gb-nav-wrap${scrolled ? " is-scrolled" : ""}`}>
      <nav ref={barRef} className={`gb-nav-bar${scrolled ? " is-scrolled" : ""}${searchOpen ? " is-search-open" : ""}`} aria-label="Main Navigation" onMouseMove={move} onMouseEnter={enter} onMouseLeave={leave}>
        <span className="gb-nav-shiny-top-line" aria-hidden="true" />
        <span className="gb-nav-shiny-border-line" aria-hidden="true" />
        <Link href="/home" className="gb-nav-logo" aria-label="AniVerse home">
          <span className="logo-mark">▶</span>
          <span className="logo-text">ANI<b>VERSE</b></span>
        </Link>

        <ul className="gb-nav-links">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href} className={active === l.href.slice(1) ? "active" : ""}><span>{l.label}</span></Link></li>
          ))}
        </ul>

        <div className="gb-nav-right">
          <div className="gb-nav-search" ref={searchRef}>
            <div className={`gb-nav-search-pill${searchOpen ? " is-open" : " is-closed"}`} onClick={() => { if (!searchOpen) setSearchOpen(true) }}>
              <button type="button" className="gb-nav-search-icon" aria-label="Search anime" title="Search anime" onClick={() => { if (!searchOpen) setSearchOpen(true) }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </button>
              <div className="gb-nav-search-content">
                <input ref={inputRef} type="text" className="gb-nav-search-input" placeholder="Search anime…" aria-label="Search anime" value={query} tabIndex={searchOpen ? 0 : -1} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitSearch() } }} />
                <span className="gb-nav-search-actions">
                  <span className="gb-nav-search-esc" title="Press Escape to close">ESC</span>
                  <button type="button" className="gb-nav-search-close" aria-label="Close search" onClick={(e) => { e.stopPropagation(); setSearchOpen(false); setQuery("") }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              </div>
            </div>
          </div>
          {showLogin && (
            <button type="button" className="gb-nav-login" aria-label="Log in" onClick={() => { setWave((n) => n + 1); router.push("/?login=1") }}>
              <span className="gb-nav-wave" key={wave}>{"Log in".split("").map((ch, i) => <span key={i} style={{ animationDelay: `${i * 0.035}s` }}>{ch === " " ? "\u00a0" : ch}</span>)}</span>
            </button>
          )}
          {!showLogin && (
            <Link className="gb-nav-avatar" href="/profile" aria-label="Profile" title={user?.username}>
              {(user?.username || "?").charAt(0).toUpperCase()}
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
