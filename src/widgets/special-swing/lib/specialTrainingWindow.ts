/**
 * **필살타법 · 마구 창** — 108(0x6c 훈련) · 123(0x7b 고르기) 의 탭 0 · 1. 그림 **0x803d4(gfx, 상태 틱)** 의 탭 0 · 1 공통 갈래
 * 805b4~80c56 을 직접 떴고, unicorn 으로 0x803d4 를 그대로 돌려(타자 탭 0 · 투수 탭 1 · 0x7b) 그리기 호출을 받았다.
 * 머리(8046c~805a8)는 탭 2 구질 훈련 창(`pitcher-league/lib/pitchTrainingWindow`)과 같다.
 *
 * ```
 * 8046c  공용 판 0x55e61(skin, mode_ui 26 박스 0 (24,71,192,151), 0, 0x11, 0x10, 0, 제목 탭 1, 0)
 * 80486  0x802dc(gfx, 박스 2 (29,93,182,104)) — 칠 #1D44A8 · 위·왼 선 #0A266F · 아래·오른 선 #5683F5
 * 80498  0xba19d(mode_ui 26, 0, 0)                       ; 아래 막대 셋 (원점 (29,200))
 * 804d2  탭 0 · 1: img_text 115 "필살타법"(탭 0) · 114 "마구훈련"(탭 1) 을 박스 1 (24,72,46,18) 에
 *        0xb9e05(정렬 0x21, 효과 0xb 단색 RGB(0x33,0x5F,0xCD), ox 20)
 * 805a8  상태 ≠ 0x7b: gpoint 11(G 동전)을 박스 3 (29,200,73,18) 에 0xb9d35(정렬 0x21, ox 2)
 * 805e4  칸 i = 0..3 (칸 = mode_ui 27 박스 i):
 *          min(선수 +0x18, 4) == i + 1 이면 아이콘 팔레트 0(주황) — 0x913e5([gfx+0x30], 0) … (−1)   ; 0xa43c4 가 아니다
 *          아이콘 [gfx+0x2c] 15(탭 0) · 19(탭 1) 를 칸에 정렬 0x22
 *          img_text 294 "LV" 정렬 0x44 (ox −8, oy −2) · num[i + 1] 정렬 0x44 (ox i == 0 ? −2 : −1, oy −1)
 *          탭 격자 칸 == i 이고 0xca911(틱, 10) ≠ 0: 칸을 **제자리에서** (−1, −1, +2, +2) 로 넓혀 0xba015(둥글기 1, RGB(255,255,0))
 *          s8 [저장+0x201](배운 수 L) ≤ i 이면 0xc37a9(칸.x + 1, 칸.y + 1, 칸.w − 1, 칸.h − 1) — 흑백 (`lockRegionOf`)
 * 807c0  이름 · 설명 (`slotTextOf`) — 0xbbf45(RGB(0x87,0xF8,0xFF)) 뒤 이름을 박스 4 (37,143,167,14) 에 0xba411(정렬 0x22),
 *        글꼴 흰색(0x9c735) 뒤 설명을 박스 5 (37,162,167,35) 에 0xba411(정렬 0x11)
 * 80a86  상태 ≠ 0x7b: 비용 |0xd4700[c]| × 100 0xba719(mode_ui 26 박스 3, 자간 1, 기준 0x14 주황, num, 정렬 0x24, ox −4) ·
 *        횟수 num[n](박스 5 (155,200,56,18), 정렬 0x22, ox −10) · num 101 "/" · num[0xd46f8[c]](ox +10) ·
 *        img_text 260 "회"(정렬 0x24, ox −3) — n 은 `slotProgressOf`
 * 80bd4  글 번호(`statusLabelOf`) > 0 이면 img_text[번호] 를 mode_ui 26 박스 4 (108,201,41,15) 정렬 0x22 (81392)
 * ```
 * 이름 · 설명의 갈래는 **탭이 아니라 모드**(0x7b970 `[gfx+0x20] == 4`)로 가른다 — 웹에서는 타자 = 탭 0, 투수 = 탭 1 이라 한 값으로 둔다.
 */
