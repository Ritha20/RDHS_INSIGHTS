import { notFound } from 'next/navigation'
import { getChapter } from '@/lib/chapters'
import ChapterPageClient from '@/components/ChapterPageClient'
import type { IndicatorResponse } from '@/lib/types'

interface Props {
  params: Promise<{ chapter: string }>
}

const PROVINCE_CODES = [1, 2, 3, 4, 5]

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchProvince(
  path: string,
  params: Record<string, string>,
  region: number
): Promise<IndicatorResponse | null> {
  try {
    const url = new URL(`${API_URL}${path}`)
    Object.entries({ ...params, region: String(region) }).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function ChapterPage({ params }: Props) {
  const { chapter: slug } = await params
  const chapter = getChapter(slug)
  if (!chapter) notFound()

  const defaultIndicator = chapter.indicators[0]
  let initialData: (IndicatorResponse | null)[] = [null, null, null, null, null]

  if (defaultIndicator) {
    // Include dynamic param defaults so SSR data matches the client query params
    const svrParams: Record<string, string> = { ...(defaultIndicator.fixedParams ?? {}) }
    defaultIndicator.dynamicParams?.forEach((p) => {
      svrParams[p.key] = p.default
    })
    initialData = await Promise.all(
      PROVINCE_CODES.map((code) => fetchProvince(defaultIndicator.path, svrParams, code))
    )
  }

  return <ChapterPageClient chapter={chapter} initialData={initialData} />
}

export async function generateStaticParams() {
  const { CHAPTERS } = await import('@/lib/chapters')
  return CHAPTERS.map((c) => ({ chapter: c.slug }))
}
