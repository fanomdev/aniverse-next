"use client"
// AppShell — header/bottom-nav/footer; hidden on the login page
import { usePathname } from "next/navigation"
import SiteHeader from "./SiteHeader"
import { BottomNav, Footer } from "./BottomNav"
import ChatWidget from "./ChatWidget"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/"
  const isLogin = pathname === "/"

  if (isLogin) {
    return <div className="contents" style={{ "--pb": "0px" } as React.CSSProperties}>{children}</div>
  }

  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <BottomNav />
      <Footer />
      <ChatWidget />
    </>
  )
}
