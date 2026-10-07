import { STADIUM_BAND } from '@/pages/management/lib/managementLayout'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'

/**
 * 가운데 판 **0x7f814** — 상태판의 경기장 띠 위에 서는 인물 둘 (직접 떴다, 0x7f814~0x7f994).
 *
 * ```
 * 0x7f814(gfx, a, b)    a == 0 && b == 0 → 안 그림        ; 공통 틀 a = 상태 틀 수 [this+0x2c], b = 이전 상태 ≠ 이벤트(0xd3 · 나리 114)
 *   박스 = mode_ui 프레임 10 박스 0 (경기장 띠 0,65,240,72)
 *   발 y = 박스y + 박스h − 2 = 135 · 0xbae25(0, 0, W, 박스y + 박스h − 1) = 136 줄까지만 보인다
 *   [gfx+0x254](코치) 있으면  0xba169(코치, [gfx+0x34c] + [gfx+0x350], 발 y) · 0x93d91 그림 · 0x93cfd(…, 1) 한 걸음
 *   [gfx+0x250](감독·선수)    0xba169(…, [gfx+0x348] + [gfx+0x350], 발 y) · 그림 · 한 걸음
 *   [gfx+0x350] −= [gfx+0x348] / 8 (0 아래로 안 감)        ; 그린 **뒤에** 줄인다
 * ```
 * 자리는 0x8a2d8 이 정한다: 코치가 있으면 [gfx+0x34c] = W/2 − 0x23 = 85 · [gfx+0x348] = W/2 + 0x23 = 155,
 * 없으면 [gfx+0x348] = W/2 + 0x19 = 145 — 그리고 [gfx+0x350] = W/2 = 120 (오른쪽에서 미끄러져 들어온다).
 * 0x8a2d8 을 부르는 곳: 시즌 0xc9 진입 0x4efc(이전 상태 ∈ {1, 0xd3, 0xcb, 0xf5, 0xf1}) · 나리 105 진입 0x11910
 * (이전 상태 ∈ {1, 114, 100}). 그 밖에서 들어오면 인물은 제자리에 그대로 선다.
 *
 * 인물 = 0x63a04(ui, idx, n) 애니 (`event_char_*`, 애니 = 표 0xd0ae6[idx] + n · idx 1 만 표 대신 장타형 8/0):
 * - [gfx+0x250] **0x85f38** — 사기(시즌 팀 레코드 +2 · 나리 0xa3a25) > 90 → n 1 · ≤ 50 → n 6 · 그 밖 0,
 *   질병(+5) 이면 6 · 나리는 부상(+0x1b5 > 0)도 6. 시즌 idx 2(감독, 0xd0ae6[2] = 16) · 나리 idx 1(선수, 피부 팔레트).
 * - [gfx+0x254] **0x86020** — 시즌만. 코치 칸 SR+0x185(s8) < 0 이면 없음, 0~9 → 점프표 0xd4aa4
 *   [0x11, 0xb, 0x12, 0xd, 0x13, 0xa, 0x14, 0xc, 0x15, 0x16] (9 넘으면 0x11), n 0.
 *   idx 10~13 → event_char_1 · 17~22 → event_char_2 (0x63a18~0x63a34).
 */

/** 표 0xd0ae6 — 인물 idx 의 애니 바탕 */
const PORTRAIT_ANIMATION_BASE: readonly number[] = [-1, -1, 16, 23, 30, 37, 44, 51, 58, 65, 0, 7, 15, 23, 72, 79, 86, 40, 16, 8, 0, 24, 32]
/** 점프표 0xd4aa4 — 코치 칸 → 인물 idx */
const COACH_PORTRAIT_INDEX: readonly number[] = [0x11, 0xb, 0x12, 0xd, 0x13, 0xa, 0x14, 0xc, 0x15, 0x16]
const COACH_FALLBACK_INDEX = 0x11
/** 시즌 감독 idx 2 · 나리 선수 idx 1 */
const SEASON_MANAGER_INDEX = 2
/** 장타형 몸 — 0x63a6a: 모드 4 이고 `+0xb >> 4 > 1` 이면 8 */
const SLUGGER_ANIMATION_BASE = 8