import { BATTER_BURSTS, PITCHER_BURSTS } from '@/shared/config/original/bursts'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 창의 두 쪽 — 타자 108 탭 0 · 123 (필살타법), 투수 108 탭 1 (마구) */
export type SpecialTrainingSide = '타자' | '투수'

/** 두 상태 — 108(0x6c) 트레이닝 칸 4 에서 배우기, 123(0x7b) 선수정보 칸 3 에서 고르기 */
export type SpecialTrainingState = '훈련' | '사용'

export interface TrainingBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** mode_ui 26 — 창 배치 (박스 0 판 · 1 제목 · 2 안쪽 · 3 비용 · 4 글 · 5 횟수) */
export const SPECIAL_TRAINING_LAYOUT_FRAME = 26
export const SPECIAL_TRAINING_PANEL: TrainingBox = { x: 24, y: 71, width: 192, height: 151 }
export const SPECIAL_TRAINING_TITLE_BOX: TrainingBox = { x: 24, y: 72, width: 46, height: 18 }
export const SPECIAL_TRAINING_INNER: TrainingBox = { x: 29, y: 93, width: 182, height: 104 }
export const SPECIAL_TRAINING_COST_BOX: TrainingBox = { x: 29, y: 200, width: 73, height: 18 }
export const SPECIAL_TRAINING_STATUS_BOX: TrainingBox = { x: 108, y: 201, width: 41, height: 15 }
export const SPECIAL_TRAINING_COUNT_BOX: TrainingBox = { x: 155, y: 200, width: 56, height: 18 }
/** 0x802dc 의 색 (0x1400748 인자 그대로) */
export const SPECIAL_TRAINING_INNER_COLORS = { fill: '#1D44A8', shade: '#0A266F', lit: '#5683F5' } as const

/** 제목 — 효과 0xb 단색 RGB(0x33, 0x5F, 0xCD), 박스 1 정렬 0x21(왼쪽 · 세로 가운데) ox 20 */
export const SPECIAL_TRAINING_TITLE_COLOR = '#335FCD'
export const SPECIAL_TRAINING_TITLE_OX = 20
/** mode_ui 27 — 칸 넷(박스 0~3) · 이름(박스 4) · 설명(박스 5) */
export const SPECIAL_TRAINING_SLOT_BOXES: readonly TrainingBox[] = [
  { x: 37, y: 99, width: 33, height: 34 },
  { x: 82, y: 99, width: 33, height: 34 },
  { x: 127, y: 99, width: 33, height: 34 },
  { x: 172, y: 99, width: 33, height: 34 },
]
export const SPECIAL_TRAINING_NAME_BOX: TrainingBox = { x: 37, y: 143, width: 167, height: 14 }
export const SPECIAL_TRAINING_DESCRIPTION_BOX: TrainingBox = { x: 37, y: 162, width: 167, height: 35 }
export const SPECIAL_TRAINING_SLOT_COUNT = 4

/** 이름 글 색 — 0xbbf45(0x1400748(0x87, 0xF8, 0xFF)) */
export const SPECIAL_TRAINING_NAME_COLOR = '#87F8FF'
/** 커서 — 0xba015(…, 둥글기 1, RGB(255, 255, 0)) */
export const SPECIAL_TRAINING_CURSOR_COLOR = '#FFFF00'

/** img_text 294 "LV" 정렬 0x44 (ox −8, oy −2) · num[i + 1] 정렬 0x44 (ox i == 0 ? −2 : −1, oy −1) */
export const LEVEL_LABEL_FRAME = 294
export const LEVEL_LABEL_OFFSET = { x: -8, y: -2 } as const
export const levelDigitOffsetOf = (slot: number) => ({ x: slot === 0 ? -2 : -1, y: -1 })

