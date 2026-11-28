import type { Metadata, Viewport } from "next"
import "./globals.css"
import "./auth.css"
import "./otp.css"
import "./glassy-buttons.css"
import "./name-particles.css"
import "./glassy-navbar.css"
import "glisse/styles.css"
import AppShell from "@/components/AppShell"

export const metadata: Metadata = {
  title: "AniVerse — Watch Anime Online Free",
  description:
    "AniVerse is a fast, mobile-friendly anime streaming site. Sign in to watch thousands of episodes, track your watchlist and pick up where you left off.",
  icons: [
    {
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23ff8a00'/><path d='M38 30 L74 50 L38 70 Z' fill='%23141414'/></svg>",
    },
  ],
}

export const viewport: Viewport = {
  themeColor: "#0e0f14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="aurora">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
