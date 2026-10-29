import { hallOfFameSlotUnlockIdOf, isUnlocked } from '@/shared/config/unlocks'
import type { Collection, HallOfFamePitcher, HallOfFameSide, HallOfFamer } from '@/entities/collection/model/collection/types'

/**
 * 스페셜 메뉴의 기록연감·명예의 전당 (StrHOWTO[28]). 선수 한 명이 아니라 게임 전체에 쌓인다.
 *   기록연감: 닉네임·스킬·엔딩 열람 ("게임 플레이 시간 기록" 은 아직 없다)
 *   명예의 전당: 엔딩 후 등록 (K 4-2 · Q2 4절)
 *
 * 명예의 전당 칸 (전역기록) — 한 명 = 등록 순간의 0x30 바이트 선수 기록 통째 사본:
 *   투수 +0x880 + i·0x30 (i 0~3, 0x1f62c) · 열림 깃발 g+0x80+i
 *   타자 +0x940 + i·0x30 (i 0~7, 0x1f640) · 열림 깃발 g+0x88+i
 * 기본 개방 **투수 2 · 타자 4** 이고 나머지는 현금 슬롯 구매(StrCOMMON 44/45 · 53/54 🌐)로만 열린다 — 오프라인 웹은 늘 기본 개방이다.
 * 찬 칸 판정은 그 기록의 능력치 네 칸 중 하나라도 0 이 아닌가다 (0x1f6ac).
 */
export const HALL_OF_FAME_MAX_PITCHERS = 4
export const HALL_OF_FAME_MAX_BATTERS = 8
export const HALL_OF_FAME_OPEN_PITCHERS = 2
export const HALL_OF_FAME_OPEN_BATTERS = 4

/** 타자 칸 i 의 선수 (칸 번호를 따라 찾는다) */
export function hallOfFameBatterAt(collection: Pick<Collection, 'hallOfFame'>, slot: number): HallOfFamer | null {
  return collection.hallOfFame.find((famer, index) => (famer.slot ?? index) === slot) ?? null
}

export function hallOfFamePitcherAt(collection: Pick<Collection, 'hallOfFamePitchers'>, slot: number): HallOfFamePitcher | null {
  return collection.hallOfFamePitchers.find((famer) => famer.slot === slot) ?? null
}

/**
 * 빈 칸 찾기 `0x62514(목록, 투수?)` — 칸 상태 4(열린 빈 칸)인 첫 칸. 없으면 null.
 * 투수 칸 1~4 → 번호 0~3, 타자 칸 6~9·11~14 → 0~7. 열림은 기본 개방(투수 2 · 타자 4)뿐이다.
 */
export function firstEmptyHallOfFameSlot(collection: Collection, side: HallOfFameSide): number | null {
  const max = side === '투수' ? HALL_OF_FAME_MAX_PITCHERS : HALL_OF_FAME_MAX_BATTERS
  for (let slot = 0; slot < max; slot += 1) {
    if (!isHallOfFameSlotOpen(side, slot)) continue
    const taken = side === '투수' ? hallOfFamePitcherAt(collection, slot) : hallOfFameBatterAt(collection, slot)
    if (taken === null) return slot
  }
  return null
}

/**
 * 칸이 열려 있나 — 원본은 기본 개방(투수 2 · 타자 4)뿐이다. 해금 표(`unlocks.json`)가 풀면 나머지 칸(현금 슬롯 🌐)도 연다.
 * 열림 깃발(g+0x80 · g+0x88)을 저장에 쓰지 않고 판정할 때만 푼다.
 */
export function isHallOfFameSlotOpen(side: HallOfFameSide, slot: number): boolean {
  const original = () => slot >= 0 && slot < (side === '투수' ? HALL_OF_FAME_OPEN_PITCHERS : HALL_OF_FAME_OPEN_BATTERS)
  const unlockId = hallOfFameSlotUnlockIdOf(side, slot)
  return unlockId === null ? original() : isUnlocked(unlockId, original)
}

/**
 * 명전 기록의 선수 번호 `+0` — 등록이 칸 번호로 덮어쓴다 (0x1f654 투수 `+0 = 칸 − 0x4c` · 0x1f680 타자 `+0 = 칸 − 0x38`,
 * u8 로 칸 + 0xb4 / 칸 + 0xc8). 시즌 영입 중복 검사 0xb50ac 와 삭제 0x221dc 가 이 번호로 시즌 명단을 찾는다.
 */
export const HALL_OF_FAME_PITCHER_FIRST_RECORD_ID = 0xb4
export const HALL_OF_FAME_BATTER_FIRST_RECORD_ID = 0xc8
export function hallOfFameRecordIdOf(side: HallOfFameSide, slot: number): number {
  return (side === '투수' ? HALL_OF_FAME_PITCHER_FIRST_RECORD_ID : HALL_OF_FAME_BATTER_FIRST_RECORD_ID) + slot
}

/** 명전 기록 번호(칸 + 0xb4 / + 0xc8) → 칸 번호 */
export function hallOfFameSlotOfRecordId(side: HallOfFameSide, recordId: number): number {
  return recordId - (side === '투수' ? HALL_OF_FAME_PITCHER_FIRST_RECORD_ID : HALL_OF_FAME_BATTER_FIRST_RECORD_ID)
}
