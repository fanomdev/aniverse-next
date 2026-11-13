/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "s4.anilist.co" }],
  },
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
