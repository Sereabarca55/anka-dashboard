'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { formatCLP, formatCLPCompact, fmt, fmtPct, fmtDur, pct } from '@/lib/format'
import type { PeriodData, MetaStats, GoogleStats, ShopifyStats, GA4Stats } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Date helpers ──────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10) }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function formatDateLabel(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PRESETS = [
  { label: 'Últimos 7 días', since: () => nDaysAgo(7), until: today },
  { label: 'Últimos 30 días', since: () => nDaysAgo(30), until: today },
  { label: 'Este mes', since: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }, until: today },
  { label: 'Últimos 90 días', since: () => nDaysAgo(90), until: today },
]

// ── Delta helpers ─────────────────────────────────────────────

function DeltaBadge({ curr, prev, lowerBetter = false }: { curr: number; prev: number; lowerBetter?: boolean }) {
  const p = pct(curr, prev)
  if (p === null) return null
  const stable = Math.abs(p) <= 5
  const improved = lowerBetter ? p < 0 : p > 0
  const cls = stable ? 'text-amber-600 bg-amber-50' : improved ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'
  const sign = p >= 0 ? '+' : ''
  return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{sign}{p}% vs ant.</span>
}

function dotColor(curr: number, prev: number, lowerBetter = false) {
  const p = pct(curr, prev)
  if (!p) return 'bg-gray-300'
  const stable = Math.abs(p) <= 5
  const improved = lowerBetter ? p < 0 : p > 0
  return stable ? 'bg-amber-400' : improved ? 'bg-emerald-500' : 'bg-red-400'
}

// ── KPI Card ──────────────────────────────────────────────────

