import type { PitcherScene } from '@/app/model/pitcherLeagueSession/types/scene'

/**
 * 105 도착 고리가 지난번에 본 것 — 고리가 돌 때마다 고친다(그림에 안 쓰는 칸, `managementArrivalAtom`).
 *   wasIdle          지난번에 관리 화면에 가만히 서 있었나
 *   seenReentryCount 마지막으로 본 다시 들어옴 수 (`reenterManagement`)
 *   isFromShop       상점(111 · 121)에서 돌아왔다 — 하위 메뉴 110 · 106 으로 서므로 105 진입이 아니다
 */
export interface ManagementArrival {
  readonly wasIdle: boolean
  readonly seenReentryCount: number
  readonly isFromShop: boolean
}

export const NOT_ARRIVED: ManagementArrival = { wasIdle: false, seenReentryCount: 0, isFromShop: false }

/** 이번 고리가 본 것 — 화면 · 가만히 섰나 · 다시 들어옴 수 */
export interface ManagementArrivalInput {
  readonly scene: PitcherScene
  readonly isIdle: boolean
  readonly reentryCount: number
}

/** 상점이면 서고, 관리 · 상점 밖으로 가면 내린다(고리는 장면이 바뀔 때마다 돈다) */
function isFromShopOf(previous: boolean, scene: PitcherScene): boolean {
  if (scene === '상점') return true
  return scene === '관리' ? previous : false
}

/**
 * 고리 한 번 — 다음 칸과 이번이 105 도착인가. 화면이 '관리' 로 바뀌어 가만히 선 첫 고리(상점에서 온 길 빼고)이거나
 * 화면이 '관리' 인 채 다시 들어온 수가 늘었으면 도착이다.
 */
export function advanceManagementArrival(
  previous: ManagementArrival,
  { scene, isIdle, reentryCount }: ManagementArrivalInput,
): { readonly next: ManagementArrival; readonly isArrival: boolean } {
  const isFromShop = isFromShopOf(previous.isFromShop, scene)
  if (!isIdle) return { next: { ...previous, wasIdle: false, isFromShop }, isArrival: false }
  const isReentry = previous.seenReentryCount !== reentryCount
  const isArrival = (!previous.wasIdle && !isFromShop) || isReentry
  return { next: { wasIdle: true, seenReentryCount: reentryCount, isFromShop: false }, isArrival }
}
