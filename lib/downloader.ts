// lib/downloader.ts — in-app episode downloads (Android/iOS via Capacitor).
// Falls back to the browser download (worker dl=1 link) on the web.
import { Filesystem, Directory } from "@capacitor/filesystem"

export interface DownloadMeta {
  detailPath: string
  subjectId: string | number
  title: string
  se: number
  ep: number
  audio: "sub" | "dub"
  cover?: string
}
export interface DownloadEntry extends DownloadMeta {
  id: string
  file: string
  size: number
  ts: number
}

const IDX_KEY = "aniverse_downloads"

const safeFile = (s: string) =>
  String(s).replace(/[^\w\- .()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 60) || "episode"

const readIndex = (): DownloadEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(IDX_KEY) || "[]")
  } catch {
    return []
  }
}
const writeIndex = (list: DownloadEntry[]) => localStorage.setItem(IDX_KEY, JSON.stringify(list.slice(0, 200)))

const isNative = () =>
  typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform?.()

// base64 for moderate-size chunks without blowing the call stack
const toB64 = (bytes: Uint8Array) => {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  return btoa(s)
}

export const Downloader = {
  isNative,

  list(): DownloadEntry[] {
    return readIndex()
  },

  get(id: string) {
    return readIndex().find((e) => e.id === id) || null
  },

  async uri(entry: DownloadEntry): Promise<string> {
    const { uri } = await Filesystem.getUri({ path: entry.file, directory: Directory.Data })
    return uri
  },

  async remove(id: string) {
    const entry = this.get(id)
    if (entry) {
      try {
        await Filesystem.deleteFile({ path: entry.file, directory: Directory.Data })
      } catch {}
      writeIndex(readIndex().filter((e) => e.id !== id))
    }
  },

  // dlHref: any direct MP4 URL (accepts the worker URL with ?dl=1&name=...)
  async download(
    meta: DownloadMeta,
    dlHref: string,
    onProgress?: (pct: number) => void
  ): Promise<DownloadEntry> {
    if (!isNative()) {
      // web: just trigger the browser download
      const a = document.createElement("a")
      a.href = dlHref
      a.rel = "noreferrer"
      document.body.appendChild(a)
      a.click()
      a.remove()
      throw new Error("browser_used")
    }
    const res = await fetch(dlHref)
    if (!res.ok || !res.body) throw new Error(`source HTTP ${res.status}`)
    const total = Number(res.headers.get("content-length") || 0)
    const file = `${safeFile(meta.title)} - ${meta.se === 0 ? "Movie" : `S${meta.se}E${meta.ep}`} [${meta.audio}].mp4`
    const reader = res.body.getReader()
    let received = 0
    let first = true
    // delete stale file of same name (re-download)
    try { await Filesystem.deleteFile({ path: file, directory: Directory.Data }) } catch {}
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const data = toB64(value)
      if (first) {
        await Filesystem.writeFile({ path: file, data, directory: Directory.Data })
        first = false
      } else {
        await Filesystem.appendFile({ path: file, data, directory: Directory.Data })
      }
      received += value.byteLength
      if (total) onProgress?.(Math.round((received / total) * 100))
    }
    const entry: DownloadEntry = {
      ...meta,
      id: `${meta.detailPath}|${meta.se}|${meta.ep}|${meta.audio}|${Date.now()}`,
      file,
      size: received,
      ts: Date.now(),
    }
    writeIndex([entry, ...readIndex()])
    return entry
  },
}
