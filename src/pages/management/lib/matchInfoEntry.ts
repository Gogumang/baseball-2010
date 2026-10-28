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

export type MatchInfoEntryPhase = { readonly kind: '숨김' } | { readonly kind: '배너'; readonly offset: number } | { readonly kind: '본문' }

/** 들어온 뒤 그림 수 → 무엇을 그리나. 넷째 인자가 0(143 에서 돌아옴)이면 처음부터 본문이다 */
export function matchInfoEntryPhaseOf(draws: number, isAnimated: boolean): MatchInfoEntryPhase {
  if (!isAnimated) return { kind: '본문' }
  if (draws < MATCH_INFO_HIDDEN_DRAWS) return { kind: '숨김' }
  const offset = MATCH_INFO_BANNER_OFFSETS[draws - MATCH_INFO_HIDDEN_DRAWS]
  return offset === undefined ? { kind: '본문' } : { kind: '배너', offset }
}

/* ── 값 줄 펼침 0x5dcc0 (k 4 — 일반 22 · 시즌 0xdd · 나리 142 공용, 직접 떴다) ─────────────────────────── */

/**
 * 본문의 값 칸 0x5dcc0 은 칸을 위에서 한 줄씩 **아코디언처럼** 펼치고, 다 펼친 그림에서만 1 을 돌려준다. 0x63b14 가 그 값을
 * [skin+0xe4] 에 담고(0x65078) 노랑 반원도 그때만 그린다(0x65082). 틱 0 은 [skin+0xe4] = 0 으로 시작한다(0x63bc4).
 * ```
 * [skin+0xf4](일반 22 '*' 재굴림 중)면 [skin+0xec] = 0 · 아무것도 안 그리고 1 (0x5dcd2~0x5dce4)
 * [skin+0xec] == 0 이면(배너 0x54790 끝이 0 으로 둔다, 0x54a24) 끝 깃발 d76 = 0 · 속도 = 1 · n = 1 · 끝줄 d78 = 2N − 2 · 미끄럼 d7c = 0
 * [skin+0xec]++
 * 칸 i (0 … 2N − 1, 짝 유저 · 홀 CPU) 의 y = 바탕(줄과 상관없는 한 자리) + (i ≥ d78 ? d7c − 17·(N − 1 − ⌊i/2⌋) : 0)  ; 0x5de84~0x5deaa
 * 그린 뒤 d76 == 0 이면 속도 ×= 4 · d7c += 속도 · d7c ≥ 17n 이면 d7c = 17n · d78 −= 2 · n++ · 속도 = 1 ·
 *                     17·(옛 n) ≥ 17(N − 1) 이면 d7c = 17(N − 1) · d76 = 1                                         ; 0x5e7a2~0x5e7e4
 * 돌려주는 값 = d76
 * ```
 * 칸은 처음에 모두 첫 줄 자리에 겹쳐 있다가(뒤 칸이 위에 그려진다) 아랫줄부터 한 줄씩 떨어져 나와 자리를 잡는다.
 * k 4 는 넷째 인자 ≠ 0 이라 N = 5 → 여덟 번 그려야 끝난다. 끝 깃발 · 미끄럼은 전역이라(0x1552d76 · 0x1552d7c) 넷째 인자 0 으로
 * 들어오면(배너가 안 돌아 [skin+0xec] 그대로) 앞 펼침이 끝난 채로 이어진다.
 */
export const MATCH_INFO_VALUE_ROWS = 5
const VALUE_ROW_STEP = 17

export interface MatchInfoValueUnfold {
  /** d78 — 이 칸부터 미끄럼을 탄다 */
  readonly revealFrom: number
  /** d7c */
  readonly slide: number
  /** d76 — 다 펼쳤다 */
  readonly isDone: boolean
}

/** 펼침을 `steps` 번 굴린 뒤 (끝나면 더 안 굴린다) */
export function matchInfoValueUnfoldAfter(steps: number, rows = MATCH_INFO_VALUE_ROWS): MatchInfoValueUnfold {
  const last = VALUE_ROW_STEP * (rows - 1)
  let revealFrom = 2 * rows - 2
  let slide = 0
  let speed = 1
  let shown = 1
  let isDone = false
  for (let step = 0; step < steps && !isDone; step++) {
    speed *= 4
    slide += speed
    const target = VALUE_ROW_STEP * shown
    if (slide < target) continue
    slide = target
    revealFrom -= 2
    shown += 1
    speed = 1
    if (target >= last) {
      slide = last
      isDone = true
    }
  }
  return { revealFrom, slide, isDone }
}

