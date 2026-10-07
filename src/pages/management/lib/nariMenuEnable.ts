/**
 * 나만의리그(장면 0x106 — 타자편 · 투수편 공용) 관리 메뉴 [this+0x8c] 의 켬 표(+0x28) — 105 진입 0x11910 이 쓴다(직접 떴다):
 * ```
 * 0x1194a  S+4(행동함) ≠ 0           → 표[1] = 표[2] = 표[3] = 0        ; 트레이닝 · 휴식 · 외출
 * 0x11c2c  S+0xb3(연차) == 0 && (s8)S+0xb2(이번 시즌 경기 수) ≤ 9   → 표[3] = 0
 *          그 밖 S+4 == 0                                         → 표[3] = 1
 * ```
 * 표는 장면을 지을 때 0x6c4bc 가 memset(1) 한다(0x105 진입은 끄기 · 칸 3 켜기만). 0x7e418 은 표가 0 인 칸을 흑백 0xc37a8 로 그린다.
 * 웹 연차 `season` 은 1 부터라 S+0xb3 == 0 은 `season === 1`.
 */
export interface NariMenuEnableInput {
  readonly hasActedThisCycle: boolean
  readonly season: number
  readonly gamesPlayed: number
}

const CYCLE_SLOT_IDS = ['트레이닝', '휴식', '외출'] as const
const OUTING_SLOT_ID = '외출'
/** S+0xb2 ≤ 9 — 첫 해 10경기 전에는 외출 칸이 꺼진다 */
const FIRST_YEAR_OUTING_LOCK_GAMES = 9

export function nariMainMenuOffIdsOf({ hasActedThisCycle, season, gamesPlayed }: NariMenuEnableInput): ReadonlySet<string> {
  const off = new Set<string>(hasActedThisCycle ? CYCLE_SLOT_IDS : [])
  if (season === 1 && gamesPlayed <= FIRST_YEAR_OUTING_LOCK_GAMES) off.add(OUTING_SLOT_ID)
  return off
}
