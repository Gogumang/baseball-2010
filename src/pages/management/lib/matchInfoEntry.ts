/**
 * **경기 준비 줄 나타남** — 공용 목록 그림 0x63b14(skin, 목록, k, **넷째 인자**, 틱, …) 의 들어올 때 연출 (직접 떴다).
 *
 * 나리 142 그림 0x15d98 은 넷째 인자로 `[장면+0x28] ≠ 0x8f` (이전 상태가 143 엔트리 보기가 아님)를 넘긴다(0x15da0~0x15da6).
 * ```
 * 63ba0  틱 == 0 이면  +0x86 = 1 · +0x84 = 1(머리띠 미끄러짐) · +0xe8 = 1 · +0xe9 = 0 · +0xf0 = 0
 *                      넷째 인자 == 0 이면  +0x84 = 0 · +0xe9 = 1 · +0xe8 = 0           ; 연출 없이 곧바로 본문
 * 63be2  +0x84 ≠ 0 이면 +0xf0 = 0 · 아무것도 안 그리고 끝                                ; 머리띠가 다 내려올 때까지
 * 63c28  +0xe9 == 0 이면 0x54790(skin, 판, H/2 − 15, t = +0xf0++, 1) 만 그리고 끝            ; 배너
 *        그 밖이면 본문(k 4 경기정보)
 * ```
 * 그리기 0x15d98 은 0x63b14 **다음에** 머리띠 0x7f4ed 를 부르고, 머리띠 0x54d95 가 +0x86 을 두 배로 한 뒤(0x54e02)
 * 30 이상이면 30 · +0x84 = 0 으로 둔다(0x54e16). 곧 그림 0 ~ 4 (머리띠 2 · 4 · 8 · 16 · 30) 동안 본문이 없다.
 *
 * 배너 0x54790(…, y0, t, 1) — 파랑 평행사변형 둘이 양옆에서 미끄러져 들어와 만나면 사라진다(0x54790~0x54a30):
 * ```
 * t == 0 이면 D = [0x1552d74] = W/2 · 속도 [0x1400138] = 1
 * r = (y0 − 20) & 0xff
 * 왼 배너 A (−50, r) (W/2 + 20, r) (W/2 − 20, r + 40) (−50, r + 40) 를 x − D 로   ; 0x75ba5 · 0x75e31 (채우기 #335FCD · 테두리 #244CAE)
 *   윗변 아래 선 셋: (x0, y0 + k) ~ (x1 − k, y1 + k), k = 1·2 #4179D1, k = 3 #3459AA
 * 오른 배너 B (W/2 + 20, r − 19) (W + 50, r − 19) (W + 50, r + 21) (W/2 − 20, r + 21) 를 x + D 로 · 같은 선 셋
 * 그린 뒤 속도 ×= 4 · D −= 속도 · D ≤ 0 이면 D = 0 · +0xe9 = 1 (끝)
 * ```
 * → D 는 120 · 116 · 100 · 36 (네 그림) 이고 다섯째 그림부터 본문이다. 판 객체(0x75b19, 0x9c 바이트)의 채우기 [+0x80] = #335FCD ·
 * 테두리 [+0x7c] = #244CAE 는 0x63c08~0x63c26 이 매 그림 새로 세운다.
 */
import type { CutInPoint } from '@/features/play-game/model/aceCutIn'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 0x63b36 — y0 = H/2 − 15 */
export const MATCH_INFO_BANNER_Y = SCREEN_HEIGHT / 2 - 15

/** 머리띠가 다 내려오기까지 본문이 없는 그림 수 (+0x86 = 2 · 4 · 8 · 16 · 30) */
export const MATCH_INFO_HIDDEN_DRAWS = 5

/** 배너 D — 120 에서 속도 1 · 4 · 16 · 64 · 256 을 빼다가 0 이하에서 끝 */
export const MATCH_INFO_BANNER_OFFSETS: readonly number[] = (() => {
  const offsets: number[] = []
  let offset = SCREEN_WIDTH / 2
  let speed = 1
  while (offset > 0) {
    offsets.push(offset)
    speed *= 4
    offset -= speed
  }
  return offsets
})()

export type MatchInfoEntryPhase =
  | { readonly kind: '숨김' }
  | { readonly kind: '배너'; readonly offset: number }
  | { readonly kind: '본문' }

/** 들어온 뒤 그림 수 → 무엇을 그리나. 넷째 인자가 0(143 에서 돌아옴)이면 처음부터 본문이다 */
export function matchInfoEntryPhaseOf(draws: number, isAnimated: boolean): MatchInfoEntryPhase {
  if (!isAnimated) return { kind: '본문' }
  if (draws < MATCH_INFO_HIDDEN_DRAWS) return { kind: '숨김' }
  const offset = MATCH_INFO_BANNER_OFFSETS[draws - MATCH_INFO_HIDDEN_DRAWS]
  return offset === undefined ? { kind: '본문' } : { kind: '배너', offset }
}

export const MATCH_INFO_BANNER_COLORS = {
  fill: '#335FCD',
  border: '#244CAE',
  light: '#4179D1',
  shade: '#3459AA',
} as const

export interface MatchInfoBannerLine {
  readonly from: CutInPoint
  readonly to: CutInPoint
  readonly color: string
}

export interface MatchInfoBanner {
  readonly points: readonly CutInPoint[]
  readonly lines: readonly MatchInfoBannerLine[]
}

const shifted = (points: readonly CutInPoint[], dx: number) => points.map((point) => ({ x: point.x + dx, y: point.y }))

/** 윗변 아래 선 셋 — (x0, y0 + k) ~ (x1 − k, y1 + k) */
function topLinesOf(points: readonly CutInPoint[]): readonly MatchInfoBannerLine[] {
  const [first, second] = points
  return [1, 2, 3].map((k) => ({
    from: { x: first.x, y: first.y + k },
    to: { x: second.x - k, y: second.y + k },
    color: k === 3 ? MATCH_INFO_BANNER_COLORS.shade : MATCH_INFO_BANNER_COLORS.light,
  }))
}

/** 배너 두 장 (왼 A · 오른 B) — D 만큼 바깥으로 민 자리 */
export function matchInfoBannersOf(offset: number, baseY = MATCH_INFO_BANNER_Y): readonly MatchInfoBanner[] {
  const r = (baseY - 20) & 0xff
  const half = SCREEN_WIDTH / 2
  const left = shifted([
    { x: -50, y: r }, { x: half + 20, y: r }, { x: half - 20, y: r + 40 }, { x: -50, y: r + 40 },
  ], -offset)
  const right = shifted([
    { x: half + 20, y: r - 19 }, { x: SCREEN_WIDTH + 50, y: r - 19 }, { x: SCREEN_WIDTH + 50, y: r + 21 }, { x: half - 20, y: r + 21 },
  ], offset)
  return [left, right].map((points) => ({ points, lines: topLinesOf(points) }))
}
