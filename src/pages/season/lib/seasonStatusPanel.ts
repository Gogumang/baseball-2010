import { SEASON_YEAR_GOALS } from '@/entities/season-mode/model/seasonGoals'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { NAME_BAND, STATUS_BOXES, messageGameNumberOf, nameBandSplitOf } from '@/pages/management/lib/managementLayout'
import type { StatusIconState } from '@/pages/management/ui/StatusIconRow'

/**
 * 시즌모드 상태판 — 공용 상태판 **0x7d34c 의 모드 2 갈래** (직접 떴다, 0x7d34c~0x7df92 · 메시지줄 0x7d120).
 *
 * 부르는 곳은 열둘이다(`re.py xref 0x7d34c`) — 시즌 장면 0x105 쪽 다섯:
 * ```
 * 0x9f48  상태 0xd4 (연초 목표 걸침) — 상태판 하나뿐
 * 0x9f60  공통 틀 = 커맨드 줄 0x7e418 → 상태판 → (0xd3·0xde·0xe3·0xee 가 아니면) 가운데 판 0x7f814 → 머리띠 0x7f4ec
 *         ← 0xc9 관리 메뉴 · 0xcd 시즌정보 · 0xce 구단관리 · 0xcf 트레이닝(0xa0e4) · 0xd0 아이템 · 0xde 훈련 연출 ·
 *           0xeb·0xec·0xed·0xee·0xf0 시즌 끝 사슬 · 0xd3 이벤트(대화창 0x8b5ac 가 거짓이고 이전 상태가 외출 지도가 아닐 때)
 * 0xb1b4  상태 0xd6 보유 아이템 — 상태판 · 커맨드 줄 · 아이템 창 0x8453c · 머리띠
 * 0xb1f8  상태 0xdc 상점 — 아이템 메뉴 칸 1(구장)이면 구장 그림 + 0x83378 만, 창 종류 [win+0x1a4] == 3(장비)이면
 *         카드 0x7ba44 + 창만 — **그 밖(서브 1 · GP 2)일 때만** 상태판 · 커맨드 줄 · 0x8453c
 * 0x8b5ac 이벤트 대화창 — [창+0x174] ∈ {0x70, 0x71} 이면 지도 0x7ea64, 아니면 바탕 지우기 0x5fd61 →
 *         상태판(둘째 인자 = [이벤트+0xb] — 서면 메시지줄 경기 번호 −1) → 머리띠
 * ```
 * 나머지 일곱(0x11dbc · 0x11de4 · 0x11e0c · 0x11e34 · 0x11e5c · 0x167cc · 0x19da4)은 나만의리그 장면이다.
 * 외출 지도(0xd1·0xd2) · 코치채용(0xd7 → 0xaa24) · 트레이드(0xe4~0xe7) · 십전대보탕(0xe8) · 구장관리(0xea) ·
 * 정산(0xe9) 은 상태판을 그리지 않는다.
 *
 * 시즌 갈래가 나만의리그와 다른 곳 (0x7b998 = [창+0x20] == 2):
 * ```
 * 0x7d43c 이름 띠 꺾임 W/2 − 0x1c = 92 (나리 75)
 * 0x7d494 박스 1  img_text 65 + (s8)SR[1] 팀 이름 그림, 0xb9e05 정렬 0x22 · ox 6     (나리: 선수 이름 글 0xba411)
 * 0x7d530 박스 2  img_text 314 "팀목표   위 이내", 0xb9e05 정렬 0x22 · ox 6         (나리: 칭호 글)
 *                 그 빈칸에 num 20 + 0xd4406[min(SR+0xb3, 9) × 5] 를 프레임 vt+0x14 로
 *                 (박스x + 박스폭/2 + 3, 박스y + 5) · 효과 0xb(단색) 흰색            ; 연차를 9 로 자른다 — 목표 창은 안 자른다
 * 0x7d768 사기    팀 레코드 +2 (0x1f571(저장, SR[1]) + 2)                          (나리 0xa3a25(S))
 * 0x7d9d2 이름표 박스 5  img_text 227 "관중"                                       (나리 332 "연봉")
 * 0x7dbb6 박스 9  u32 SR+0x1b0 직전 경기 관중, 0xba719 ox −11 + img_text 344 "명" 정렬 0x24 · ox −2   (나리 연봉)
 * 0x7dd5e 아이콘  행운 · 부상 · 무력감 칸을 건너뛴다 — 이글아이(SR+0x54 목표점 보기)·질병(SR+5) 둘만 본다
 * ```
 * 박스 6 인기도(0xb6e79) · 박스 7 소지금(SR+2 × 100, 0x63331) · 박스 8 평판(SR+0x62) · 메시지줄은 모드 갈림이 없다.
 */

