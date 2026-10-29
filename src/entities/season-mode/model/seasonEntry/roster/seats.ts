import { ROTATION_SIZE, rotationSlotOf } from '@/entities/season-mode/model/seasonEntry/otherSlices'

/** 마투수가 들어가는 칸 (`0xb521c` 의 0x60 가지) · 마타자가 들어가는 칸 (`0xb53f0` 의 0x40 가지) */
const ACE_PITCHER_SLOT = 8
const ACE_BATTER_SLOT = 9
/** 시즌 레코드의 마투수 칸 · 마타자 칸 — 트레이드 요청 굴림(`tradeRequest`)이 같은 칸을 본다 */
export const SEASON_RECORD_ACE_PITCHER_SLOT = ACE_PITCHER_SLOT
export const SEASON_RECORD_ACE_BATTER_SLOT = ACE_BATTER_SLOT
/** 마선수 · 표 밖 기록 없는 선수의 명단 첨자 */
export const NOT_IN_ROSTER = -1

/** 마선수를 칸에 앉힌다 — 옛 칸 선수는 맨 끝으로 (`b527e` · `b544a`). 칸이 비어 있으면 그 자리에 덧붙는다 */
export function seatAce<T>(rows: readonly T[], slot: number, ace: T): T[] {
  const next = [...rows]
  const seated = next[slot]
  if (seated !== undefined) next.push(seated)
  if (slot > next.length) return [...next, ace]
  next[slot] = ace
  return next
}

/** g 번 로테이션(`0xb5ca8`: 0~3 한 칸 당김)을 돈 모양 — `view[i] = base[(i + g) % 4]` */
export function rotatedPitchersOf<T>(pitchers: readonly T[], dayCounter: number): T[] {
  const next = [...pitchers]
  if (pitchers.length < ROTATION_SIZE) return next
  const shift = rotationSlotOf(dayCounter)
  for (let i = 0; i < ROTATION_SIZE; i += 1) next[i] = pitchers[(i + shift) % ROTATION_SIZE] as T
  return next
}

/** `rotatedPitchersOf` 를 되돌린다 */
export function unrotatedPitchersOf<T>(view: readonly T[], dayCounter: number): T[] {
  const next = [...view]
  if (view.length < ROTATION_SIZE) return next
  const shift = rotationSlotOf(dayCounter)
  for (let i = 0; i < ROTATION_SIZE; i += 1) next[(i + shift) % ROTATION_SIZE] = view[i] as T
  return next
}

/**
 * 레코드에 마선수를 앉힌 배열의 칸 → 앉히기 전 줄 번호 (마선수 칸은 `'ace'`). 마선수가 없으면(`ace` < 0) 그대로다.
 * 예: 투수 8줄 · 8번 → [0..7, 'ace'] · 타자 12줄 · 9번 → [0..8, 'ace', 10, 11, 9]
 */
export function recordAceSeatOf(length: number, ace: number, slot: number): readonly (number | 'ace')[] {
  const rows: (number | 'ace')[] = Array.from({ length }, (_, index) => index)
  return ace < 0 ? rows : seatAce<number | 'ace'>(rows, slot, 'ace')
}
