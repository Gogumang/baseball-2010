import type { OriginalMission } from '@/shared/config/original/missions'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { missionFightingSpiritOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { isMissionCpuMoundAce, missionCpuMoundPitcherAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { withPitcherFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { missionOpponentOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'

/** 미션 상대. 원본 레코드의 마선수 순번이 있으면 그 마선수다 (타자 미션이면 마투수). */
export function missionOpponent(mission: OriginalMission): AcePlayer | null {
  return missionOpponentOf(mission.side === '타자' ? '투수' : '타자', mission.opponentAce)
}

/**
 * 미션 마선수의 **레벨 배율을 먹은** 능력치 네 칸 (마선수가 아니면 null).
 *
 * 마선수 레코드는 실효 능력치 0xb6414 첫 단계에서 `v · 0xd88aa[레벨] / 100` 을 먹는다
 * (b6438~b646a — 모드·플래그·칸을 가리지 않는다). 레벨 = `mgr[0x13a + 순번(+5 타자)]`.
 * 그 뒤 장비·스킬(플래그 1) → 0xb570c 의 0..999 자르기 순서다.
 */
export function missionOpponentAbility(mission: OriginalMission, aceLevels?: Readonly<Record<number, number>>): BatterAbility | null {
  const opponent = missionOpponent(mission)
  if (opponent === null) return null
  const level = aceLevelOf(aceLevels, aceLevelSlotOf(opponent.role, mission.opponentAce))
  // 0xb6415(rec, k, 1) — 레벨 배율 뒤 장착 스킬 단계까지(발렌타인 냉정 22, `aceRecordAbilityAtLevel`)
  return aceRecordAbilityAtLevel(opponent, level)
}

/**
 * 타자 미션 상대 투수 능력치. 마투수면 레벨 배율(0xb6414)을 먼저 곱한 네 칸을 투구 엔진 눈금으로 줄인다
 * — 마타자와 같은 0xb6414 라 투수 칸(제구·구속·변화·체력)도 똑같이 먹는다.
 */
export function missionPitcherAbility(
  mission: OriginalMission,
  aceLevels?: Readonly<Record<number, number>>,
  /** 마투수의 체력% `0xaebb0` (세션 `opponentStaminaPercent`). 안 넘기면 지치지 않은 것으로 본다 */
  staminaPercent?: number,
): PitcherAbility {
  const opponent = missionOpponent(mission)
  if (opponent === null) return DEFAULT_PITCHER_ABILITY
  // 레벨 배율만 먹인 값을 넘긴다 — 장착 스킬 단계(냉정 22)는 `pitcherAbilityOf` 가 `gameAbility` 에 먹인다(두 번 먹이지 않는다)
  const level = aceLevelOf(aceLevels, aceLevelSlotOf(opponent.role, mission.opponentAce))
  return pitcherAbilityOf({ ...opponent, ability: aceAbilityAtLevel(opponent.ability, level) }, undefined, staminaPercent)
}

/**
 * **지금 마운드의 상대 마투수** — 타자 미션의 마투수는 CPU 투수 교체(0xf 진입 0x3d954 → 0xac428)로 내려갈 수 있다
 * (`missionCpuTeam` — 0x66864 가 막는 것은 레오니 · 발렌타인 미션뿐). 내려가면 마선수가 아니다.
 */
export function missionMoundOpponent(run: MissionRun): AcePlayer | null {
  return isMissionCpuMoundAce(run.cpu) ? missionOpponent(run.mission) : null
}

/**
 * **지금 마운드 투수의 능력치** — 마투수가 서 있으면 `missionPitcherAbility`(셋째 인자 = 마투수 체력%), 아니면 마운드에 선
 * 마스터 팀 줄의 0xb570c 재료(`missionCpuMoundPitcherAbilityOf` — 장비·스킬 보정 · 레퍼토리 · 그 줄의 체력%).
 * 사람 타석은 수비 팀 지금 투수 0xae83c 가 던진다 — 마투수가 아닌 미션(선발 칸 = 레코드 +6 아래 4비트)도, 마투수가 교체로
 * 내려간 뒤(0xac428)도 그 줄이다. CPU 팀이 없을 때만(웹에 그런 미션은 없다) 예전 기본값.
 */
export function missionMoundPitcherAbility(run: MissionRun, aceLevels?: Readonly<Record<number, number>>, staminaPercent?: number): PitcherAbility {
  // 0xb570c 스킬 14 갈래 — 마운드 레코드 +0x14 비트 14 ∧ 지금 판의 경기 상태(CPU 팀 레코드 +0) (`withPitcherFightingSpirit`)
  const situation = missionFightingSpiritOf(run, missionTeamIdsOf(run).cpu)
  if (isMissionCpuMoundAce(run.cpu)) {
    return withPitcherFightingSpirit(missionPitcherAbility(run.mission, aceLevels, staminaPercent), situation)
  }
  return withPitcherFightingSpirit(missionCpuMoundPitcherAbilityOf(run.cpu) ?? DEFAULT_PITCHER_ABILITY, situation)
}
