import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ACE_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

/**
 * 마선수 등판.
 *
 * 원작은 조건을 만족하면 마선수가 상대로 나타난다. 그 조건은 아직 해독하지 못한
 * 이벤트 바이트코드 안에 있어서, 여기서는 경기 수가 쌓일수록 확률이 오르게 했다.
 * 등장 인물과 능력치는 원본 그대로다.
 */

export const ACE_PITCHERS: readonly AcePlayer[] = ACE_PLAYERS.filter(
  (ace) => ace.role === '투수',
)

export const ACE_BATTERS: readonly AcePlayer[] = ACE_PLAYERS.filter(
  (ace) => ace.role === '타자',
)

/**
 * 미션 레코드의 상대 마선수 순번(1부터, 0 은 일반 선수)을 마선수로 바꾼다.
 * 순번은 원본 마선수 표 순서와 같다 — 타자 미션 4번(레오니 이름)이 2, 투수 미션 12번(킹타이거)이 5.
 */
export function missionOpponentOf(opponentRole: AcePlayer['role'], order: number): AcePlayer | null {
  const candidates = opponentRole === '투수' ? ACE_PITCHERS : ACE_BATTERS
  return candidates[order - 1] ?? null
}

/**
 * 마선수의 투수 능력치.
 * 원본 표는 타자와 같은 4칸을 쓰는데, 투수는 그 값이 제구·구속·변화·체력을 뜻한다 (0xb570c, 누락 탐색 5차).
 * 타자 필드 이름으로 읽었으므로 hit = 제구, power = 구속이다.
 */
const PITCHER_ENGINE_DIVISOR = 10

export function pitcherAbilityOf(ace: AcePlayer): PitcherAbility {
  // 투구 엔진은 아직 0~100 눈금이라 경계에서 줄인다 — 원본 투구식 이식 때 없앤다
  // 폼·보유 구질은 같은 표(XlsACE_PIT_DATA)의 +0xb · +0x1c 에서 온다 — 마구(+0x18)는 아직 쓰지 않는다
  const repertoire = ACE_PITCHER_REPERTOIRES.find((candidate) => candidate.name === ace.name)
  return {
    control: Math.round(ace.ability.hit / PITCHER_ENGINE_DIVISOR),
    velocity: Math.round(ace.ability.power / PITCHER_ENGINE_DIVISOR),
    breaking: Math.round(ace.ability.defense / PITCHER_ENGINE_DIVISOR),
    ...(repertoire === undefined ? {} : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
  }
}