export const MATCH_INFO_VALUE_SETTLED = matchInfoValueUnfoldAfter(Number.POSITIVE_INFINITY)

/** 칸 i 의 y 를 다 펼친 자리(`matchInfoRowY` 줄 ⌊i/2⌋)에서 얼마나 옮기나 */
export function matchInfoValueCellDy(unfold: MatchInfoValueUnfold, cell: number, rows = MATCH_INFO_VALUE_ROWS): number {
  const row = cell >> 1
  const slid = cell >= unfold.revealFrom ? unfold.slide - VALUE_ROW_STEP * (rows - 1 - row) : 0
  return slid - VALUE_ROW_STEP * row
}

/** 본문 첫 그림 — 머리띠 다섯 그림 + 배너 네 그림 뒤 */
export const MATCH_INFO_BODY_FIRST_DRAW = MATCH_INFO_HIDDEN_DRAWS + MATCH_INFO_BANNER_OFFSETS.length

export interface MatchInfoValueRows {
  /** 이 그림이 칸을 그리는 자리 (그린 **뒤**에 굴리므로 앞 그림까지 굴린 값) */
  readonly unfold: MatchInfoValueUnfold
  /** 이 그림의 0x5dcc0 이 돌려준 값 = [skin+0xe4] — 노랑 반원 · 다음 갱신의 키 */
  readonly isReady: boolean
}

/**
 * 펼침 n 번째 그림(1 부터)의 값 칸. n < 1 이면 아직 본문이 아니다.
 */
export function matchInfoValueRowsAtCall(call: number): MatchInfoValueRows {
  return { unfold: matchInfoValueUnfoldAfter(call - 1), isReady: matchInfoValueUnfoldAfter(call).isDone }
}

/** 들어온 뒤 그림 수 → 그 그림의 값 칸. 넷째 인자 0 이면 앞 펼침이 끝난 채다 */
export function matchInfoValueRowsAt(draws: number, isAnimated: boolean): MatchInfoValueRows {
  if (!isAnimated) return { unfold: MATCH_INFO_VALUE_SETTLED, isReady: true }
  return matchInfoValueRowsAtCall(draws - MATCH_INFO_BODY_FIRST_DRAW + 1)
}

/**
 * 키를 받나 — 키 함수(일반 0x311a8 · 시즌 0x83cc · 나리 0x13c30)는 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다
 * (0x311b2 · 0x83de · 0x13c3a). 갱신이 그리기보다 먼저라 그림 `draws` 를 보고 누른 키는 그 그림이 남긴 [skin+0xe4] 를 본다.
 * 머리띠 · 배너 동안은 0x63b14 가 본문에 안 닿아 0 이고(틱 0 에 0 으로 둔다), 본문은 펼침이 끝난 그림부터 1 이다 → 들어올 때 연출이면
 * 그림 16(머리띠 5 + 배너 4 + 펼침 8 − 1)부터 받는다.
 */
export function isMatchInfoKeyReadyAt(draws: number, isAnimated: boolean): boolean {
  if (matchInfoEntryPhaseOf(draws, isAnimated).kind !== '본문') return false
  return matchInfoValueRowsAt(draws, isAnimated).isReady
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
  const left = shifted(
    [
      { x: -50, y: r },
      { x: half + 20, y: r },
      { x: half - 20, y: r + 40 },
      { x: -50, y: r + 40 },
    ],
    -offset,
  )
  const right = shifted(
    [
      { x: half + 20, y: r - 19 },
      { x: SCREEN_WIDTH + 50, y: r - 19 },
      { x: SCREEN_WIDTH + 50, y: r + 21 },
      { x: half - 20, y: r + 21 },
    ],
    offset,
  )
  return [left, right].map((points) => ({ points, lines: topLinesOf(points) }))
}
