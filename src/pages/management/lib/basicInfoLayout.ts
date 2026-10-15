import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { BATTER_BURSTS } from '@/shared/config/original/bursts'

/**
 * 선수정보 → 기본정보 (0x15e20: 카드 0x7ba44 → 선수 그림 → 정보 칸 0x7c450, 레이더 0x5a990 — layout-re 3차).
 * 상태판 대신 이 카드가 그려지고 하단 하위 메뉴는 그대로다.
 */
export const RADAR_CENTER = { x: 178, y: 104 }
export const RADAR_RADIUS = 30
const MAXIMUM_ABILITY = 999
const LABEL_DISTANCE = RADAR_RADIUS + 18
/** 축 각도 (화면 y 아래가 +) — 히트 · 파워 · 수비 · 주루 */
const AXIS_DEGREES = [225, 315, 45, 135]
const LABEL_BOX = { width: 26, height: 29 }
const SIXTEEN_BITS = 65536

/**
 * ×65536 표 곱을 `asrs #0x10` 으로 내린다 — 꼭짓점 0x76250 · 0x76286, 축 이름 기준점 0x5ac08 · 0x5ac1c (직접 떴다).
 * 산술 시프트라 음수는 더 작은 쪽으로 간다: 45° 쪽 48 은 +33 · −34.
 */
const scaled = (unit: number, distance: number) => Math.floor((unit * distance) / SIXTEEN_BITS)

/**
 * 꼭짓점 — 길이 = (u8)(값 × 최대길이 / 999)(0x761f8~0x76208, 최대길이 = 반지름 × 999 / 999), 값이 0 이 아니면
 * **최소 3**(0x7626e~0x76276 · 0x76292~0x7629a)이다. 값은 자라는 애니의 지금값(E+8)이다 (`radarGrowth`).
 */
export function radarPointOf(axis: number, value: number): { x: number; y: number } {
  const length = Math.floor((Math.max(0, value) * RADAR_RADIUS) / MAXIMUM_ABILITY) & 0xff
  const distance = value === 0 ? length : Math.max(3, length)
  const degree = AXIS_DEGREES[axis]
  return {
    x: RADAR_CENTER.x + scaled(cosineSixteen(degree), distance),
    y: RADAR_CENTER.y + scaled(sineSixteen(degree), distance),
  }
}

export function radarAxisEndOf(axis: number): { x: number; y: number } {
  const degree = AXIS_DEGREES[axis]
  return {
    x: RADAR_CENTER.x + scaled(cosineSixteen(degree), LABEL_DISTANCE),
    y: RADAR_CENTER.y + scaled(sineSixteen(degree), LABEL_DISTANCE),
  }
}

/** 축 이름 상자 (slt_frame 그림17, 26×29) — 중심보다 작으면 −폭+2, 아니면 −1 */
export function radarLabelBoxOf(axis: number): { x: number; y: number } {
  const end = radarAxisEndOf(axis)
  return {
    x: end.x < RADAR_CENTER.x ? end.x - LABEL_BOX.width + 2 : end.x - 1,
    y: end.y < RADAR_CENTER.y ? end.y - LABEL_BOX.height + 2 : end.y - 1,
  }
}

/** 축 이름 img_text (표 0xd1b14, 타자) */
export const RADAR_LABEL_FRAMES = [41, 42, 43, 44]
/** 투수 축 이름 — 0x5a990 모드 3 의 번호 0~3 → img_text 37 제구 · 38 구속 · 39 변화 · 40 체력 */
export const PITCHER_RADAR_LABEL_FRAMES = [37, 38, 39, 40]
export const RADAR_LABEL_BOX_IMAGE = './sprites/slt_frame/017.png'
export const RADAR_BACKGROUND_IMAGE = './sprites/slt_frame/003.png'
export const RADAR_COLORS = { axis: ORIGINAL_COLORS.radarAxis, fill: ORIGINAL_COLORS.highlightYellow, fillOpacity: 0xb4 / 255, edge: ORIGINAL_COLORS.text }

/** 숫자 색 — 기본값보다 표시값이 크면 초록, 작으면 빨강 (0x7c008) */
export function abilityColorOf(baseValue: number, shownValue: number): string | null {
  if (baseValue < shownValue) return ORIGINAL_COLORS.abilityUp
  if (baseValue > shownValue) return ORIGINAL_COLORS.abilityDown
  return null
}

/** 정보 칸 (mode_ui f2) — 판 (21,176,196,83) #335FCD */
export const INFO_BOARD = { x: 21, y: 176, width: 196, height: 83, color: ORIGINAL_COLORS.boardFill }
export const INFO_ROW_STEP = 17
/** 1열: 81 팀명 · 320 이름 · 321 타입 · 322 필살 / 2열: 323 보직 · 324 손 · 325 피부 · 326 타순 */
export const INFO_COLUMNS = [
  { labelFrames: [81, 320, 321, 322], label: { x: 30, width: 25 }, value: { x: 60, width: 81 } },
  { labelFrames: [323, 324, 325, 326], label: { x: 147, width: 25 }, value: { x: 176, width: 32 } },
]
export const INFO_TOP = 184
export const INFO_ROW_HEIGHT = 15

/** 문자열 표 (0x1400258 타입 · 0x1400248 보직 · 0x1400238 손 · 0x140022c 피부) */
export const BATTING_TYPE_NAMES = ['타격형', '장타형']
export const POSITION_NAMES = ['내야', '외야']
export const SIDE_NAMES = ['우타', '좌타']
export const SKIN_NAMES = ['황인', '백인', '흑인']

/**
 * 정보 칸 필살 줄 — 나리 타자편 갈래 (0x7cb5c~0x7cbc0, 직접 떴다):
 * ```
 * n = ldrb [기록+0x18] ; n ≤ 0 이면 줄을 안 쓴다(0x7cb84 `ble`)
 * i = 0x18 + n + (0x7b984(gfx) 투수편 ? 6 : 0) + (n == 4 ? [기록+0xb] >> 5 : 0)
 * 0xba411(칸, StrCOMMON[i], 정렬 0x22)
 * ```
 * 타자편은 StrCOMMON[25~28] 파워 · 플레임 · 토네이도 · 미라지 스윙, 장타형(타입 1)의 4 는 [29] 메테오 스윙이다.
 * 기록 +0x18 은 1~4 만 들어간다(고르기 0x17c64 · 훈련 완료 0x1816c 둘 다 `칸 + 1`).
 */
export function basicInfoSpecialNameOf(number: number, battingTypeIndex: number): string {
  if (number <= 0) return ''
  return BATTER_BURSTS[number - 1 + (number === 4 ? battingTypeIndex : 0)] ?? ''
}
/** 선수 그림 발 기준 (57,160) — 프레임 박스 0 (11,53,93,117) 의 (x + (w >> 1), y + h − 10) */
export const FIGURE_FOOT = { x: 57, y: 160 }
export const ABILITY_TITLE = { plate: { x: 154, y: 53 }, frame: 159, centerX: 178, y: 57 }
