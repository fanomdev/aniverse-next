"use client"
// AppShell — header/bottom-nav/footer; hidden on the login page
import { usePathname } from "next/navigation"
import GlassyNavbar from "./GlassyNavbar"
import { BottomNav, Footer } from "./BottomNav"
import ChatWidget from "./ChatWidget"
import ThemeFlow from "./ThemeFlow"
import { useEffect, useState } from "react"
import { applyTheme, getTheme } from "@/lib/theme"
import { Auth } from "@/lib/auth"
import { Sync } from "@/lib/sync"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const isLogin = pathname === "/"

  const [sync, setSync] = useState(Sync.status())
  useEffect(() => {
    applyTheme(getTheme())
    void Auth.migrateLegacySession().then(() => Sync.pull()).then(() => setSync(Sync.status()))
    const onOnline = () => { void Sync.flush().then(() => setSync(Sync.status())) }
    const onChange = () => setSync(Sync.status())
    window.addEventListener("online", onOnline)
    window.addEventListener("aniverse:sync", onChange)
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("aniverse:sync", onChange) }
  }, [])

  if (isLogin) {
    return <div className="contents" style={{ "--pb": "0px" } as React.CSSProperties}>{children}</div>
  }

  return (
    <>
      <ThemeFlow />
      {sync.state !== "synced" && sync.state !== "idle" && (
        <div className={`sync-badge sync-${sync.state}`} title={sync.detail || ""} aria-live="polite">
          {sync.state === "syncing" ? "↻ Syncing…" : sync.state === "offline" ? "○ Offline" : sync.state === "pending" ? "• Queued" : sync.state === "conflict" ? "⚠ Conflict" : "⚠ Session"}
        </div>
      )}
      <GlassyNavbar />
      <main>{children}</main>
      <BottomNav />
      <Footer />
      <ChatWidget />
    </>
  )
}
