/**
 * **열림** (0x75006 · 0x75556~0x75588): 그리는 높이 [+0x212] = **10** 에서 시작해 매 갱신 **×2**,
 * 목표 높이 < 두 배면 목표로 맞추고 플래그를 끈다 (한 줄 상자 79 면 10→20→40→79). 두 배가 목표와 같으면 한 갱신 더 펼침이다.
 * 상자는 늘 `(화면높이 − 현재높이)/2` 에 그려져 **세로 가운데에서 위아래로 펼쳐지고**,
 * 펼치는 동안에는 글·버튼을 그리지 않는다 (0x7479c).
 */
export const OPEN_START_HEIGHT = 10
export const OPEN_GROWTH = 2

/**
 * **닫힘** (0x7558a~0x755d8): [+0x215] 가 켜지면 매 갱신 폭 [+0x210] 을 **÷2**,
 * **99 이하**가 되면 닫고 콜백을 부른다 (240→120→60 두 갱신).
 *
 * 줄어드는 판은 **가로 가운데**다 — 확정(2026-10-14): 그리기 0x744c4 가 x = (W − 폭) >> 1 · y = ((H − 높이) >> 1) + [창+0x244] 로 긋는다
 * (0x744de~0x74520). 장면이 [창+0x24f] = 1 이면 줄임 없이 다음 갱신에 닫힌다(`closesWithoutShrink`).
 * ⚠️ 레이아웃이 없는 환경(측정 높이 0 — 테스트 등)에서는 두 애니메이션을 모두 건너뛰고
 *    **답을 그 자리에서 넘긴다**. props 계약(`onAnswer` 를 바로 부르는 것)을 지키기 위함이다.
 */
export const CLOSE_START_WIDTH = 240
export const CLOSE_SHRINK = 2
export const CLOSE_END_WIDTH = 99

/** 펼침 · 닫힘 애니메이션 — 없으면 null */
export type BoxAnimation =
  | { readonly kind: '열림'; readonly height: number }
  | { readonly kind: '닫힘'; readonly width: number; readonly answer: number }
  | null

/** 펼치는 동안에는 높이만 원본 값으로 눌러 그린다(세로 가운데는 CSS 가 맞춘다). 닫는 동안에는 상자 바탕을 걷고 판만 따로 줄인다 */
export function boxStyleOf(animation: BoxAnimation) {
  if (animation === null) return undefined
  return animation.kind === '열림' ? { height: animation.height, overflow: 'hidden' as const } : { background: 'none' }
}

/**
 * 닫는 동안 줄어드는 판 — 판 0x744c4 는 채움 0x6a9f0 · 가로줄 0x6a904 뿐이고 자르기 칸을 안 세워, 뒤에 그리는 글 0x74664 · 버튼 0x7448c 는
 * (W/2 − 75, …) · 버튼 자리 그대로 판 밖까지 그려진다. 그래서 상자는 240 폭 그대로 두고 판만 가로 가운데에서 줄인다
 */
export function closingPanelStyleOf(animation: BoxAnimation) {
  if (animation?.kind !== '닫힘') return null
  return { left: Math.floor((CLOSE_START_WIDTH - animation.width) / 2), width: animation.width }
}

/** 펼치는 동안은 글·버튼을 안 그린다 (0x7479c). 닫는 동안에는 원본도 그대로 그린다 */
export function contentStyleOf(animation: BoxAnimation) {
  return animation?.kind === '열림' ? { visibility: 'hidden' as const } : undefined
}
