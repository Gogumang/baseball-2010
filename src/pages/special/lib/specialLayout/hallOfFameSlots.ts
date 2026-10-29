/**
 * 슬롯 **0~4 는 투수 칸, 5~14 는 타자 칸**이다 (0x653ee: 빈 칸 아이콘이 슬롯 ≤ 4 면 글러브,
 * 아니면 방망이 — P6 2a-3 확정).
 */
export const HALL_OF_FAME_PITCHER_SLOTS = 5

/**
 * 칸 배치 (칸 채우기 0x5eb8c · 빈 칸 찾기 0x62514 확정):
 * ```
 * 0 = 나리 투수 · 1~4 = 명예 투수 0~3 · 5 = 나리 타자 · 6~9 = 명예 타자 0~3 · 10 = 안 씀 · 11~14 = 명예 타자 4~7
 * ```
 */
export const NARI_PITCHER_SLOT = 0

export const NARI_BATTER_SLOT = 5

const UNUSED_SLOT = 10

/** 칸 → 명예의 전당 편과 번호. 나리 칸·안 쓰는 칸은 null */
export function hallOfFameEntryOfSlot(slot: number): { readonly side: '투수' | '타자'; readonly index: number } | null {
  if (slot >= 1 && slot <= 4) return { side: '투수', index: slot - 1 }
  if (slot >= 6 && slot <= 14 && slot !== UNUSED_SLOT) return { side: '타자', index: slot <= 9 ? slot - 6 : slot - 7 }
  return null
}

/**
 * 칸 상태 `[목록+0x20c + 칸×8]` (0x5eb8c) — 0 아무것도 아님 · 1 나리 선수 있음 · 2 나리 선수 없음 ·
 * 3 명예 선수 있음 · 4 열린 빈 칸 · 5 잠긴 칸(열림 깃발 g+0x80+i / g+0x88+i 가 0).
 * 목록 종류 `[목록+0x1fc]` 가 **2(스페셜 명예의 전당, 상태 27 — 0x26024)** 면 나리 칸 0·5 를 채우지 않아 0 으로 남고,
 * **3(엔딩 뒤 등록, 나리 상태 145 — 0x1c91e)** 이면 나리 저장이 있는지로 1·2 를 넣는다. 칸 10 은 늘 0 이다.
 */
export type HallOfFameSlotState = 0 | 1 | 2 | 3 | 4 | 5

/**
 * 키 결과 코드 `0x5eae0` — 칸 상태와 편(칸 ≤ 4 면 투수)으로:
 * 1 → 투수 1 · 타자 2 · 3 → 투수 3 · 타자 4 · 2 → 5 · 4 → 6 · 5 → 7 · 그 밖 0.
 */
export function hallOfFameKeyCodeOf(state: HallOfFameSlotState, slot: number): number {
  const isBatter = slot >= HALL_OF_FAME_PITCHER_SLOTS
  if (state === 1) return isBatter ? 2 : 1
  if (state === 3) return isBatter ? 4 : 3
  if (state === 2) return 5
  if (state === 4) return 6
  if (state === 5) return 7
  return 0
}
