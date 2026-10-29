/**
 * **성능 표시** (r365) — web-vitals(LCP · INP · CLS) 와 stats.js(FPS · 프레임 ms · 메모리)를 화면 구석에 띄운다.
 *
 * - 개발 서버: 늘 켠다(web-vitals 는 콘솔에도 찍는다).
 * - 배포판: 주소 꼬리에 `?vitals` 를 붙였을 때만 켠다. 어디로도 보내지 않는다(서버 기능 제외 결정, 10-24).
 * 둘 다 동적 import 라 첫 진입 덩이에는 들어가지 않는다 — 켤 때만 받는다.
 */
const VITALS_QUERY_KEY = 'vitals'

/** 단위 시험(vitest)은 개발 모드지만 띄우지 않는다 */
const IS_DEV_SERVER = import.meta.env.DEV && import.meta.env.MODE !== 'test'

export function isPerfOverlayWanted(isDevServer: boolean, search: string): boolean {
  return isDevServer || new URLSearchParams(search).has(VITALS_QUERY_KEY)
}

export function installPerfOverlay(search: string): void {
  if (!isPerfOverlayWanted(IS_DEV_SERVER, search)) return
  const logsToConsole = IS_DEV_SERVER
  // 받기 실패(오프라인 등)는 표시만 없을 뿐 — 게임은 그대로 돈다
  void import('@/app/devtools/vitalsOverlay').then((module) => module.showVitalsOverlay({ logsToConsole })).catch(() => undefined)
  void import('@/app/devtools/statsOverlay').then((module) => module.showStatsOverlay()).catch(() => undefined)
}
