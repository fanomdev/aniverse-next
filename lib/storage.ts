// lib/storage.ts — watchlist + continue-watching helpers (localStorage).
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
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))

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

export const Continue = {
  all(): ContinueEntry[] {
    return read(CW_KEY, [])
  },
  save(entry: ContinueEntry) {
    const key = (e: ContinueEntry) => `${e.detailPath}|${e.se}|${e.ep}`
    const list = this.all().filter((e) => key(e) !== key(entry))
    list.unshift({ ...entry, ts: Date.now() })
    write(CW_KEY, list.slice(0, 60))
  },
  remove(detailPath: string, se: number, ep: number) {
    write(CW_KEY, this.all().filter((e) => !(e.detailPath === detailPath && e.se === se && e.ep === ep)))
  },
  forTitle(detailPath: string) {
    return this.all().filter((e) => e.detailPath === detailPath)
  },
}
