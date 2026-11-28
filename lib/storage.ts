// lib/storage.ts — watchlist + continue-watching helpers (localStorage cache, mirrored to backend).
import { Sync, KEYS, type SyncKey } from "./sync"
export interface WatchlistItem {
  ts?: number
  subjectId: string | number
  detailPath: string
  title: string
  cover?: string
  rating?: string
  year?: string
}

export interface ContinueEntry {
  ts?: number
  subjectId: string | number
  detailPath: string
  title: string
  cover?: string
  se: number
  ep: number
  seasons?: { se: number; maxEp: number }[]
  time: number
  duration: number
}

const WL_KEY = "aniverse_watchlist"
const CW_KEY = "aniverse_continue"

const read = <T,>(k: string, fb: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(k) as string)
    return v == null ? fb : v
  } catch {
    return fb
  }
}
const write = (k: string, v: unknown) => {
  localStorage.setItem(k, JSON.stringify(v))
  const key = k.replace("aniverse_", "") as SyncKey
  if ((KEYS as readonly string[]).includes(key)) Sync.mark(key)
}

export const Watchlist = {
  all(): WatchlistItem[] {
    return read(WL_KEY, [])
  },
  has(dp: string) {
    return this.all().some((i) => i.detailPath === dp)
  },
  toggle(item: WatchlistItem) {
    let list = this.all()
    if (this.has(item.detailPath)) list = list.filter((i) => i.detailPath !== item.detailPath)
    else list.unshift({ ...item, ts: Date.now() })
    write(WL_KEY, list.slice(0, 300))
    return this.has(item.detailPath)
  },
  remove(detailPath: string) {
    write(WL_KEY, this.all().filter((i) => i.detailPath !== detailPath))
  },
}

const LIKE_KEY = "aniverse_likes"
const WATCHED_KEY = "aniverse_watched"

// episodes you've finished, keyed by show — so the grid/popover can mark them
export const Watched = {
  all(): Record<string, string[]> {
    try {
      return JSON.parse(localStorage.getItem(WATCHED_KEY) || "{}")
    } catch {
      return {}
    }
  },
  get(detailPath: string): string[] {
    return this.all()[detailPath] || []
  },
  has(detailPath: string, se: number, ep: number) {
    return this.get(detailPath).includes(`${se}:${ep}`)
  },
  add(detailPath: string, se: number, ep: number) {
    try {
      const all = this.all()
      const key = `${se}:${ep}`
      if (!(all[detailPath] || []).includes(key)) {
        all[detailPath] = [...(all[detailPath] || []), key]
        write(WATCHED_KEY, all)
      }
    } catch {}
  },
}

export const Likes = {
  all(): { detailPath: string; title: string; ts?: number }[] {
    return read(LIKE_KEY, [])
  },
  has(dp: string) {
    return this.all().some((i) => i.detailPath === dp)
  },
  toggle(item: { detailPath: string; title: string }) {
    let list = this.all()
    if (this.has(item.detailPath)) list = list.filter((i) => i.detailPath !== item.detailPath)
    else list.unshift({ ...item, ts: Date.now() })
    write(LIKE_KEY, list.slice(0, 300))
    return this.has(item.detailPath)
  },
}

// one entry PER SHOW (latest episode wins) — different episodes of the same anime overlap
export const Continue = {
  all(): ContinueEntry[] {
    const list: ContinueEntry[] = read(CW_KEY, [])
    const seen = new Map<string, ContinueEntry>()
    for (const e of list) {
      const prev = seen.get(e.detailPath)
      if (!prev || (e.ts ?? 0) > (prev.ts ?? 0)) seen.set(e.detailPath, e)
    }
    const out = [...seen.values()].filter((e) => (e.time ?? 0) > 0).sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    if (out.length !== list.length) write(CW_KEY, out)
    return out
  },
  save(entry: ContinueEntry) {
    const list = this.all().filter((e) => e.detailPath !== entry.detailPath)
    list.unshift({ ...entry, ts: Date.now() })
    write(CW_KEY, list.slice(0, 60))
  },
  remove(detailPath: string) {
    write(CW_KEY, this.all().filter((e) => e.detailPath !== detailPath))
  },
  forTitle(detailPath: string) {
    return this.all().filter((e) => e.detailPath === detailPath)
  },
}
