import { PITCHER_SLOT, BATTER_SLOT, TEAM_ABILITY_SLOT } from '@/features/play-team-game/model/gameAbilities/slots'

/**
 * 팀 능력치를 선수에게 먹이는 모드 — 비트마스크 **0x306 = {1, 2, 8, 9}** (0xb593a).
 * ⚠️ H-1 은 "모드 2·8·9 에서만" 이라고 적었지만 코드는 모드 1(일반)도 넣는다. **코드 쪽이 기준**이다.
 */
const TEAM_ABILITY_MODE_MASK = 0x306
/** 비트마스크로 볼 수 있는 가장 큰 모드 (32비트) */
const LAST_MODE_BIT = 31

export function isTeamAbilityMode(mode: number): boolean {
  if (mode < 0 || mode > LAST_MODE_BIT) return false
  return ((1 << mode) & TEAM_ABILITY_MODE_MASK) !== 0
}

/**
 * 팀 능력치 T 가 선수 능력치에 더하는 값 (0xb5a04, 확정):
 * `T ≠ 0 이면 v += (17·T − 5100) / 100` = 0.17 × (T − 300), **0 쪽 버림**.
 * 예: 330 → +5 · 400 → +17 · 500 → +34 · 666(외인구단) → +62. T < 300 이면 줄어든다.
 */
export function teamAbilityBonusOf(teamAbility: number): number {
  if (teamAbility === 0) return 0
  return Math.trunc((17 * teamAbility - 5100) / 100)
}

/** 선수 칸 → 그 칸을 밀어 주는 팀 능력치 칸 (0xb5942~0xb59fe) */
export function teamAbilitySlotFor(isPitcher: boolean, slot: number): number {
  if (isPitcher) {
    if (slot === PITCHER_SLOT.구속 || slot === PITCHER_SLOT.변화) return TEAM_ABILITY_SLOT.투구
    if (slot === PITCHER_SLOT.제구) return TEAM_ABILITY_SLOT.집중
    return TEAM_ABILITY_SLOT.근성
  }
  if (slot <= BATTER_SLOT.파워) return TEAM_ABILITY_SLOT.타격
  if (slot === BATTER_SLOT.수비) return TEAM_ABILITY_SLOT.집중
  return TEAM_ABILITY_SLOT.근성
}
