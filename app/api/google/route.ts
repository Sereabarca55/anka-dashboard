import { NextRequest, NextResponse } from 'next/server'
import type { PeriodData, GoogleStats, GoogleCampaign } from '@/lib/types'

const MCC_ID = '5146261547'
const microsToCLP = (micros: number) => Math.round(micros / 1_000_000)

function prevRange(since: string, until: string) {
  const s = new Date(since), u = new Date(until)
  const days = Math.round((u.getTime() - s.getTime()) / 86400000) + 1
  const ps = new Date(s); ps.setDate(ps.getDate() - days)
  const pu = new Date(s); pu.setDate(pu.getDate() - 1)
  return { since: ps.toISOString().slice(0, 10), until: pu.toISOString().slice(0, 10) }
}

async function runGaql(customerId: string, gaql: string) {
  const { GoogleAdsApi } = await import('google-ads-api')
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_DEVELOPER_TOKEN!,
  })
  const customer = client.Customer({
    customer_id: customerId,
    login_customer_id: MCC_ID,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  })
  return customer.query(gaql)
}

function toGoogleDate(iso: string) { return iso.replace(/-/g, '') }

function buildSummary(rows: Record<string, unknown>[]): Omit<GoogleStats, 'campaigns'> {
  const spend = rows.reduce((s, r) => s + microsToCLP((r.metrics as Record<string,number>).cost_micros ?? 0), 0)
  const impressions = rows.reduce((s, r) => s + Number((r.metrics as Record<string,number>).impressions ?? 0), 0)
  const clicks = rows.reduce((s, r) => s + Number((r.metrics as Record<string,number>).clicks ?? 0), 0)
  const conversions = rows.reduce((s, r) => s + Number((r.metrics as Record<string,number>).conversions ?? 0), 0)
  return {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    avg_cpc: clicks > 0 ? spend / clicks : 0,
    conversions: Math.round(conversions),
    cpa: conversions > 0 ? Math.round(spend / conversions) : 0,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const since = searchParams.get('since') ?? nDaysAgo(30)
  const until = searchParams.get('until') ?? today()

  const cid = process.env.ANKA_GOOGLE_ADS_CID
  const hasGoogle = cid && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN

  if (!hasGoogle) return NextResponse.json(mockGoogle(), { status: 200 })

  try {
    const prev = prevRange(since, until)
    const gSince = toGoogleDate(since), gUntil = toGoogleDate(until)
    const gPSince = toGoogleDate(prev.since), gPUntil = toGoogleDate(prev.until)

    const [currRows, prevRows, campRows] = await Promise.all([
      runGaql(cid, `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date BETWEEN '${gSince}' AND '${gUntil}'`),
      runGaql(cid, `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date BETWEEN '${gPSince}' AND '${gPUntil}'`),
      runGaql(cid, `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${gSince}' AND '${gUntil}' AND campaign.status != 'REMOVED'`),
    ])

    const campaigns: GoogleCampaign[] = (campRows as Record<string,unknown>[]).map(r => {
      const m = r.metrics as Record<string, number>
      const c = r.campaign as Record<string, unknown>
      const spend = microsToCLP(m.cost_micros ?? 0)
      const conversions = Math.round(m.conversions ?? 0)
      return {
        id: String(c.id),
        name: String(c.name),
        status: String(c.status),
        spend,
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        conversions,
        cpa: conversions > 0 ? Math.round(spend / conversions) : 0,
      }
    }).sort((a, b) => b.spend - a.spend)

    const days = Math.round((new Date(until).getTime() - new Date(since).getTime()) / 86400000) + 1
    const result: PeriodData<GoogleStats> = {
      current: { ...buildSummary(currRows as Record<string,unknown>[]), campaigns },
      previous: { ...buildSummary(prevRows as Record<string,unknown>[]), campaigns: [] },
      period: { since, until, days },
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[google]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function today() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function mockGoogle(): PeriodData<GoogleStats> {
  const current: GoogleStats = {
    spend: 420000, impressions: 62000, clicks: 1860,
    ctr: 3.0, avg_cpc: 225, conversions: 9, cpa: 46666,
    campaigns: [
      { id: '1', name: 'Shopping - ANKA Joyería', status: 'ENABLED', spend: 245000, impressions: 38000, clicks: 1140, conversions: 6, cpa: 40833 },
      { id: '2', name: 'Brand - ANKA', status: 'ENABLED', spend: 95000, impressions: 14000, clicks: 490, conversions: 2, cpa: 47500 },
      { id: '3', name: 'Performance Max - Colecciones', status: 'ENABLED', spend: 80000, impressions: 10000, clicks: 230, conversions: 1, cpa: 80000 },
    ],
  }
  const previous: GoogleStats = {
    spend: 390000, impressions: 55000, clicks: 1650,
    ctr: 3.0, avg_cpc: 236, conversions: 7, cpa: 55714,
    campaigns: [],
  }
  return { current, previous, period: { since: nDaysAgo(30), until: today(), days: 30 } }
}