/** img_text 293 "배우기" · 295 "장착" · 296 "사용중" (0x125 · 0x127 · 0x128) · 260 "회" · num 101 "/" */
export const SPECIAL_TRAINING_LEARN_LABEL = 0x125
export const SPECIAL_TRAINING_EQUIP_LABEL = 0x127
export const SPECIAL_TRAINING_IN_USE_LABEL = 0x128
export const SPECIAL_TRAINING_TIMES_LABEL = 260
export const SPECIAL_TRAINING_SLASH_IMAGE = 101

interface SideSpec {
  /** img_text — 탭 0 115 "필살타법" · 탭 1 114 "마구훈련" (0x804d2 [+0x1cc] · 0x804f2 [+0x1c8]) */
  readonly titleFrame: number
  /** 아이콘 [gfx+0x2c] 의 그림 — 탭 0 [+0x3c] = 15 · 탭 1 [+0x4c] = 19 (0x8060a~0x8061a) */
  readonly iconFrame: number
  /** 이름 StrCOMMON 바탕 — 타자 0x18 + 0xd4730[c] · 투수 0x1e + 0xd4714[c] */
  readonly nameBase: number
  /** "사용 횟수:" 뒤 수 — 타자 0xd4724[번호] = 2 · 3 · 4 · 5 · 투수 0xd4708[번호] = 4 · 5 · 6 · 7 (번호 = c + 1) */
  readonly usesPerGame: readonly number[]
}

const SIDE_SPECS: Record<SpecialTrainingSide, SideSpec> = {
  타자: { titleFrame: 115, iconFrame: 15, nameBase: 0x18, usesPerGame: [2, 3, 4, 5] },
  투수: { titleFrame: 114, iconFrame: 19, nameBase: 0x1e, usesPerGame: [4, 5, 6, 7] },
}

export const specialTrainingTitleFrameOf = (side: SpecialTrainingSide) => SIDE_SPECS[side].titleFrame
export const specialTrainingIconFrameOf = (side: SpecialTrainingSide) => SIDE_SPECS[side].iconFrame

/** StrCOMMON 25~29 (필살타법 다섯) · 31~36 (마구 여섯) */
const commonNameOf = (index: number): string =>
  (index >= 0x1f ? PITCHER_BURSTS[index - 0x1f] : BATTER_BURSTS[index - 0x19]) ?? ''

/** 표 0xd4704 — 조건 인기도 ÷ 100 (s8 [1, 5, 10, 15]) */
const REQUIRED_POPULARITY_HUNDREDS: readonly number[] = [1, 5, 10, 15]
/** 표 0xd4700 — 비용 ÷ 100 (s8 [−5, −7, −9, −12], 절댓값을 쓴다) */
const COST_HUNDREDS: readonly number[] = [-5, -7, -9, -12]
/** 표 0xd46f8 — 필요 횟수 (s16 [4, 5, 6, 7]) */
const REQUIRED_SESSIONS: readonly number[] = [4, 5, 6, 7]

/** StrMODE[60] "조건: 인기도" · [61] "사용 횟수:" — 설명 글을 잇는 두 조각 ([gfx+0x164] = StrMODE) */
export const SPECIAL_TRAINING_CONDITION_TEXT = ORIGINAL_MODE_TEXT[60] ?? ''
export const SPECIAL_TRAINING_USES_TEXT = ORIGINAL_MODE_TEXT[61] ?? ''

/**
 * 칸 c 의 이름 StrCOMMON 번호 (0x807e6~0x8093e):
 * 타자 — 0x18 + 0xd4730[c](= c + 1), 레코드 +0xb 위 3비트(타입) == 1 이고 c == 3 이면 +1 (메테오 스윙).
 * 투수 — 0x1e + 0xd4714[c](= c + 1), c == 3 이면 0xb6e25(폼) / 2 == 1 → +1 · == 2 → +2 (폼/2 = 등록 타입).
 */
