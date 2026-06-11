import type { IndicatorResponse } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const isServer = typeof window === 'undefined'

  let fetchUrl: string
  if (isServer) {
    const url = new URL(`${API_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
    fetchUrl = url.toString()
  } else {
    const url = new URL(`/api${path}`, window.location.origin)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
    fetchUrl = url.toString()
  }

  const res = await fetch(fetchUrl)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

export function fetchIndicator(
  path: string,
  params: Record<string, string> = {}
): Promise<IndicatorResponse> {
  return get<IndicatorResponse>(path, params)
}

export async function fetchAllProvinces(
  path: string,
  params: Record<string, string> = {}
): Promise<IndicatorResponse[]> {
  const codes = [1, 2, 3, 4, 5]
  return Promise.all(
    codes.map((code) => fetchIndicator(path, { ...params, region: String(code) }))
  )
}
