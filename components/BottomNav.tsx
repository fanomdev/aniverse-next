"use client"
// Bottom navigation — glisse iOS-26 liquid-glass TabBar (spring selection, drag, lens).
import Link from "next/link"
import { TabBar } from "glisse"
import { usePathname } from "next/navigation"

const ico = (body: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: body }} />
)

const links = [
  { href: "/home", label: "Home", value: "home", icon: ico('<path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/>') },
  { href: "/browse", label: "Browse", value: "browse", icon: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M14 9h3M14 13h3"/>') },
  { href: "/trending", label: "Top", value: "trending", icon: ico('<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/>') },
  { href: "/search", label: "Search", value: "search", icon: ico('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>') },
  { href: "/profile", label: "Profile", value: "profile", icon: ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>') },
]

export function BottomNav() {
  const pathname = usePathname() || "/"
  const current = pathname.split("/")[1] || "home"
  return (
    <div className="dock-wrap">
      <TabBar
        className="dock-tabbar"
        items={links.map((l) => ({ value: l.value, label: l.label, icon: l.icon, href: l.href }))}
        value={links.find((l) => current === l.value)?.value ?? "home"}
        link={Link}
        aria-label="Mobile navigation"
      />
    </div>
  )
}

export function Footer() {
  return (
    <footer>
      AniVerse — anime metadata via AniList · streams from your host.<br />
      Built for phones first · add to Home Screen for the app feel.
    </footer>
  )
}