export function slotNameIndexOf(side: SpecialTrainingSide, slot: number, typeIndex: number): number {
  const base = SIDE_SPECS[side].nameBase + slot + 1
  if (slot !== 3) return base
  if (side === '타자') return typeIndex === 1 ? base + 1 : base
  return typeIndex === 1 ? base + 1 : typeIndex === 2 ? base + 2 : base
}

export const slotNameOf = (side: SpecialTrainingSide, slot: number, typeIndex: number) =>
  commonNameOf(slotNameIndexOf(side, slot, typeIndex))

/**
 * 설명 글 (0x807d2~0x809e4 — 0xbc75d · 0xbc965 · 0xbc73d 로 잇는다):
 * `"!cFFFFFF" + StrMODE[60] + 인기도 + (c > 0 ? " / " + 앞 칸 이름 : "") + "!N" + StrMODE[61] + 사용 횟수`.
 * 앞 칸 이름은 타입 보정 없이 표[c − 1] 그대로다(c − 1 < 3 이라 보정이 들 일이 없다).
 */
export function slotDescriptionOf(side: SpecialTrainingSide, slot: number, typeIndex: number): string {
  const popularity = (REQUIRED_POPULARITY_HUNDREDS[slot] ?? 0) * 100
  const prerequisite = slot > 0 ? ` / ${slotNameOf(side, slot - 1, typeIndex)}` : ''
  const uses = SIDE_SPECS[side].usesPerGame[slot] ?? 0
  return `!cFFFFFF${SPECIAL_TRAINING_CONDITION_TEXT}${popularity}${prerequisite}!N${SPECIAL_TRAINING_USES_TEXT}${uses}`
}

/** 비용 (0x80aaa~0x80ad8) — |0xd4700[c]| × 100 = 500 · 700 · 900 · 1200 */
export const slotCostOf = (slot: number) => Math.abs(COST_HUNDREDS[slot] ?? 0) * 100

/**
 * 횟수 "n / 필요" (0x80af4~0x80b90) — 필요 = 0xd46f8[c]. n 은 c < L 이면 필요(다 배운 칸), c > L 이면 0,
 * c == L 이면 s8 [저장+0x200](이번 레벨에 쌓은 횟수).
 */
export function slotProgressOf(slot: number, learnedCount: number, sessions: number): { readonly count: number; readonly required: number } {
  const required = REQUIRED_SESSIONS[slot] ?? 0
  if (slot < learnedCount) return { count: required, required }
  return { count: slot > learnedCount ? 0 : sessions, required }
}

/**
 * 주황 아이콘 (0x805f4~0x80678) — `min(선수 +0x18, 4) == i + 1`. 타입을 안 더한다 — 장타형이 메테오 스윙(저장 4)을 골라도
 * 넷째 칸 아이콘은 주황이다(아래 글 "사용중"은 0xa43c4 라 안 뜬다, `isSlotInUse`).
 */
export const isSlotIconInUse = (slot: number, inUseNumber: number) => Math.min(inUseNumber, 4) === slot + 1

/**
 * 0xa43c4(저장, c) — `n = c + 1, n > 3 이면 n += 레코드 +0xb 위 3비트` 로 레코드 +0x18 과 견준다(H-4 원본 어긋남 그대로).
 * 아래 글 "사용중" · 0x17cec 의 [69] 가 쓴다.
 */
export function isSlotInUse(slot: number, inUseNumber: number, typeIndex: number): boolean {
  const number = slot + 1
  return inUseNumber === (number > 3 ? number + typeIndex : number)
}

/**
 * 아래 글 번호 (0x805b4 · 0x80bd4~0x80c4c) — 처음 0x125 "배우기"(0x7b 면 0x127 "장착"). 0xa43c4 면 0x128 "사용중".
 * 그 밖 0x6c 는 c < L 이면 0(안 그림), 0x7b 는 그대로 0x127.
 */
