export const formatCLP = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CL')

export const formatCLPCompact = (n: number): string => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'K'
  return formatCLP(n)
}

export const fmt = (n: number) => Math.round(n).toLocaleString('es-CL')

export const fmtPct = (n: number, dec = 2) =>
  n.toFixed(dec).replace('.', ',') + '%'

export const fmtDur = (secs: number) => {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function pct(curr: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((curr - prev) / prev) * 100)
}
