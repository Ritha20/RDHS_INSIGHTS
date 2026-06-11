import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'http://localhost:8000'

async function proxy(req: NextRequest, pathSegments: string[] | undefined) {
  const segments = pathSegments ?? []
  const suffix = segments.length > 0 ? '/' + segments.join('/') : ''
  const search = req.nextUrl.search ?? ''
  const backendUrl = `${BACKEND}/admin${suffix}/${search}`

  const headers = new Headers(req.headers)
  headers.set('host', 'localhost:8000')
  headers.delete('x-forwarded-host')
  headers.delete('x-forwarded-proto')
  headers.delete('x-forwarded-for')

  let body: BodyInit | null = null
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer()
  }

  const fetchRes = await fetch(backendUrl, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  })

  const resHeaders = new Headers(fetchRes.headers)

  const location = resHeaders.get('location')
  if (location) {
    const frontendOrigin = new URL(req.url).origin
    const rewritten = location
      .replace(/^http:\/\/localhost:8000/, frontendOrigin)
      .replace(/^https?:\/\/[^/]+(?=\/admin)/, frontendOrigin)
    resHeaders.set('location', rewritten)
  }

  resHeaders.delete('transfer-encoding')

  const responseBody = fetchRes.status === 204 || fetchRes.status === 304
    ? null
    : fetchRes.body

  return new NextResponse(responseBody as BodyInit, {
    status: fetchRes.status,
    headers: resHeaders,
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, (await params).path)
}
