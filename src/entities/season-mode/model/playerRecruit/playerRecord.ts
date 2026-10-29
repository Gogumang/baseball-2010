import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit/seasonPlayer'

/**
 * 선수 레코드 `+0xa` 의 구조 (S6 3-2, 원본 Xls 4표로 직접 확인):
 * ```
 * bit7 0x80 : 육성(내) 선수 · 명예의전당 선수
 * bit6 0x40 : 마선수(ACE)
 * bit5 0x20 : 종류 보조 비트
 * bit4..0   : 팀 안 칸 번호 (타자 0~11 · 투수 0~7) 또는 마선수 순번 0~4
 * ```
 * bit6:bit5 두 비트가 **선수 종류 코드**다.
 */
export const PLAYER_KIND_MASK = 0x60
export const PLAYER_SLOT_MASK = 0x1f
export const PLAYER_OWN_BIT = 0x80

export const PLAYER_KIND = {
  일반투수: 0x00,
  일반타자: 0x20,
  마타자: 0x40,
  마투수: 0x60,
} as const
export type PlayerKind = (typeof PLAYER_KIND)[keyof typeof PLAYER_KIND]

/** 종류 = `(b >> 5) & 3` 로 외우는 편이 정확하다 */
export function playerKindOf(kindByte: number): PlayerKind {
  return (kindByte & PLAYER_KIND_MASK) as PlayerKind
}

/** id 구간 — `0xb4..0xc7` 명예의전당 **투수** 20명 · `0xc8..` 명예의전당 타자 · `0xfe` 내 선수 */
export const HALL_OF_FAME_FIRST_ID = 0xb4
export const HALL_OF_FAME_LAST_PITCHER_ID = 0xc7
export const OWN_PLAYER_ID = 0xfe

/**
 * 투수인가 — `0xb6278` (S6 3-3 확정).
 * ```
 * if ((b & 0x60) == 0x60) return 1                  ; 마투수
 * if (id != 0xfe && id > 0xb3)  return (id <= 0xc7) ; 명예의전당 투수 20명만 투수
 * if (b & 0x20) return 0                            ; 일반 타자
 * if (b & 0x40) return 0                            ; 마타자
 * return 1
 * ```
 * ⚠️ J-3 의 "마타자는 이 식 때문에 보직 벌점을 면제받는다" 는 **틀렸다** (S6 정정 4번):
 * `(b&0x60)==0x60` 은 마투수만 걸리고 마타자는 id 가지로 가서 정상적으로 타자가 된다.
 */
export function isPitcherRecord(id: number, kindByte: number): boolean {
  if ((kindByte & PLAYER_KIND_MASK) === PLAYER_KIND.마투수) return true
  if (id !== OWN_PLAYER_ID && id > HALL_OF_FAME_FIRST_ID - 1) return id <= HALL_OF_FAME_LAST_PITCHER_ID
  if (kindByte & 0x20) return false
  if (kindByte & 0x40) return false
  return true
}

/** `0xb6394(P)` = `P[0xa] & 0x1f` — 팀 안 칸 번호 */
export function slotOf(player: SeasonPlayer): number {
  return player.kindByte & PLAYER_SLOT_MASK
}

/**
 * `0xb6604(P, i)` = `P[0xa] = (P[0xa] & 0xe0) | (i & 0x1f)` — **하위 5비트 세터**다.
 *
 * ⚠️ R13 9절이 "시즌 선수 만들기" 로 적은 것은 틀렸다 (S6 정정 6번).
 * 게다가 원본은 이 세터를 **저장된 명예의전당·나리 기록에 그대로 건다** — 즉
 * 원본 레코드의 칸 번호가 실제로 바뀌고 다음 영입 때까지 남는다(부작용, 원본 그대로).
 */
export function withSlot(player: SeasonPlayer, slot: number): SeasonPlayer {
  return { ...player, kindByte: (player.kindByte & 0xe0) | (slot & PLAYER_SLOT_MASK) }
}

/**
 * 명전 선수인가 — `0xb6348(P)` (직접 떴다):
 * ```
 * if (P[0xa] & 0x40) return 0                          ; 0xb633c — 마선수 비트
 * 투수(0xb6278): (u8)(id + 0x4c) <= 0x18 → 1            ; id 0xb4..0xcc
 * 타자          : (u8)(id + 0x38) <= 8    → 1            ; id 0xc8..0xd0
 * ```
 */
export function isHallOfFameRecord(player: SeasonPlayer): boolean {
  if ((player.kindByte & 0x40) !== 0) return false
  if (isPitcherRecord(player.id, player.kindByte)) return ((player.id + 0x4c) & 0xff) <= 0x18
  return ((player.id + 0x38) & 0xff) <= 8
}
