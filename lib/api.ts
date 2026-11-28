// lib/api.ts — typed client for the AniList GraphQL API + home/browse/detail
// synthesis. Same behavior as the original vanilla js/api.js.
const ANILIST_URL = "https://graphql.anilist.co"
// absolute API origin baked at build time; "" = same-origin (website), set for the Android/iOS export
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/+$/, "")

export class APIError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = "APIError"
  }
}

const CARD_FIELDS = `
  id idMal title { romaji english native userPreferred }
  status format season seasonYear countryOfOrigin popularity meanScore averageScore
  genres episodes description(asHtml: true) isAdult
  coverImage { extraLarge large medium color }
  bannerImage
  startDate { year month day }
  endDate { year month day }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`

export async function gql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
  let res: Response
  try {
    res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new APIError("network", "Can't reach AniList. Check your connection.")
  }
  if (res.status === 429) {
    const ra = res.headers.get("Retry-After")
    throw new APIError("rate_limited", `AniList rate limit — wait a moment.${ra ? ` Retry in ${ra}s.` : ""}`)
  }
  if (!res.ok) throw new APIError("upstream", "AniList returned an error.")
  const j = await res.json()
  if (j.errors) throw new APIError("upstream", j.errors.map((e: any) => e.message).join("; "))
  return j.data
}

const stripTags = (s?: string) =>
  String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const pad2 = (n: number) => String(n).padStart(2, "0")
const releaseDate = (d?: any) =>
  d?.year ? `${d.year}-${pad2(d.month || 1)}-${pad2(d.day || 1)}` : ""
const scoreOf = (m: any) => {
  const s = m.averageScore ?? m.meanScore
  return s == null ? "" : String(Math.round(s) / 10)
}
const coverOf = (m: any) =>
  m.coverImage?.large ?? m.coverImage?.medium ?? m.coverImage?.extraLarge ?? ""
const titleOf = (t?: any) =>
  t && (t.english || t.romaji || t.native) || "Untitled"

export function card(m: any) {
  return {
    detailPath: String(m.id),
    subjectId: m.id,
    title: titleOf(m.title),
    cover: coverOf(m),
    backdrop: m.bannerImage || "",
    rating: scoreOf(m),
    releaseDate: releaseDate(m.startDate),
    genre: (m.genres || []).join(", "),
    description: stripTags(m.description),
    format: m.format,
    status: m.status,
  }
}

const LIST_QUERY = `query($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $format: MediaFormat, $search: String, $genreIn: [String], $tagIn: [String]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage total }
    media(type: ANIME, isAdult: false, sort: $sort, status: $status, season: $season, seasonYear: $seasonYear, format: $format, search: $search, genre_in: $genreIn, tag_in: $tagIn) { ${CARD_FIELDS} }
  }
}`

export async function anilistPage(opts: {
  search?: string | null
  sort?: string[] | null
  status?: string | null
  season?: string | null
  seasonYear?: number | null
  format?: string | null
  genreIn?: string[] | null
  tagIn?: string[] | null
  page?: number
  perPage?: number
}) {
  const { page = 1, perPage = 24 } = opts
  const data = await gql(LIST_QUERY, { ...opts, page, perPage })
  const p = data.Page
  return {
    items: (p.media || []).map(card),
    pager: { hasMore: !!p.pageInfo?.hasNextPage, totalCount: p.pageInfo?.total || 0 },
  }
}

const getSeason = () => {
  const month = new Date().getMonth() + 1
  const year = new Date().getFullYear()
  const season = month >= 3 && month <= 5 ? "SPRING" : month >= 6 && month <= 8 ? "SUMMER" : month >= 9 && month <= 11 ? "FALL" : "WINTER"
  return { season, year }
}

export async function homePayload() {
  const { season, year } = getSeason()
  const [trending, topRated, upcoming] = await Promise.all([
    anilistPage({ sort: ["TRENDING_DESC"], perPage: 24 }),
    anilistPage({ sort: ["SCORE_DESC"], perPage: 24 }),
    anilistPage({ sort: ["POPULARITY_DESC"], status: "NOT_YET_RELEASED", season, seasonYear: year, perPage: 24 }),
  ])
  const rows = [
    { title: "Trending Now", browse: { kind: "series", channelId: 2, sort: "Hottest", genre: "Anime" }, items: trending.items },
    { title: "Top Rated", browse: { kind: "series", channelId: 2, sort: "Rating", genre: "Anime" }, items: topRated.items },
    { title: "New & Upcoming", browse: { kind: "series", channelId: 2, sort: "Latest", genre: "Anime" }, items: upcoming.items },
  ]
  const hero = trending.items.slice(0, 6).map((i) => ({ ...i, backdrop: i.backdrop || i.cover }))
  return { hero, featured: hero, rows }
}

const DETAIL_QUERY = `query($id: Int) { Media(id: $id, type: ANIME, isAdult: false) {
  ${CARD_FIELDS}
  countryOfOrigin duration trailer { id site }
  synonyms isLicensed averageScore meanScore
  studios { edges { node { name isAnimationStudio } } }
  streamingEpisodes { title thumbnail }
  characters(sort: [ROLE, RELEVANCE], perPage: 12) {
    edges { role node { id image { large } name { full native userPreferred } }
      voiceActors(language: JAPANESE) { id image { large } name { full native userPreferred } }
    }
  }
} }`

