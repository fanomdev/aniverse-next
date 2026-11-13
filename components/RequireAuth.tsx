"use client"
import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Auth } from "@/lib/auth"

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (Auth.user()) {
      setOk(true)
      return
    }
    const next = window.location.pathname.replace(/^\//, "") + window.location.search
    router.replace(`/?next=${encodeURIComponent(next)}`)
  }, [router])

  if (!ok) return null
  return <>{children}</>
}