const SCREEN_WIDTH = 240
export const CENTER_STAGE = {
  /** 발 y — 박스y + 박스h − 2 */
  footY: STADIUM_BAND.top + STADIUM_BAND.height - 2,
  /** 보이는 줄 수 — 0xbae25(0, 0, W, 박스y + 박스h − 1) */
  clipHeight: STADIUM_BAND.top + STADIUM_BAND.height - 1,
  /** 코치가 있을 때 [gfx+0x34c] 코치 · [gfx+0x348] 감독 */
  coachX: SCREEN_WIDTH / 2 - 0x23,
  pairedLeadX: SCREEN_WIDTH / 2 + 0x23,
  /** 혼자일 때 [gfx+0x348] */
  soloLeadX: SCREEN_WIDTH / 2 + 0x19,
  /** 미끄러짐 시작 [gfx+0x350] */
  slideStart: SCREEN_WIDTH / 2,
} as const

export interface StageCharacter {
  /** `event_char_0` · `_1` · `_2` */
  readonly file: string
  readonly animation: number
  /** event_char_0.mpl 팔레트 (null = 구운 그림) */
  readonly palette: number | null
  /** 미끄러짐을 뺀 자리 x */
  readonly x: number
}

/** 0x85f38 — 사기·몸 상태로 고르는 표정 n */
export function leadExpressionOf(morale: number, isUnwell: boolean): number {
  if (isUnwell) return 6
  if (morale > 90) return 1
  return morale <= 50 ? 6 : 0
}

function fileOfPortrait(index: number): string {
  if (index >= 10 && index <= 13) return 'event_char_1'
  if (index >= 17 && index <= 22) return 'event_char_2'
  return 'event_char_0'
}

/** 0x86020 — 코치 칸(SR+0x185) 의 인물. 없으면 null */
export function coachPortraitIndexOf(coach: number): number | null {
  if (coach < 0) return null
  return COACH_PORTRAIT_INDEX[coach] ?? COACH_FALLBACK_INDEX
}

/** 시즌 가운데 판 — 감독(팀 사기 · 질병) 과 채용한 코치 */
export function seasonStageCharactersOf(input: {
  readonly teamMorale: number
  readonly illness: number
  readonly coach: number
}): readonly StageCharacter[] {
  const coachIndex = coachPortraitIndexOf(input.coach)
  const lead: StageCharacter = {
    file: 'event_char_0',
    animation: PORTRAIT_ANIMATION_BASE[SEASON_MANAGER_INDEX] + leadExpressionOf(input.teamMorale, input.illness !== 0),
    palette: null,
    x: coachIndex === null ? CENTER_STAGE.soloLeadX : CENTER_STAGE.pairedLeadX,
  }
  if (coachIndex === null) return [lead]
  // 0x7f814 는 코치([gfx+0x254])를 먼저 그린다
  const coach: StageCharacter = {
    file: fileOfPortrait(coachIndex),
    animation: PORTRAIT_ANIMATION_BASE[coachIndex] ?? 0,
    palette: null,
    x: CENTER_STAGE.coachX,
  }
  return [coach, lead]
}

/** 나만의리그 가운데 판 — 선수 하나(idx 1 — 장타형 +8 · 피부 팔레트) */
export function nariStageCharactersOf(input: {
  readonly morale: number
  readonly isSick: boolean
  readonly isInjured: boolean
  /** 타자편(모드 4) 장타형이면 참 — 투수편은 늘 거짓 */
  readonly isSlugger: boolean
  readonly skinIndex: number
}): readonly StageCharacter[] {
  return [{
    file: 'event_char_0',
    animation: (input.isSlugger ? SLUGGER_ANIMATION_BASE : 0) + leadExpressionOf(input.morale, input.isSick || input.isInjured),
    palette: portraitPaletteIndex(input.skinIndex),
    x: CENTER_STAGE.soloLeadX,
  }]
}

/**
 * 미끄러짐 [gfx+0x350] — 그린 틀 수 t 마다 그린 **뒤에** `[gfx+0x348] / 8` 씩 줄인다 (0 아래로 안 감).
 * 미끄러지지 않고 들어온 화면은 0 이다.
 */
export function stageSlideOffsetAt(characters: readonly StageCharacter[], draws: number, slidesIn: boolean): number {
  if (!slidesIn) return 0
  const lead = characters[characters.length - 1]
  const step = Math.trunc((lead?.x ?? 0) / 8)
  return Math.max(0, CENTER_STAGE.slideStart - step * Math.max(0, draws))
}
