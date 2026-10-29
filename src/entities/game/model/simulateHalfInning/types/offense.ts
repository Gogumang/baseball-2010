import type { QuickAtBatBatter } from '@/entities/game/model/quickAtBat'
import type { QuickLineup } from '@/entities/game/model/quickLineup'

/* ── 공격 쪽: 명단과 CPU 대타 (0xc1ba4 → 0xac228 → 0xaebe4) ───────────────────── */

/**
 * 반 이닝을 도는 동안 공격 팀이 쓰는 것 — 이것을 넘기면 **타석마다 CPU 대타**(0xac228)가 돌고
 * 타자를 명단(`team+0xe`)에서 고른다. 안 넘기면 `batterAt` 이 고르는 예전 길 그대로다.
 */
export interface HalfInningOffense {
  readonly lineup: QuickLineup
  /** 그 로스터 칸 타자의 간이 타석용 능력 */
  readonly batterOf: (rosterSlot: number) => QuickAtBatBatter
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용).
   * "경기에 한 번" 이 아니다 — 세우는 곳 `0xac228`(ac33e), 지우는 곳 `0xa5e14`(a5e7c, 공마다)·`0x48d50`(48eb6,
   * 사람 장면 타석 시작)·`0xb67d0`(b6806, 경기 시작).
   */
  readonly pinchHitUsed: boolean
  /**
   * 그 로스터 칸 타자가 **마선수**인가 (`0xb633c`) — CPU 대타 `0xac228` 은 마선수 타자를 바꾸지 않는다.
   * 안 넘기면 아무도 마선수가 아니다 (CPU 끼리 경기의 마타자 칸만 참 — `simulateLeagueGame`).
   */
  readonly isAceRosterSlot?: (rosterSlot: number) => boolean
}