/** img_text 프레임 — 팀 이름 65~74 · "팀목표 위 이내" 314 · "관중" 227 · "명" 344 */
export const TEAM_NAME_IMAGE_BASE = 65
export const GOAL_RANK_TEXT_FRAME = 314
export const ATTENDANCE_LABEL_FRAME = 227
export const ATTENDANCE_UNIT_FRAME = 344
/** num 주황 숫자 20~29 — 목표 순위 한 자리 (단색 흰색으로 찍는다) */
export const GOAL_RANK_DIGIT_BASE = 20

/** img_text 그림 폭 (높이는 모두 10, 원점 0) */
const IMAGE_TEXT_WIDTHS: Readonly<Record<number, number>> = {
  65: 65, 66: 53, 67: 53, 68: 54, 69: 64, 70: 63, 71: 54, 72: 64, 73: 62, 74: 65,
  [GOAL_RANK_TEXT_FRAME]: 83, [ATTENDANCE_UNIT_FRAME]: 9,
}
const IMAGE_TEXT_HEIGHT = 10
const NAME_IMAGE_OX = 6
const ATTENDANCE_NUMBER_OX = -11
const ATTENDANCE_UNIT_OX = -2
const LAST_GOAL_YEAR = 9

export interface PlacedImage {
  readonly frame: number
  readonly left: number
  readonly top: number
}

/** 0xb9e05 → 0xb9d74 — 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(양수면 올림) · 그 뒤 ox */
function placeImageText(
  frame: number, area: { x: number; y: number; width: number; height: number }, align: number, ox: number,
): PlacedImage {
  const width = IMAGE_TEXT_WIDTHS[frame] ?? 0
  const difference = area.height - IMAGE_TEXT_HEIGHT
  let left = area.x + ox
  let top = area.y
  if ((align & 0x2) !== 0) left += (area.width - width) >> 1
  if ((align & 0x4) !== 0) left += area.width - width
  if ((align & 0x20) !== 0) top += (difference >> 1) + (difference % 2)
  return { frame, left, top }
}

const NAME_BOX = { x: NAME_BAND.nameBox.x, y: NAME_BAND.top, width: NAME_BAND.nameBox.width, height: NAME_BAND.height }
const GOAL_BOX = { x: NAME_BAND.titleBox.x, y: NAME_BAND.top, width: NAME_BAND.titleBox.width, height: NAME_BAND.height }

/** 목표 순위 — u16 0xd4406[min(연차, 9) × 5] (표 0xd7cf6 의 사본, 50칸 같다) */
export function statusPanelGoalRankOf(yearIndex: number): number {
  return SEASON_YEAR_GOALS[Math.min(yearIndex, LAST_GOAL_YEAR)]?.[0] ?? 0
}

export interface SeasonStatusPanelLayout {
  readonly nameBandSplit: number
  readonly teamName: PlacedImage
  readonly goalText: PlacedImage
  /** num 프레임을 단색 흰색으로 — 프레임 원점 자리 */
  readonly goalRankDigit: PlacedImage
  readonly attendanceUnit: PlacedImage
  /** 관중 숫자의 오른쪽 끝 (0xba719 ox −11) */
  readonly attendanceRight: number
  readonly year: number
  readonly game: number
  readonly icons: StatusIconState
}

export function seasonStatusPanelLayoutOf(record: SeasonRecord, isPreviousGame = false): SeasonStatusPanelLayout {
  const attendanceBox = STATUS_BOXES.salary
  return {
    nameBandSplit: nameBandSplitOf(true),
    teamName: placeImageText(TEAM_NAME_IMAGE_BASE + record.teamId, NAME_BOX, 0x22, NAME_IMAGE_OX),
    goalText: placeImageText(GOAL_RANK_TEXT_FRAME, GOAL_BOX, 0x22, NAME_IMAGE_OX),
    goalRankDigit: {
      frame: GOAL_RANK_DIGIT_BASE + statusPanelGoalRankOf(record.yearIndex),
      left: GOAL_BOX.x + Math.trunc(GOAL_BOX.width / 2) + 3,
      top: GOAL_BOX.y + 5,
    },
    attendanceUnit: placeImageText(ATTENDANCE_UNIT_FRAME, attendanceBox, 0x24, ATTENDANCE_UNIT_OX),
    attendanceRight: attendanceBox.x + attendanceBox.width + ATTENDANCE_NUMBER_OX,
    year: record.yearIndex + 1,
    game: messageGameNumberOf(record.games, record.inPostseason, isPreviousGame),
    icons: {
      isLuckEquipped: false,
      eagleEyeGamesRemaining: record.aimVisionGames,
      isSick: record.illness > 0,
      isInjured: false,
      hasHelplessness: false,
    },
  }
}
