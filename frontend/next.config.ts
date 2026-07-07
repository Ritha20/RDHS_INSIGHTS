import type { NextConfig } from 'next'

const replitDomain = process.env.REPLIT_DEV_DOMAIN
const replitDomains = process.env.REPLIT_DOMAINS
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
const backendUrl = apiUrl.replace(/\/api$/, '')

const allowedOrigins: string[] = []
if (replitDomain) allowedOrigins.push(replitDomain)
if (replitDomains) {
  replitDomains.split(',').forEach((d) => allowedOrigins.push(d.trim()))
}

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  experimental: {
    // Next 15.5 devtools Segment Explorer can corrupt the RSC client manifest
    // in this app during Webpack dev reloads, producing:
    // "__webpack_modules__[moduleId] is not a function".
    devtoolSegmentExplorer: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
  allowedDevOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
}

export default nextConfig
