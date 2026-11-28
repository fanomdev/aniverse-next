"use client"
// NameParticles — port of CodeXr's Particle Animation canvas engine.
// The default shape is the signed-in user's username; other shapes and a
// custom-text field behave exactly like the preview.
import { useEffect, useRef, useState } from "react"

const COUNT = 9000
const SPIN = 0.28
const TILT = 0.18
const INTERACT = 0.6
const FORCE = 4
const FRICTION = 0.04
const DAMP = 0.84
const MORPH_IN = 0.7
const MORPH_TOTAL = 1.6
const HOLD = 0.4
// reference ends stage 2 at b + ee + te, not at ee alone
const MORPH_END = MORPH_IN + MORPH_TOTAL + HOLD

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const rotY = (a: Float32Array, i: number, ang: number) => {
  const y = a[i + 1], z = a[i + 2]
  a[i + 1] = y * Math.cos(ang) - z * Math.sin(ang)
  a[i + 2] = y * Math.sin(ang) + z * Math.cos(ang)
}
const rotX = (a: Float32Array, i: number, ang: number) => {
  const x = a[i], y = a[i + 1]
  a[i] = x * Math.cos(ang) - y * Math.sin(ang)
  a[i + 1] = x * Math.sin(ang) + y * Math.cos(ang)
}

function sphere() {
  const a = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    let v = Math.random() < 0.28 ? (Math.random() < 0.5 ? -1 : 1) * (1 - Math.random() ** 2.2 * 0.35) : Math.random() * 2 - 1
    const phi = Math.random() * Math.PI * 2
    const r = Math.sqrt(1 - v * v)
    const rad = 1 + (Math.random() - 0.5) * 0.06
    a[i * 3] = Math.cos(phi) * r * rad
    a[i * 3 + 1] = v * rad
    a[i * 3 + 2] = Math.sin(phi) * r * rad
  }
  return a
}
function ring() {
  const a = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * Math.PI * 2
    const v = Math.random() * Math.PI * 2
    const r = 0.16 * Math.sqrt(Math.random())
    const j = i * 3
    a[j] = (1 + r * Math.cos(v)) * Math.cos(u)
    a[j + 1] = r * Math.sin(v)
    a[j + 2] = (1 + r * Math.cos(v)) * Math.sin(u)
    rotY(a, j, 1.15)
  }
  return a
}
function cube() {
  const a = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const j = i * 3
    const v = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]
    const face = Math.floor(Math.random() * 3)
    v[face] = Math.random() < 0.5 ? -1 : 1
    if (Math.random() < 0.35) {
      const other = (face + 1 + Math.floor(Math.random() * 2)) % 3
      v[other] = Math.random() < 0.5 ? -1 : 1
    }
    a[j] = v[0] * 0.72; a[j + 1] = v[1] * 0.72; a[j + 2] = v[2] * 0.72
    rotY(a, j, 0.5); rotX(a, j, 0.6)
  }
  return a
}
function heart() {
  const a = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const t = Math.random() * Math.PI * 2
    const r = Math.random() < 0.6 ? 0.88 + Math.random() * 0.12 : Math.sqrt(Math.random())
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    a[i * 3] = (x / 17) * r * 1.1
    a[i * 3 + 1] = (-y / 17) * r * 1.1 - 0.15
    a[i * 3 + 2] = (Math.random() * 2 - 1) * 0.28 * Math.sqrt(1 - r * 0.9)
  }
  return a
}
function textShape(text: string) {
  const font = '900 200px "Arial Black", "Helvetica Neue", system-ui, sans-serif'
  const c = document.createElement("canvas")
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + 40
  c.width = width; c.height = 280
  ctx.font = font
  ctx.fillStyle = "#fff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, width / 2, 140)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  const pts: number[] = []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (data[(y * c.width + x) * 4 + 3] > 128) {
      pts.push(x, y)
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  if (!pts.length) return sphere()
  const a = new Float32Array(COUNT * 3)
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
  const sy = text.length <= 2 ? 2 : 1.4
  const scale = Math.max((maxX - minX) / 3, (maxY - minY) / sy)
  const pairs = pts.length / 2
  for (let i = 0; i < COUNT; i++) {
    const k = Math.floor(Math.random() * pairs) * 2
    a[i * 3] = (pts[k] + Math.random() - midX) / scale
    a[i * 3 + 1] = (pts[k + 1] + Math.random() - midY) / scale
    a[i * 3 + 2] = (Math.random() * 2 - 1) * 0.06
  }
  return a
}
const shapePoints = (s: string) => {
  if (s === "ring") return ring()
  if (s === "cube") return cube()
  if (s === "heart") return heart()
  if (s.startsWith("text:")) return textShape(s.slice(5))
  return sphere()
}
const isTextShape = (s: string) => s.startsWith("text:")