export async function detailPayload(id: number) {
  const d = await gql(DETAIL_QUERY, { id })
  const m = d.Media
  if (!m) throw new APIError("not_found", "Title not found.")
  const score = scoreOf(m)
  // RELEASING shows often omit `episodes`; use nextAiring−1 aired count
  const aired = m.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : m.episodes ?? 0
  const isMovie = m.format === "MOVIE"
  const epCount = m.episodes ?? aired ?? 1
  const stars = (m.characters?.edges || [])
    .filter((e: any) => e.voiceActors && e.voiceActors.length)
    .slice(0, 12)
    .map((e: any) => ({
      name: e.voiceActors[0]?.name?.full || "Unknown",
      character: e.node?.name?.full || "",
    }))
  const subject = {
    ...card(m),
    subjectId: m.id,
    imdbRatingValue: score,
    countryName: m.countryOfOrigin || "",
    duration: m.duration ?? 24,
    studios: (m.studios?.edges || []).map((e: any) => e.node?.name).filter(Boolean),
    trailer: m.trailer || null,
    isLicensed: !!m.isLicensed,
    dubs: [] as any[],
  }
  // streamingEpisodes are NEWEST-FIRST, but their titles carry "Episode N" —
  // pair them by number so any subset aligns correctly with the grid
  const epByNumber = new Map<number, { title: string; thumbnail: string }>()
  for (const s of m.streamingEpisodes || []) {
    const mm = String(s?.title || "").match(/Episode\s+(\d+)/i)
    const n = mm ? Number(mm[1]) : NaN
    if (Number.isFinite(n) && n > 0 && !epByNumber.has(n)) {
      epByNumber.set(n, { title: String(s?.title || ""), thumbnail: s?.thumbnail || "" })
    }
  }
  const episodeList = [...epByNumber].map(([n, v]) => ({ n, ...v })).sort((a, b) => a.n - b.n)

  return {
    subject,
    resource: {
      seasons: [
        isMovie
          ? { se: 0, maxEp: 0 }
          : { se: 1, maxEp: m.status === "FINISHED" ? m.episodes ?? aired ?? 1 : aired || 1 },
      ],
    },
    stars,
    episodeList,
  }
}

// mimic the vanilla API surface so pages read naturally
export const API = {
  home: async () => ({ data: await homePayload() }),
  section: async () => ({ data: await homePayload() }),
  trending: async (page = 0, perPage = 24) => {
    // frontend is 0-based (AnimeDoc style); AniList is 1-based
    const d = await anilistPage({ sort: ["TRENDING_DESC"], page: Math.max(0, page) + 1, perPage })
    return { data: d }
  },
  detail: async (detailPath: string | number) => {
    const id = Number(detailPath)
    if (!Number.isInteger(id) || id <= 0)
      throw new APIError("bad_detail_path", "detailPath must be a numeric AniList id.")
    return { data: await detailPayload(id) }
  },
  search: async (keyword: string, { page = 1, perPage = 18 }: { page?: number; perPage?: number } = {}) => {
    const q = String(keyword || "").trim()
    if (!q) return { data: { items: [], pager: { hasMore: false, totalCount: 0 } } }
    const d = await anilistPage({ search: q, sort: ["SEARCH_MATCH"], page: Math.max(1, page), perPage: Math.min(50, perPage) })
    return { data: d }
  },
  suggest: async (keyword: string, perPage = 8) => {
    const q = String(keyword || "").trim()
    if (!q) return { data: { items: [] } }
    const d = await gql(
      `query($q: String) { Page(page: 1, perPage: $perPage) { media(type: ANIME, search: $q, sort: [TRENDING_DESC], isAdult: false) { title { english romaji } } } }`,
      { q, perPage }
    )
    return { data: { items: (d.Page?.media || []).map((m: any) => ({ word: titleOf(m.title) })) } }
  },
  browse: async (params: { channelId?: number; sort?: string; genre?: string; page?: number; perPage?: number } = {}) => {
    const channelId = Number(params.channelId || 2)
    const sortIn = String(params.sort || "Hottest")
    const sort = sortIn === "Latest" ? ["START_DATE_DESC"] : sortIn === "Rating" ? ["SCORE_DESC"] : ["POPULARITY_DESC"]
    const genre = String(params.genre || "")
    let genreIn: string[] | null = null,
      tagIn: string[] | null = null
    if (genre && genre !== "Anime") {
      if (genre === "Isekai" || genre === "Ecchi") tagIn = [genre]
      else genreIn = [genre]
    }
    const page = Math.max(1, Number(params.page || 1))
    const perPage = Math.min(50, Math.max(1, Number(params.perPage || 30)))
    const formatIn = channelId === 1 ? ["MOVIE"] : ["TV", "TV_SHORT", "ONA", "OVA", "SPECIAL"]
    const d = await gql(LIST_QUERY, {
      page,
      perPage,
      sort,
      format: channelId === 1 ? "MOVIE" : undefined,
      genreIn,
      tagIn,
    })
    const items = (d.Page.media || [])
      .filter((m: any) => formatIn.includes(m.format))
      .map(card)
    return {
      data: {
        items,
        pager: { hasMore: !!d.Page.pageInfo?.hasNextPage, totalCount: d.Page.pageInfo?.total || 0 },
      },
    }
  },
}
