import { onCLS, onINP, onLCP } from 'web-vitals'
import type { Metric } from 'web-vitals'

/** 화면 왼쪽 아래 한 줄 — 게임 누름을 가로채지 않는다 */
const OVERLAY_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'fixed',
  left: '0',
  bottom: '0',
  zIndex: '10000',
  padding: '2px 6px',
  font: '11px/1.4 monospace',
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.6)',
  pointerEvents: 'none',
  whiteSpace: 'pre',
}

const RATING_MARK: Record<Metric['rating'], string> = { good: '', 'needs-improvement': '△', poor: '✕' }

function formatMetric(metric: Metric): string {
  const value = metric.name === 'CLS' ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`
  return `${metric.name} ${value}${RATING_MARK[metric.rating]}`
}

export function showVitalsOverlay({ logsToConsole }: { readonly logsToConsole: boolean }): void {
  const overlay = document.createElement('div')
  Object.assign(overlay.style, OVERLAY_STYLE)
  overlay.textContent = 'LCP … · INP … · CLS …'
  document.body.append(overlay)

  const latest = new Map<Metric['name'], string>()
  const report = (metric: Metric) => {
    latest.set(metric.name, formatMetric(metric))
    overlay.textContent = ['LCP', 'INP', 'CLS'].map((name) => latest.get(name as Metric['name']) ?? `${name} …`).join(' · ')
    if (logsToConsole) console.info('[web-vitals]', metric.name, metric.value, metric.rating)
  }
  // 바뀔 때마다 고친다 — INP 는 누를 때마다, CLS 는 흔들릴 때마다 오른다
  onLCP(report, { reportAllChanges: true })
  onINP(report, { reportAllChanges: true })
  onCLS(report, { reportAllChanges: true })
}
