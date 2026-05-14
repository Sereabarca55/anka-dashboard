export interface MetaStats {
  spend: number
  impressions: number
  reach: number
  frequency: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  purchases: number
  revenue: number
  cpa: number
  roas: number
  campaigns: MetaCampaign[]
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  purchases: number
  revenue: number
  roas: number
}

export interface GoogleStats {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  avg_cpc: number
  conversions: number
  cpa: number
  campaigns: GoogleCampaign[]
}

export interface GoogleCampaign {
  id: string
  name: string
  status: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  cpa: number
}

export interface ShopifyStats {
  orders: number
  revenue: number
  aov: number
  refunds: number
  sessions: number | null
  conversionRate: number | null
  topProducts: { title: string; quantity: number; revenue: number }[]
}

export interface GA4Stats {
  sessions: number
  users: number
  newUsers: number
  bounceRate: number
  avgSessionDuration: number
  pageviewsPerSession: number
  topPages: { path: string; views: number }[]
  channelBreakdown: { channel: string; sessions: number }[]
}

export interface PeriodData<T> {
  current: T
  previous: T
  period: { since: string; until: string; days: number }
}
