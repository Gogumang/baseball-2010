import type { HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import {
  IMG_TEXT_FRAMES,
  batterPositionBadgeOf,
  framePlacementOf,
  pitcherRoleBadgeOf,
  type FrameSize,
  type Placed,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/**
 * 공 가진 야수 고리 · 이름 판의 자리 (0x43cb0 의 0x43d2a~0x43fc2, 직접 뜬 것).
 *
 * ```
 * 43dc4: 0xba815(game_ui, 0x2e, 1) → 프레임 46 상자 (폭 23 · 높이 18)
 * 43de4: 0x93c45(애니, 야수점 x − (폭 >> 1), 야수점 y − (높이 >> 1))   ; 야수점 = 0xb94b5(카메라, x, z − y) + 화면 오프셋
 * 43e1e: 0x93cfd(애니, 1) · 0x93d91(애니)                              ; 그린 뒤 한 칸 넘긴다
 * 43eb8: 0xba815(game_ui, 10, 1) → 판 상자 (49 × 15) — x = W − 폭 − 2, y = H − 높이 − 2 (43ece~43ef2)
 * 43f14: 판 프레임 10 을 그 자리에 · 43f2c: 0xba411(판 상자, 이름, 정렬 0x22)
 * 43f3c: 0xba815(game_ui, 칸 + 0x20, 1) → 칸 아이콘 상자 — x = 판 x − 아이콘 폭, y = 판 y (43f4c~43f5a)
 * 43f76: 0xba759(game_ui, 칸 + 0x20, 종류 1, x, y)
 * 43f82: 0x913e5(img_text, 0) · 43fc2: 0xb9d75(img_text[글자], 아이콘 상자, 정렬 0x22)
 * ```
 * 판은 칸 아이콘 번호(0x54590 · 0x545e8 이 적는 sp+0x54, 처음 0)가 **0 이하면 통째로 안 그린다**(43ea8) — 고리는 이미 그렸다.
 */

/** game_ui 프레임 46 (고리 애니 1·2·3 의 첫 칸) — 0xba815 상자 */
export const HOLDER_RING_BOX = { width: 23, height: 18 } as const
/** game_ui 프레임 10 — 이름 판 */
export const HOLDER_PLATE_FRAME = 10
export const HOLDER_PLATE_BOX = { width: 49, height: 15 } as const
/** 칸 아이콘 = game_ui (칸 + 0x20) — 36 · 37 · 39 모두 36 × 15 */
export const HOLDER_CHIP_FRAME_OFFSET = 0x20
const HOLDER_CHIP_SIZE: Readonly<Record<number, { width: number; height: number }>> = {
  36: { width: 36, height: 15 },
  37: { width: 36, height: 15 },
  39: { width: 36, height: 15 },
}
/** 판을 화면 오른쪽 아래 가장자리에서 띄우는 값 (43eda `subs r0, #2` · 43eee) */
const PLATE_MARGIN = 2

/** 고리 애니를 그릴 왼쪽 위 — 야수 화면점에서 상자 절반씩 당긴다 (`asrs #0x11` = 반 내림) */
export function holderRingPointOf(fielder: Placed): Placed {
  return { x: fielder.x - (HOLDER_RING_BOX.width >> 1), y: fielder.y - (HOLDER_RING_BOX.height >> 1) }
}

export interface HolderPlateLayout {
  /** 판 (game_ui 10) 왼쪽 위 = 이름 상자 */
  readonly plate: Placed
  readonly name: string
  /** 칸 아이콘 game_ui 프레임 (칸 + 0x20) */
  readonly chipFrame: number
  readonly chip: Placed & { readonly width: number; readonly height: number }
  /** img_text 글자 (−1 이면 안 그린다) */
  readonly label: number
  /** 글자 원점 — 아이콘 상자 안 가운데(0x22). 크기를 모르는 글자는 null */
  readonly labelAt: Placed | null
}

/**
 * 이름 판의 배치. 칸 아이콘 번호가 0 이하면 null(판 없음).
 *
 * 칸 0(투수)은 `pitcherRoleBadgeOf` — 0x545e8 의 보직 표(0 선발 4 · 1 중계 7 · 2 구원 5, 그 밖은 0 그대로)이고,
 * 나머지는 `batterPositionBadgeOf` — 0x54590 의 수비 코드 표(0 이면 −1, 9 넘으면 안 바꿔 0 그대로)다.
 * 두 함수의 "안 바꾼다" 몫은 이 함수가 sp+0x54 · sp+0x50 의 처음 값 0 으로 채운다(43d08~43d0c).
 */
export function holderPlateLayoutOf(
  slot: number,
  plate: HolderPlate,
  screen: { readonly width: number; readonly height: number },
): HolderPlateLayout | null {
  const badge = slot === 0 ? pitcherRoleBadgeOf(plate.pitcherRole ?? -1, 0) : batterPositionBadgeOf((plate.positionCode ?? 0) & 0xf, 0, 0)
  if (badge.chip <= 0) return null
  const chipFrame = badge.chip + HOLDER_CHIP_FRAME_OFFSET
  const chipSize = HOLDER_CHIP_SIZE[chipFrame]
  if (chipSize === undefined) return null
  const platePoint = {
    x: screen.width - HOLDER_PLATE_BOX.width - PLATE_MARGIN,
    y: screen.height - HOLDER_PLATE_BOX.height - PLATE_MARGIN,
  }
  const chip = { x: platePoint.x - chipSize.width, y: platePoint.y, ...chipSize }
  const labelSize: FrameSize | undefined = IMG_TEXT_FRAMES[badge.label]
  const labelAt =
    badge.label < 0 || labelSize === undefined
      ? null
      : framePlacementOf({ x: chip.x, y: chip.y, width: chip.width, height: chip.height }, labelSize, 0x22, { x: 0, y: 0 })
  return { plate: platePoint, name: plate.name, chipFrame, chip, label: badge.label, labelAt }
}
