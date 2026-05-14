import { NextRequest, NextResponse } from 'next/server'
import type { GA4Stats } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const since = searchParams.get('since') ?? nDaysAgo(30)
  const until = searchParams.get('until') ?? today()

  const propertyId = process.env.ANKA_GA4_PROPERTY_ID
  const saJson = process.env.ANKA_GA4_SERVICE_ACCOUNT_JSON

  if (!propertyId || !saJson) return NextResponse.json(mockGA4(), { status: 200 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data' as any)
    const credentials = JSON.parse(saJson)
    const client = new BetaAnalyticsDataClient({ credentials })

    const [overview, pages, channels] = await Promise.all([
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: since, endDate: until }],
        metrics: [
          { name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' }, { name: 'screenPageViewsPerSession' },
        ],
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ])

    const r = overview[0].rows?.[0]?.metricValues ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats: GA4Stats = {
      sessions: parseInt(r[0]?.value ?? '0'),
      users: parseInt(r[1]?.value ?? '0'),
      newUsers: parseInt(r[2]?.value ?? '0'),
      bounceRate: Math.round(parseFloat(r[3]?.value ?? '0') * 100),
      avgSessionDuration: Math.round(parseFloat(r[4]?.value ?? '0')),
      pageviewsPerSession: Math.round(parseFloat(r[5]?.value ?? '0') * 10) / 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      topPages: ((pages[0].rows ?? []) as any[]).map((row: any) => ({
        path: row.dimensionValues?.[0]?.value ?? '/',
        views: parseInt(row.metricValues?.[0]?.value ?? '0'),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channelBreakdown: ((channels[0].rows ?? []) as any[]).map((row: any) => ({
        channel: row.dimensionValues?.[0]?.value ?? 'Other',
        sessions: parseInt(row.metricValues?.[0]?.value ?? '0'),
      })),
    }
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[ga4]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function today() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function mockGA4(): GA4Stats {
  return {
    sessions: 3120, users: 2480, newUsers: 1890,
    bounceRate: 58, avgSessionDuration: 142, pageviewsPerSession: 2.4,
    topPages: [
      { path: '/', views: 1240 },
      { path: '/collections/collares', views: 680 },
      { path: '/products/collar-talisman', views: 420 },
      { path: '/collections/anillos', views: 390 },
      { path: '/collections/all', views: 310 },
    ],
    channelBreakdown: [
      { channel: 'Paid Social', sessions: 1180 },
      { channel: 'Organic Search', sessions: 620 },
      { channel: 'Paid Search', sessions: 480 },
      { channel: 'Direct', sessions: 390 },
      { channel: 'Organic Social', sessions: 280 },
      { channel: 'Email', sessions: 170 },
    ],
  }
}
