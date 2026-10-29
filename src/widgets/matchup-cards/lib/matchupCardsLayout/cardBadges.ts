/** 보직 · 수비 위치 칩과 오늘 타석 기록 칩 */
import { BATTER_BOXES, box } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'
import { type Placed, framePlacementOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardPlacement'

/**
 * 투수 보직 → (game_ui 칸, img_text 글자) — `0x545e8(스킨, 0xb6704(투수), &칸, &글자)`.
 * 0 선발 (4 빨강, 49) · 1 중계 (7 파랑, 170) · 2 구원 (5 초록, 182). 그 밖이면 둘 다 안 바꾼다 —
 * 칸은 0x44b9c 가 넣어 둔 0(game_ui 프레임 0), 글자는 박스 1 에 쓴 PLAYER/COM 번호가 남는다 (원본 그대로).
 */
export function pitcherRoleBadgeOf(role: number, playerLabel: number): { chip: number; label: number } {
  if (role === 0) return { chip: 4, label: 0x31 }
  if (role === 1) return { chip: 7, label: 0xaa }
  if (role === 2) return { chip: 5, label: 0xb6 }
  return { chip: 0, label: playerLabel }
}

/**
 * 타자 수비 → (game_ui 칸, img_text 글자) — `0x54590(스킨, +0x1c & 0xf, &칸, &글자)` (점프표 0xd1988).
 * 0 → 둘 다 −1(안 그린다) · 1 지명(7, 183) · 2 포수(5, 176) · 3 1루(5, 173) · 4 2루(5, 174) · 5 3루(5, 175) ·
 * 6 유격(5, 184) · 7 우익(4, 179) · 8 좌익(4, 177) · 9 중견(4, 178). 9 보다 크면 안 바꾼다(앞 판의 칸 · 이 판 박스 1 글자).
 */
const POSITION_BADGES: readonly { chip: number; label: number }[] = [
  { chip: -1, label: -1 },
  { chip: 7, label: 0xb7 },
  { chip: 5, label: 0xb0 },
  { chip: 5, label: 0xad },
  { chip: 5, label: 0xae },
  { chip: 5, label: 0xaf },
  { chip: 5, label: 0xb8 },
  { chip: 4, label: 0xb3 },
  { chip: 4, label: 0xb1 },
  { chip: 4, label: 0xb2 },
]

export function batterPositionBadgeOf(position: number, leftoverChip: number, playerLabel: number): { chip: number; label: number } {
  return POSITION_BADGES[position] ?? { chip: leftoverChip, label: playerLabel }
}

/**
 * 오늘 타석 기록 칸 — 기록 코드(0x53100 이 링 버퍼에서 꺼낸다) → (game_ui 칸 0xd00a0, img_text 글자 0xd0078).
 * 0 아웃 · 1 안타 · 2 2루타 · 3 3루타 · 4 홈런 · 5·6 아웃 · 7 삼진 · 8·9 사구.
 */
export const RESULT_CHIP_FRAMES: readonly number[] = [70, 69, 69, 69, 69, 70, 70, 70, 71, 71]

export const RESULT_CHIP_LABELS: readonly number[] = [361, 58, 59, 60, 61, 361, 361, 181, 362, 362]

/** 칸 폭 — 0xba815(game_ui, 0x45, 종류 1) 의 폭 32 (0x45668) */
const RESULT_CHIP_WIDTH = 32

export interface ResultChip {
  readonly frame: number
  readonly label: number
  /** 칸 그림 왼쪽 위 (0xba758) */
  readonly x: number
  readonly y: number
  /** 글자 원점 — 0x5650c 가 칸 크기(0xba815) 안 가운데(정렬 0x22)에 둔다 */
  readonly labelX: number
  readonly labelY: number
}

/**
 * 판 아래 오늘 타석 기록 (0x455f4~0x4577e). 개수 n = 칸+0xc, 시작 = n > 4 ? n − 4 : 0 → **마지막 넷**.
 * k 번째 칸 = (판x + (32 + 1)·k + 1, 판y + 62 + 1). 글자는 같은 자리 32×15 안 가운데.
 */
export function recentResultChipsOf(codes: readonly number[], origin: Placed): ResultChip[] {
  const start = codes.length > 4 ? codes.length - 4 : 0
  return codes.slice(start).map((code, index) => {
    const chipFrame = RESULT_CHIP_FRAMES[code] ?? RESULT_CHIP_FRAMES[0]
    const label = RESULT_CHIP_LABELS[code] ?? RESULT_CHIP_LABELS[0]
    const x = origin.x + (RESULT_CHIP_WIDTH + 1) * index + 1
    const y = origin.y + BATTER_BOXES[0].height + 1
    const chip = GAME_UI_FRAMES[chipFrame]
    const at = framePlacementOf(box(x, y, chip.width, chip.height), IMG_TEXT_FRAMES[label], 0x22, { x: 0, y: 0 })
    return { frame: chipFrame, label, x, y, labelX: at.x, labelY: at.y }
  })
}
