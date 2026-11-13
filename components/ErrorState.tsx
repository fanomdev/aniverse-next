// ErrorState — full-width error block; shows playbook when not configured

export default function ErrorState({ error }: { error: any }) {
  const code: string = error?.code || "error"
  const isUnconfigured = code === "unconfigured" || code === "http_503" || code === "upstream_error"
  return (
    <div className="state">
      <div className="big">{isUnconfigured ? "🔌" : "⚠️"}</div>
      <h3>{isUnconfigured ? "Streaming not configured" : "Something went wrong"}</h3>
      <p>{error?.message || String(error)}</p>
      {isUnconfigured ? (
        <p>
          Start the app with a stream host:<br />
          <code>$env:ANIME_SOURCES_BASE="http://localhost:9797"</code><br />
          (PowerShell: <code>$env:ANIME_SOURCES_BASE="http://localhost:9797"; pnpm dev</code>)
        </p>
      ) : null}
      {code === "rate_limited" && <p>AniList allows ~30 requests/minute — wait a moment and try again.</p>}
      <p style={{ color: "var(--muted)", fontSize: 12 }}>Tip: it may work — refresh after a few seconds.</p>
    </div>
  )
}