export default function NameParticles({ name, onClose }: { name: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const morphRef = useRef<((shape: string) => void) | null>(null)
  const [shape, setShape] = useState(`text:${name}`)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let current = shapePoints(`text:${name}`)
    const from = new Float32Array(COUNT * 3)
    const burst = new Float32Array(COUNT * 3)
    const target = new Float32Array(COUNT * 3)
    target.set(current)
    const hold = new Float32Array(COUNT)
    const alpha = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) alpha[i] = 0.35 + Math.random() * 0.65

    let morph = -1
    let textMode = 1
    let spin = 0
    let targetX = 0, targetY = 0, smoothX = 0, smoothY = 0, pulse = 0
    let w = 0, h = 0, dpr = 1

    morphRef.current = (s: string) => {
      from.set(current)
      target.set(shapePoints(s))
      for (let i = 0; i < COUNT; i++) {
        const j = i * 3
        const dist = 1.5 + Math.random() * 0.6
        const phi = Math.random() * Math.PI * 2
        const theta = Math.acos(Math.random() * 2 - 1)
        const off = 0.35 + Math.random() * 0.35
        burst[j] = from[j] * dist + Math.sin(theta) * Math.cos(phi) * off
        burst[j + 1] = from[j + 1] * dist + Math.sin(theta) * Math.sin(phi) * off
        burst[j + 2] = from[j + 2] * dist + Math.cos(theta) * off
        hold[i] = Math.random() * HOLD
      }
      morph = 0
      textMode = +isTextShape(s)
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth * dpr
      h = canvas.clientHeight * dpr
      canvas.width = w; canvas.height = h
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const pointer = { x: -1e6, y: -1e6 }
    const onMove = (e: PointerEvent) => {
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.5
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.7
      const r = canvas.getBoundingClientRect()
      pointer.x = (e.clientX - r.left) * dpr
      pointer.y = (e.clientY - r.top) * dpr
    }
    const onLeave = () => { pointer.x = -1e6; pointer.y = -1e6 }
    window.addEventListener("pointermove", onMove)
    document.addEventListener("pointerleave", onLeave)
    window.addEventListener("blur", onLeave)

    const vx = new Float32Array(COUNT * 2)
    const vy = new Float32Array(COUNT * 2)
    let raf = 0
    let prev = performance.now()
    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      smoothX += (targetX - smoothX) * 0.05
      smoothY += (targetY - smoothY) * 0.05
      pulse += (textMode - pulse) * 0.04
      if (textMode) spin += (Math.round(spin / (Math.PI * 2)) * Math.PI * 2 - spin) * 0.05
      else if (!reduced) spin += dt * SPIN
      const wobble = Math.sin(now * 0.0008) * 0.28 * pulse

      if (morph >= 0) {
        morph += textMode ? dt * 1.1 : dt * 0.7
        if (morph < MORPH_IN) {
          const e = easeOut(morph / MORPH_IN)
          for (let i = 0; i < COUNT * 3; i++) current[i] = from[i] + (burst[i] - from[i]) * e
        } else if (morph < MORPH_END) {
          for (let i = 0; i < COUNT; i++) {
            const e = easeInOut(Math.min(Math.max((morph - MORPH_IN - hold[i]) / 1.6, 0), 1))
            const j = i * 3
            current[j] = burst[j] + (target[j] - burst[j]) * e
            current[j + 1] = burst[j + 1] + (target[j + 1] - burst[j + 1]) * e
            current[j + 2] = burst[j + 2] + (target[j + 2] - burst[j + 2]) * e
          }
        } else { current.set(target); morph = -1 }
      }

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = "#fff"
      ctx.globalCompositeOperation = "lighter"
      const size = Math.min(w, h) * 0.24
      const cx = w / 2, cy = h / 2
      const rot = spin + smoothY + wobble
      const tilt = TILT * (1 - pulse) + smoothX
      const cosY = Math.cos(rot), sinY = Math.sin(rot)
      const cosX = Math.cos(tilt), sinX = Math.sin(tilt)
      const radius = size * INTERACT
      const radiusSq = radius * radius
      const step = dt * 60

      for (let i = 0; i < COUNT; i++) {
        const j = i * 3
        const x = current[j], y = current[j + 1], z = current[j + 2]
        const rx = x * cosY + z * sinY
        const rz = -x * sinY + z * cosY
        const ry = y * cosX - rz * sinX
        const zz = y * sinX + rz * cosX
        const persp = 3.2 / Math.max(3.2 - zz, 0.5)
        const depth = Math.min(Math.max((zz + 1) / 2, 0), 1)
        const px = cx + rx * size * persp
        const py = cy + ry * size * persp
        const k = i * 2
        let gx = vy[k], gy = vy[k + 1]
        const dx = px + vx[k] - pointer.x
        const dy = py + vx[k + 1] - pointer.y
        const d2 = dx * dx + dy * dy
        if (d2 < radiusSq && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = (1 - d / radius) ** 2 * FORCE * dpr * (0.4 + 0.6 * depth)
          gx += (dx / d) * f * step
          gy += (dy / d) * f * step
        }
        gx = (gx - vx[k] * FRICTION * step) * DAMP ** step
        gy = (gy - vx[k + 1] * FRICTION * step) * DAMP ** step
        vx[k] += gx * step; vx[k + 1] += gy * step
        vy[k] = gx; vy[k + 1] = gy
        const s = (1 + depth * 1.3) * dpr
        ctx.globalAlpha = alpha[i] * (0.22 + 0.78 * depth)
        ctx.fillRect(px + vx[k] - s / 2, py + vx[k + 1] - s / 2, s, s)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      morphRef.current = null
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("blur", onLeave)
    }
  }, [name])

  const choose = (s: string) => { setShape(s); morphRef.current?.(s) }
  return (
    <div className="np-wrap">
      <canvas ref={canvasRef} className="particle-sphere" aria-label={`Particle animation of ${name}`} role="img" />
      <button className="np-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="morph-dock">
        <div className="morph-shapes" role="group" aria-label="Morph into">
          {[{ id: "sphere", label: "Sphere" }, { id: "ring", label: "Ring" }, { id: "cube", label: "Cube" }, { id: "heart", label: "Heart" }, { id: `text:${name}`, label: name }].map((s) => (
            <button key={s.id} type="button" className="morph-btn" aria-pressed={shape === s.id} onClick={() => choose(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
