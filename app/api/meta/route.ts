import { NextRequest, NextResponse } from 'next/server'
import type { PeriodData, MetaStats, MetaCampaign } from '@/lib/types'

const BASE = 'https://graph.facebook.com/v19.0'
const ACCOUNT_ID = 'act_493935245667521'

const FIELDS = [
  'spend', 'impressions', 'reach', 'frequency',
  'clicks', 'ctr', 'cpc', 'cpm',
  'actions', 'action_values',
].join(',')

function getAction(actions: {action_type: string; value: string}[], type: string) {
  return Number(actions?.find(a => a.action_type === type)?.value ?? 0)
}
function getActionVal(avs: {action_type: string; value: string}[], type: string) {
  return Number(avs?.find(a => a.action_type === type)?.value ?? 0)
}

async function fetchInsights(token: string, since: string, until: string, level: string, extra = '') {
  const url = `${BASE}/${ACCOUNT_ID}/insights?` + new URLSearchParams({
    access_token: token,
    fields: FIELDS + extra,
    time_range: JSON.stringify({ since, until }),
    level,
    limit: '200',
  })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`)
  return res.json()
}

function buildSummary(rows: Record<string, unknown>[]): Omit<MetaStats, 'campaigns'> {
  const spend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0)
  const impressions = rows.reduce((s, r) => s + Number(r.impressions ?? 0), 0)
  const reach = rows.reduce((s, r) => s + Number(r.reach ?? 0), 0)
  const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0)
  const purchases = rows.reduce((s, r) => s + getAction(r.actions as {action_type:string;value:string}[] ?? [], 'purchase'), 0)
  const revenue = rows.reduce((s, r) => s + getActionVal(r.action_values as {action_type:string;value:string}[] ?? [], 'purchase'), 0)
  const frequency = rows.length > 0 ? rows.reduce((s, r) => s + Number(r.frequency ?? 0), 0) / rows.length : 0
  return {
    spend: Math.round(spend),
    impressions,
    reach,
    frequency: Math.round(frequency * 10) / 10,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    purchases,
    revenue: Math.round(revenue),
    cpa: purchases > 0 ? Math.round(spend / purchases) : 0,
    roas: spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0,
  }
}

function prevRange(since: string, until: string) {
  const s = new Date(since), u = new Date(until)
  const days = Math.round((u.getTime() - s.getTime()) / 86400000) + 1
  const ps = new Date(s); ps.setDate(ps.getDate() - days)
  const pu = new Date(s); pu.setDate(pu.getDate() - 1)
  return { since: ps.toISOString().slice(0, 10), until: pu.toISOString().slice(0, 10) }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const since = searchParams.get('since') ?? nDaysAgo(30)
  const until = searchParams.get('until') ?? today()

  const token = process.env.META_ACCESS_TOKEN
  if (!token) return NextResponse.json(mockMeta(), { status: 200 })

  try {
    const prev = prevRange(since, until)
    const [currAcc, prevAcc, currCamp] = await Promise.all([
      fetchInsights(token, since, until, 'account'),
      fetchInsights(token, prev.since, prev.until, 'account'),
      fetchInsights(token, since, until, 'campaign', ',campaign_name'),
    ])

    const currRows: Record<string,unknown>[] = currAcc.data ?? []
    const prevRows: Record<string,unknown>[] = prevAcc.data ?? []
    const campRows: Record<string,unknown>[] = currCamp.data ?? []

    const campaigns: MetaCampaign[] = campRows.map(r => {
      const spend = Number(r.spend ?? 0)
      const purchases = getAction(r.actions as {action_type:string;value:string}[] ?? [], 'purchase')
      const revenue = getActionVal(r.action_values as {action_type:string;value:string}[] ?? [], 'purchase')
      return {
        id: r.campaign_id as string,
        name: r.campaign_name as string,
        status: 'active',
        spend: Math.round(spend),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        purchases,
        revenue: Math.round(revenue),
        roas: spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0,
      }
    }).sort((a, b) => b.spend - a.spend)

    const days = Math.round((new Date(until).getTime() - new Date(since).getTime()) / 86400000) + 1
    const result: PeriodData<MetaStats> = {
      current: { ...buildSummary(currRows), campaigns },
      previous: { ...buildSummary(prevRows), campaigns: [] },
      period: { since, until, days },
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[meta]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function today() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function mockMeta(): PeriodData<MetaStats> {
  const current: MetaStats = {
    spend: 1480000, impressions: 280000, reach: 95000, frequency: 2.9,
    clicks: 4200, ctr: 1.5, cpc: 352, cpm: 5285,
    purchases: 38, revenue: 3420000, cpa: 38947, roas: 23.1,
    campaigns: [
      { id: '1', name: 'Ib - Venta Fria TALISMAN', status: 'active', spend: 620000, impressions: 118000, clicks: 1760, purchases: 16, revenue: 1440000, roas: 23.2 },
      { id: '2', name: 'Ib - Venta Fria COLLAR', status: 'active', spend: 480000, impressions: 96000, clicks: 1440, purchases: 13, revenue: 1170000, roas: 24.4 },
      { id: '3', name: 'Retargeting - Carrito Abandonado', status: 'active', spend: 210000, impressions: 42000, clicks: 630, purchases: 7, revenue: 630000, roas: 30.0 },
      { id: '4', name: 'Awareness - Colección Nueva', status: 'active', spend: 170000, impressions: 24000, clicks: 370, purchases: 2, revenue: 180000, roas: 10.6 },
    ],
  }
  const previous: MetaStats = {
    spend: 1320000, impressions: 245000, reach: 84000, frequency: 2.7,
    clicks: 3675, ctr: 1.5, cpc: 359, cpm: 5388,
    purchases: 31, revenue: 2790000, cpa: 42580, roas: 21.1,
    campaigns: [],
  }
  return { current, previous, period: { since: nDaysAgo(30), until: today(), days: 30 } }
}
