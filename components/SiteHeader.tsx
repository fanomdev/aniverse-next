"use client"
// components/SiteHeader.tsx — top nav + search + suggest (client)
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { AuthSession } from "@/lib/auth"

import { Auth } from "@/lib/auth"
import { API } from "@/lib/api"

const links = [
  { href: "/home", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/trending", label: "Top" },
  { href: "/search", label: "Search" },
]

export default function SiteHeader() {
  const router = useRouter()
  const pathname = usePathname() || "/"
  const [query, setQuery] = useState("")
  const [suggest, setSuggest] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<AuthSession | null>(null)
  const tm = useRef<number | undefined>(undefined)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setUser(Auth.user())
    const initialQ = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") : ""
    setQuery(initialQ || "")
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".searchbar")) setOpen(false)
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [])

  const go = (q: string) => {
    const t = q.trim()
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`)
  }

  const onInput = (v: string) => {
    setQuery(v)
    if (tm.current) window.clearTimeout(tm.current)
    const q = v.trim()
    if (q.length < 2) { setSuggest([]); setOpen(false); return }
    tm.current = window.setTimeout(async () => {
      try {
        const { data } = await API.suggest(q, 8)
        const items = (data?.items || []).slice(0, 7).map((i: any) => i.word)
        setSuggest(items)
        setOpen(items.length > 0)
      } catch {
        setOpen(false)
      }
    }, 300)
  }

  const active = pathname.split("/")[1] || "home"

  return (
    <header id="siteHeader">
      <div className="header-inner">
        <Link className="logo" href="/home" aria-label="AniVerse home">
          <div className="logo-mark">▶</div>
          <div className="logo-text">ANI<b>VERSE</b></div>
        </Link>
        <nav className="nav" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={active === l.href.slice(1) ? "active" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="searchbar" style={{ position: "relative" }}>
          <input
            id="navSearch"
            type="search"
            placeholder="Search anime…"
            autoComplete="off"
            aria-label="Search anime"
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(query)
            }}
          />
          <button className="go" id="navSearchGo" aria-label="Search" onClick={() => go(query)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
          <div className={`suggest ${open ? "open" : ""}`} id="suggestBox" role="listbox" ref={boxRef}>
            {suggest.map((w: string) => (
              <button key={w} role="option" data-q={w} onClick={() => go(w)}>{w}</button>
            ))}
          </div>
        </div>
        <Link className="avatar-btn" href="/profile" aria-label="Profile">
          {(user?.username || "?").charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  )
}