function KpiCard({ label, value, sub, curr, prev, lowerBetter = false, accent }: {
  label: string; value: string; sub?: string
  curr: number; prev: number; lowerBetter?: boolean
  accent?: string
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm bg-white ${accent ?? 'border-stone-100'}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-stone-400 leading-tight">{label}</p>
        <span className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${dotColor(curr, prev, lowerBetter)}`} />
      </div>
      <p className="text-2xl font-semibold text-stone-900 leading-tight tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap min-h-[20px]">
        {sub && <span className="text-xs text-stone-400">{sub}</span>}
        {prev > 0 && <DeltaBadge curr={curr} prev={prev} lowerBetter={lowerBetter} />}
      </div>
    </div>
  )
}

// ── Stat Pill ─────────────────────────────────────────────────

function StatPill({ label, value, color = 'stone' }: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    stone: 'bg-stone-50 text-stone-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <div className={`rounded-xl px-4 py-3 ${colors[color] ?? colors.stone}`}>
      <p className="text-xs font-medium opacity-60 mb-0.5">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────

function LoadingGrid({ n = 4 }: { n?: number }) {
  return (
    <div className={`grid gap-3 grid-cols-2 sm:grid-cols-${n}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-stone-100 animate-pulse" />
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3 mt-8 first:mt-0">{children}</h3>
}

// ── Campaign Table ────────────────────────────────────────────

function CampaignRow({ name, spend, roas, conversions, impressions, ctr, cpc, status }: {
  name: string; spend: number; roas?: number; conversions?: number
  impressions: number; ctr: number; cpc: number; status?: string
}) {
  const [open, setOpen] = useState(false)
  const isActive = status?.toUpperCase() === 'ACTIVE' || status?.toUpperCase() === 'ENABLED'
  return (
    <div className="border border-stone-100 rounded-2xl mb-2 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-stone-50/80 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-stone-300'}`} />
          <span className="text-sm font-medium text-stone-800 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-3 ml-3 shrink-0">
          <span className="text-sm font-semibold text-stone-900">{formatCLPCompact(spend)}</span>
          {roas !== undefined && roas > 0 && (
            <span className={`text-sm font-bold ${roas >= 10 ? 'text-emerald-600' : roas >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
              {roas.toFixed(1)}x
            </span>
          )}
          <span className="text-stone-300 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-stone-50 pt-3 bg-stone-50/50">
          {conversions !== undefined && (
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Conversiones</p>
              <p className="text-sm font-semibold text-stone-800">{fmt(conversions)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-stone-400 mb-0.5">Impresiones</p>
            <p className="text-sm font-semibold text-stone-800">{fmt(impressions)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 mb-0.5">CTR</p>
            <p className="text-sm font-semibold text-stone-800">{fmtPct(ctr)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 mb-0.5">CPC</p>
            <p className="text-sm font-semibold text-stone-800">{formatCLPCompact(cpc)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Platform Card ─────────────────────────────────────────────

function PlatformCard({ name, dot, spend, prevSpend, roas, prevRoas, conversions, cpa }: {
  name: string; dot: string
  spend: number; prevSpend: number; roas: number; prevRoas: number
  conversions: number; cpa: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-3 h-3 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-stone-700">{name}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-stone-400 mb-0.5">Inversión</p>
          <p className="text-xl font-semibold text-stone-900">{formatCLPCompact(spend)}</p>
          <DeltaBadge curr={spend} prev={prevSpend} lowerBetter />
        </div>
        {roas > 0 && (
          <div>
            <p className="text-xs text-stone-400 mb-0.5">ROAS</p>
            <p className={`text-xl font-semibold ${roas >= 10 ? 'text-emerald-600' : roas >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
              {roas.toFixed(1)}x
            </p>
            <DeltaBadge curr={roas} prev={prevRoas} />
          </div>
        )}
        <div>
          <p className="text-xs text-stone-400 mb-0.5">Conversiones</p>
          <p className="text-xl font-semibold text-stone-900">{fmt(conversions)}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400 mb-0.5">CPA</p>
          <p className="text-xl font-semibold text-stone-900">{cpa > 0 ? formatCLPCompact(cpa) : '—'}</p>
        </div>
      </div>
    </div>
  )
}

// ── Channel Bar ───────────────────────────────────────────────

const CH_COLORS: Record<string, string> = {
  'Paid Social': 'bg-blue-500',
  'Organic Search': 'bg-emerald-500',
  'Paid Search': 'bg-amber-400',
  'Direct': 'bg-stone-400',
  'Organic Social': 'bg-violet-400',
  'Email': 'bg-pink-400',
  'Referral': 'bg-orange-400',
}

function ChannelBreakdown({ channels }: { channels: { channel: string; sessions: number }[] }) {
  const total = channels.reduce((s, c) => s + c.sessions, 0)
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5">
      <div className="flex rounded-full overflow-hidden h-3 mb-4 gap-px">
        {channels.map((c, i) => (
          <div key={i} className={`${CH_COLORS[c.channel] ?? 'bg-stone-300'}`}
            style={{ width: `${(c.sessions / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
        {channels.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CH_COLORS[c.channel] ?? 'bg-stone-300'}`} />
            <div>
              <p className="text-xs text-stone-500 leading-tight">{c.channel}</p>
              <p className="text-sm font-semibold text-stone-800">
                {fmt(c.sessions)} <span className="text-xs font-normal text-stone-400">({Math.round((c.sessions / total) * 100)}%)</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────

type Tab = 'resumen' | 'meta' | 'google' | 'tienda'

function TabResumen({ since, until }: { since: string; until: string }) {
  const { data: meta } = useSWR<PeriodData<MetaStats>>(`/api/meta?since=${since}&until=${until}`, fetcher)
  const { data: google } = useSWR<PeriodData<GoogleStats>>(`/api/google?since=${since}&until=${until}`, fetcher)
  const { data: shopify } = useSWR<ShopifyStats>(`/api/shopify?since=${since}&until=${until}`, fetcher)

  if (!meta || !google || !shopify) return <LoadingGrid n={4} />

  const mc = meta.current, mp = meta.previous
  const gc = google.current, gp = google.previous

  const totalSpend = mc.spend + gc.spend
  const prevSpend = mp.spend + gp.spend
  const totalConv = mc.purchases + gc.conversions
  const prevConv = mp.purchases + gp.conversions
  const combinedRoas = totalSpend > 0 ? mc.revenue / totalSpend : 0
  const prevRoas = prevSpend > 0 ? mp.revenue / prevSpend : 0
  const combinedCpa = totalConv > 0 ? totalSpend / totalConv : 0
  const prevCpa = prevConv > 0 ? prevSpend / prevConv : 0

  return (
    <div>
      <SectionTitle>Resultados Globales</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
        <KpiCard label="ROAS Total" value={`${combinedRoas.toFixed(1)}x`}
          sub="Meta + Google" curr={combinedRoas} prev={prevRoas}
          accent={combinedRoas >= 10 ? 'border-emerald-200' : combinedRoas >= 5 ? 'border-amber-200' : 'border-red-200'} />
        <KpiCard label="Ingresos" value={formatCLPCompact(mc.revenue)}
          sub={`${fmt(mc.purchases + gc.conversions)} ventas`} curr={mc.revenue} prev={mp.revenue} />
        <KpiCard label="Inversión Total" value={formatCLPCompact(totalSpend)}
          sub="Meta + Google" curr={totalSpend} prev={prevSpend} lowerBetter />
        <KpiCard label="Costo por Venta" value={combinedCpa > 0 ? formatCLPCompact(combinedCpa) : '—'}
          sub="CPA combinado" curr={combinedCpa} prev={prevCpa} lowerBetter />
        <KpiCard label="Ticket Promedio" value={formatCLPCompact(shopify.aov)}
          sub={`${shopify.orders} órdenes`} curr={shopify.aov} prev={0} accent="border-amber-200" />
        <KpiCard label="Ingresos Shopify" value={formatCLPCompact(shopify.revenue)}
          sub={shopify.refunds > 0 ? `${shopify.refunds} devol.` : undefined} curr={shopify.revenue} prev={0} accent="border-amber-200" />
      </div>

      <SectionTitle>Por Plataforma</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <PlatformCard name="Meta Ads" dot="bg-blue-500"
          spend={mc.spend} prevSpend={mp.spend}
          roas={mc.roas} prevRoas={mp.roas}
          conversions={mc.purchases} cpa={mc.cpa} />
        <PlatformCard name="Google Ads" dot="bg-amber-400"
          spend={gc.spend} prevSpend={gp.spend}
          roas={0} prevRoas={0}
          conversions={gc.conversions} cpa={gc.cpa} />
      </div>

      {shopify.topProducts.length > 0 && (
        <>
          <SectionTitle>Top Productos</SectionTitle>
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-400 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                  <th className="text-right px-4 py-2.5 font-medium">Unid.</th>
                  <th className="text-right px-4 py-2.5 font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {shopify.topProducts.map((p, i) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-stone-50/50">
                    <td className="px-4 py-3 text-stone-800 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-right text-stone-500">{fmt(p.quantity)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">{formatCLPCompact(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function TabMeta({ since, until }: { since: string; until: string }) {
  const { data, error } = useSWR<PeriodData<MetaStats>>(`/api/meta?since=${since}&until=${until}`, fetcher)
  if (error) return <p className="text-red-500 text-sm p-4">Error cargando Meta Ads: {String(error)}</p>
  if (!data) return <LoadingGrid n={4} />

  const c = data.current, p = data.previous

  return (
    <div>
      <SectionTitle>Negocio</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <KpiCard label="ROAS" value={`${c.roas.toFixed(1)}x`}
          curr={c.roas} prev={p.roas}
          accent={c.roas >= 10 ? 'border-emerald-200' : c.roas >= 5 ? 'border-amber-200' : 'border-red-200'} />
        <KpiCard label="Ingresos" value={formatCLPCompact(c.revenue)}
          sub={`${fmt(c.purchases)} compras`} curr={c.revenue} prev={p.revenue} />
        <KpiCard label="Inversión" value={formatCLPCompact(c.spend)} curr={c.spend} prev={p.spend} lowerBetter />
        <KpiCard label="Costo / Compra" value={c.cpa > 0 ? formatCLPCompact(c.cpa) : '—'}
          curr={c.cpa} prev={p.cpa} lowerBetter />
      </div>

      <SectionTitle>Alcance y Entrega</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <StatPill label="Alcance" value={fmt(c.reach)} color="blue" />
        <StatPill label="Impresiones" value={fmt(c.impressions)} color="blue" />
        <StatPill label="Frecuencia" value={`${c.frequency.toFixed(1)}x`}
          color={c.frequency >= 5 ? 'stone' : c.frequency >= 3 ? 'amber' : 'emerald'} />
        <StatPill label="CPM" value={formatCLPCompact(c.cpm)} color="blue" />
        <StatPill label="Clics" value={fmt(c.clicks)} color="blue" />
        <StatPill label="CTR" value={fmtPct(c.ctr)}
          color={c.ctr >= 1 ? 'emerald' : c.ctr >= 0.5 ? 'amber' : 'stone'} />
        <StatPill label="CPC" value={formatCLPCompact(c.cpc)} color="blue" />
      </div>

      {c.campaigns.length > 0 && (
        <>
          <SectionTitle>Campañas ({c.campaigns.length})</SectionTitle>
          {c.campaigns.map(camp => (
            <CampaignRow
              key={camp.id} name={camp.name} status="ACTIVE"
              spend={camp.spend}
              roas={camp.roas}
              conversions={camp.purchases}
              impressions={camp.impressions}
              ctr={camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0}
              cpc={camp.clicks > 0 ? camp.spend / camp.clicks : 0}
            />
          ))}
        </>
      )}
    </div>
  )
}

function TabGoogle({ since, until }: { since: string; until: string }) {
  const { data, error } = useSWR<PeriodData<GoogleStats>>(`/api/google?since=${since}&until=${until}`, fetcher)
  if (error) return <p className="text-red-500 text-sm p-4">Error cargando Google Ads: {String(error)}</p>
  if (!data) return <LoadingGrid n={4} />

  const c = data.current, p = data.previous

  return (
    <div>
      <SectionTitle>Negocio</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <KpiCard label="Conversiones" value={fmt(c.conversions)} curr={c.conversions} prev={p.conversions} />
        <KpiCard label="Inversión" value={formatCLPCompact(c.spend)} curr={c.spend} prev={p.spend} lowerBetter />
        <KpiCard label="CPA" value={c.cpa > 0 ? formatCLPCompact(c.cpa) : '—'} curr={c.cpa} prev={p.cpa} lowerBetter />
        <KpiCard label="CPC Prom." value={formatCLPCompact(c.avg_cpc)} curr={c.avg_cpc} prev={p.avg_cpc} lowerBetter />
      </div>

      <SectionTitle>Alcance y Entrega</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
        <StatPill label="Impresiones" value={fmt(c.impressions)} color="amber" />
        <StatPill label="Clics" value={fmt(c.clicks)} color="amber" />
        <StatPill label="CTR" value={fmtPct(c.ctr)}
          color={c.ctr >= 3 ? 'emerald' : c.ctr >= 1.5 ? 'amber' : 'stone'} />
      </div>

      {c.campaigns.length > 0 && (
        <>
          <SectionTitle>Campañas ({c.campaigns.length})</SectionTitle>
          {c.campaigns.map(camp => (
            <CampaignRow
              key={camp.id} name={camp.name} status={camp.status}
              spend={camp.spend}
              conversions={camp.conversions}
              impressions={camp.impressions}
              ctr={camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0}
              cpc={camp.clicks > 0 ? camp.spend / camp.clicks : 0}
            />
          ))}
        </>
      )}
    </div>
  )
}

function TabTienda({ since, until }: { since: string; until: string }) {
  const { data: shopify, error: sErr } = useSWR<ShopifyStats>(`/api/shopify?since=${since}&until=${until}`, fetcher)
  const { data: ga4, error: gErr } = useSWR<GA4Stats>(`/api/ga4?since=${since}&until=${until}`, fetcher)

  if (sErr || gErr) return <p className="text-red-500 text-sm p-4">Error cargando datos de tienda</p>
  if (!shopify || !ga4) return <LoadingGrid n={4} />

  return (
    <div>
      <SectionTitle>Shopify — Ventas</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <StatPill label="Ingresos" value={formatCLPCompact(shopify.revenue)} color="amber" />
        <StatPill label="Pedidos" value={fmt(shopify.orders)} color="amber" />
        <StatPill label="Ticket Promedio" value={formatCLPCompact(shopify.aov)} color="amber" />
        {shopify.conversionRate !== null
          ? <StatPill label="Tasa Conversión"
              value={`${shopify.conversionRate.toFixed(2)}%`}
              color={shopify.conversionRate >= 1.5 ? 'emerald' : shopify.conversionRate >= 0.8 ? 'amber' : 'stone'} />
          : <StatPill label="Devoluciones" value={fmt(shopify.refunds)} color="stone" />
        }
      </div>

      {shopify.topProducts.length > 0 && (
        <>
          <SectionTitle>Top Productos</SectionTitle>
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden mb-2">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-400 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-6">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                  <th className="text-right px-4 py-2.5 font-medium">Unid.</th>
                  <th className="text-right px-4 py-2.5 font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {shopify.topProducts.map((p, i) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-stone-50/50">
                    <td className="px-4 py-3 text-stone-300 text-xs font-mono">{i + 1}</td>
                    <td className="px-4 py-3 text-stone-800 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-right text-stone-500">{fmt(p.quantity)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">{formatCLPCompact(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionTitle>Google Analytics 4</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <StatPill label="Sesiones" value={fmt(ga4.sessions)} color="sky" />
        <StatPill label="Usuarios" value={fmt(ga4.users)} color="sky" />
        <StatPill label="Usuarios Nuevos" value={fmt(ga4.newUsers)} color="sky" />
        <StatPill label="Tasa de Rebote" value={`${ga4.bounceRate}%`}
          color={ga4.bounceRate <= 50 ? 'emerald' : ga4.bounceRate <= 65 ? 'amber' : 'stone'} />
        <StatPill label="Duración Sesión" value={fmtDur(ga4.avgSessionDuration)} color="sky" />
        <StatPill label="Páginas / Sesión" value={ga4.pageviewsPerSession.toFixed(1)} color="sky" />
      </div>

      {ga4.channelBreakdown.length > 0 && (
        <>
          <SectionTitle>Sesiones por Canal</SectionTitle>
          <ChannelBreakdown channels={ga4.channelBreakdown} />
        </>
      )}

      {ga4.topPages.length > 0 && (
        <>
          <SectionTitle>Páginas Más Visitadas</SectionTitle>
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs text-stone-400 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Página</th>
                  <th className="text-right px-4 py-2.5 font-medium">Vistas</th>
                </tr>
              </thead>
              <tbody>
                {ga4.topPages.map((p, i) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-stone-50/50">
                    <td className="px-4 py-3 text-stone-600 font-mono text-xs">{p.path}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-900">{fmt(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'meta', label: 'Meta Ads' },
  { id: 'google', label: 'Google Ads' },
  { id: 'tienda', label: 'Tienda' },
]

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [since, setSince] = useState(nDaysAgo(30))
  const [until, setUntil] = useState(today())
  const [activePreset, setActivePreset] = useState(1)

  function applyPreset(i: number) {
    setSince(PRESETS[i].since())
    setUntil(PRESETS[i].until())
    setActivePreset(i)
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center">
              <span className="text-white text-xs font-bold tracking-tight">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900 leading-tight">ANKA Joyería</p>
              <p className="text-xs text-stone-400 leading-tight">Dashboard de resultados</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {formatDateLabel(since)} — {formatDateLabel(until)}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Date presets */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {PRESETS.map((preset, i) => (
            <button key={i} onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${activePreset === i ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'}`}>
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <input type="date" value={since} onChange={e => { setSince(e.target.value); setActivePreset(-1) }}
              className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-600 bg-white" />
            <span className="text-stone-300 text-xs">—</span>
            <input type="date" value={until} onChange={e => { setUntil(e.target.value); setActivePreset(-1) }}
              className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-600 bg-white" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-stone-100 rounded-2xl p-1 mb-6 gap-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors
                ${tab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'resumen' && <TabResumen since={since} until={until} />}
        {tab === 'meta'    && <TabMeta    since={since} until={until} />}
        {tab === 'google'  && <TabGoogle  since={since} until={until} />}
        {tab === 'tienda'  && <TabTienda  since={since} until={until} />}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-stone-100 text-center">
          <p className="text-xs text-stone-300">Dashboard preparado por Copywriters · Los datos se actualizan en tiempo real</p>
        </footer>
      </div>
    </div>
  )
}