export function statusLabelOf(state: SpecialTrainingState, slot: number, learnedCount: number, isInUse: boolean): number | null {
  if (isInUse) return SPECIAL_TRAINING_IN_USE_LABEL
  if (state === '사용') return SPECIAL_TRAINING_EQUIP_LABEL
  return slot < learnedCount ? null : SPECIAL_TRAINING_LEARN_LABEL
}

/** 잠긴 칸 — s8 [저장+0x201] ≤ i (0x8078a~0x80796) */
export const isSlotLocked = (slot: number, learnedCount: number) => learnedCount <= slot

/**
 * 흑백 자리 0xc37a9(x, y, w, h) — 칸을 (x + 1, y + 1, w − 1, h − 1) 로. **커서 테두리를 그린 틀에는** 0x8074e~0x8076a 가
 * 칸 상자를 제자리에서 (−1, −1, +2, +2) 로 고쳐 둔 채라 (x, y, w + 1, h + 1) 이 된다(원본 그대로).
 */
export function lockRegionOf(slot: number, isCursorDrawn: boolean): TrainingBox {
  const box = SPECIAL_TRAINING_SLOT_BOXES[slot] ?? SPECIAL_TRAINING_SLOT_BOXES[0]
  return isCursorDrawn
    ? { x: box.x, y: box.y, width: box.width + 1, height: box.height + 1 }
    : { x: box.x + 1, y: box.y + 1, width: box.width - 1, height: box.height - 1 }
}

/** 커서 테두리 0xba015 상자 — 칸 (−1, −1, +2, +2). 0x6aa64 는 (w + 1) × (h + 1) 을 덮는다 */
export function cursorBoxOf(slot: number): TrainingBox {
  const box = SPECIAL_TRAINING_SLOT_BOXES[slot] ?? SPECIAL_TRAINING_SLOT_BOXES[0]
  return { x: box.x - 1, y: box.y - 1, width: box.width + 2, height: box.height + 2 }
}

/** 깜빡임 — 0xca911(틱, 10) ≠ 0 */
export const isSpecialTrainingBlinkOn = (tick: number) => tick % 10 !== 0

/**
 * 0xc37a8 흑백 — RGB565 한 점의 R5 + G 위 5비트 + B5 + 3 = s 에서 회색 g5 = ⌊s/4⌋ + ⌊s/16⌋ + ⌊s/64⌋ (≈ 0.328 s).
 * 웹은 feColorMatrix 세 칸 0.328 로 옮긴다(⚠️ 내림 · 565 양자화는 안 따른다).
 */
export const SPECIAL_TRAINING_GRAY_WEIGHT = 0.328

export type SpecialTrainingKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'clr'

/** 웹 키 → 원본 키. 숫자 '2' '4' '6' '8' 은 격자(숫자키 꼴 1)가 ↑ ← → ↓ 로 읽고, '5' 는 OK 다 */
export function specialTrainingKeyOf(key: string): SpecialTrainingKey | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  if (key === 'ArrowLeft' || key === '4') return 'left'
  if (key === 'ArrowRight' || key === '6') return 'right'
  if (key === 'Enter' || key === '5') return 'ok'
  if (key === 'Escape' || key === 'Backspace') return 'clr'
  return null
}

/**
 * 창 키 0x80268 탭 ≤ 1 → 탭 격자 [gfx+0x190] 키 — 창 생성 0x7b5e0 의 vt+0x10(4, 1, 1, 0x330): 열 넷 · 줄 하나 · 가로 감기 ·
 * 세로 감기 · 감기면 다른 축으로 넘김. 줄이 하나라 ↑ 는 감겨 왼쪽 칸, ↓ 는 오른쪽 칸이 된다(0x6bead).
 */
export function moveSpecialTrainingCursor(slot: number, key: 'left' | 'right' | 'up' | 'down'): number {
  const step = key === 'left' || key === 'up' ? -1 : 1
  return (slot + step + SPECIAL_TRAINING_SLOT_COUNT) % SPECIAL_TRAINING_SLOT_COUNT
}
