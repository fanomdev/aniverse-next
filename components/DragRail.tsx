"use client"
// DragRail — horizontal rail the user can grab and drag left/right (mouse).
// Touch/pen use the native horizontal scroll; cards stay clickable when not dragging.
import { useEffect, useRef } from "react"

export default function DragRail({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let down = false
    let startX = 0
    let startLeft = 0
    let dragged = false

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return // touch/pen: native horizontal scroll
      down = true
      dragged = false
      startX = e.clientX
      startLeft = el.scrollLeft
      el.classList.add("dragging")
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 6) dragged = true
      if (dragged) el.scrollLeft = startLeft - dx
    }
    const onUp = () => {
      down = false
      el.classList.remove("dragging")
      if (dragged) {
        el.dataset.dragged = "1"
        window.setTimeout(() => { el.dataset.dragged = "" }, 80)
      }
    }
    const onClickCapture = (e: Event) => {
      if (el.dataset.dragged === "1") {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onUp)
    el.addEventListener("click", onClickCapture, true)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onUp)
      el.removeEventListener("click", onClickCapture, true)
    }
  }, [])

  return (
    <div className={`rail drag-rail${className ? " " + className : ""}`} ref={ref}>
      {children}
    </div>
  )
}
