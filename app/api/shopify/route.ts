import { NextRequest, NextResponse } from 'next/server'
import type { ShopifyStats } from '@/lib/types'

interface ShopifyOrder {
  id: number
  total_price: string
  financial_status: string
  line_items: { title: string; quantity: number; price: string }[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const since = searchParams.get('since') ?? nDaysAgo(30)
  const until = searchParams.get('until') ?? today()

  const storeUrl = process.env.ANKA_SHOPIFY_STORE_URL
  const token = process.env.ANKA_SHOPIFY_ACCESS_TOKEN

  if (!storeUrl || !token) return NextResponse.json(mockShopify(), { status: 200 })

  try {
    const base = `https://${storeUrl}/admin/api/2024-01`
    const headers = { 'X-Shopify-Access-Token': token }

    const res = await fetch(
      `${base}/orders.json?status=any&created_at_min=${since}T00:00:00-03:00&created_at_max=${until}T23:59:59-03:00&limit=250&fields=id,total_price,financial_status,line_items`,
      { headers }
    )
    if (!res.ok) throw new Error(`Shopify ${res.status}`)
    const { orders } = await res.json() as { orders: ShopifyOrder[] }

    const paid = orders.filter(o => o.financial_status !== 'refunded' && o.financial_status !== 'voided')
    const revenue = paid.reduce((s, o) => s + parseFloat(o.total_price), 0)

    const productMap = new Map<string, { quantity: number; revenue: number }>()
    for (const order of paid) {
      for (const item of order.line_items) {
        const cur = productMap.get(item.title) ?? { quantity: 0, revenue: 0 }
        productMap.set(item.title, {
          quantity: cur.quantity + item.quantity,
          revenue: cur.revenue + parseFloat(item.price) * item.quantity,
        })
      }
    }

    const stats: ShopifyStats = {
      orders: paid.length,
      revenue: Math.round(revenue),
      aov: paid.length > 0 ? Math.round(revenue / paid.length) : 0,
      refunds: orders.length - paid.length,
      sessions: null,
      conversionRate: null,
      topProducts: [...productMap.entries()]
        .map(([title, v]) => ({ title, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    }
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[shopify]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

function today() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function mockShopify(): ShopifyStats {
  return {
    orders: 47, revenue: 4230000, aov: 89979, refunds: 2,
    sessions: 3120, conversionRate: 1.51,
    topProducts: [
      { title: 'Collar Talisman Gold', quantity: 18, revenue: 1620000 },
      { title: 'Anillo Luna Plata', quantity: 12, revenue: 720000 },
      { title: 'Pulsera Minimal Dorada', quantity: 9, revenue: 630000 },
      { title: 'Arete Perla Drop', quantity: 8, revenue: 640000 },
      { title: 'Set Regalo Navidad', quantity: 5, revenue: 620000 },
    ],
  }
}
