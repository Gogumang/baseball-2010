import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { isMissionCpuMoundAce, missionCpuAfterPitch, type MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { FRESH_HELD_CPU_MAGIC, cpuMagicStateOf } from '@/entities/pitching/model/magicPitchGame'
import { FULL_STAMINA, consumeStamina, pitchStaminaCostOf, staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { COWARD_SKILL_BIT, ENDURE_SKILL_BIT, INTIMIDATE_SKILL_ID, MISSION_TEAM_MORALE } from '@/app/model/missionSession/constants/missionConstants'
import { missionMoundPitcherAbility, missionOpponent, missionOpponentAbility } from '@/app/model/missionSession/opponent/missionOpponent'
import { missionBatterSkillIdsOf } from '@/app/model/missionSession/lineup/humanBatter'

/** 레코드 +0x14 의 비트 하나가 섰나 */
const hasSkillBit = (bits: number, bit: number) => ((bits >>> bit) & 1) === 1

/**
 * **타자 미션 마투수의 투구 하나** — 0xa5e14 (모드 갈래 없음, 0x3dec6). 마투수는 0xaae7c 가 저장된 마투수 레코드
 * (0x1f824)를 0xb521c 로 팀 칸 8 에 통째(0x30, +0x2c 포함 — 다섯 줄 모두 10000) 베끼고 0xb8c94 로 0번과 맞바꿔 세우므로
 * 경기마다 10000 에서 선다. 이미 마운드에 그 마투수가 있으면 다시 베끼지 않아 깎인 값이 이어진다.
 * CPU 투수 교체 0xac428 을 미션 객체(0x66864)가 막는 것은 **칸 3·7(레오니·발렌타인)뿐**이다 — 드래고나(칸 11)는
 * 안 막는다(`entities/mission/model/missionCpuTeam`). 용량의 체력은 `0xb6415(P, 3, 1)` = 레벨 배율 먹은 넷째 칸(레벨 배율 뒤 장착 스킬 단계 — 냉정 22 는 제구만이라 체력은 그대로).
 * 첫 투수 +200 (0xaeb08 의 `team+0x26 − team+0x33 == 1`) 은 선다 — 0xaae7c 의 마투수 갈래(0xb521c · 0xb8c94 · 0xaea84)는 팀 객체의
 * +0x26 · +0x33 을 안 고쳐 0xb891c 때의 8 − 7 = 1 그대로다. 마투수가 내려가면 세션이 이 소모를 멈추고, 마선수가 아닌 마운드
 * 투수의 소모는 CPU 팀이 마스터 줄 능력치로 든다(`missionCpuAfterPitch`).
 */
export function missionOpponentStaminaAfterPitch(
  stamina: number,
  mission: OriginalMission,
  pitchTypeNumber: number,
  batterSkillIds: readonly number[],
  aceLevels?: Readonly<Record<number, number>>,
): number {
  const ability = missionOpponent(mission) === null ? null : missionOpponentAbility(mission, aceLevels)
  if (ability === null) return stamina
  const opponentSkillBits = missionOpponent(mission)?.skillBits ?? 0
  const cost = pitchStaminaCostOf({
    pitchTypeNumber,
    batterIntimidates: batterSkillIds.includes(INTIMIDATE_SKILL_ID),
    // 0xb62b4(마투수, 18) · (마투수, 10) — 레코드 +0x14 = XlsACE_PIT_DATA 행 바이트 0x14~0x17 (다섯 줄 모두 두 비트가 0)
    pitcherIsCoward: hasSkillBit(opponentSkillBits, COWARD_SKILL_BIT),
    pitcherEndures: hasSkillBit(opponentSkillBits, ENDURE_SKILL_BIT),
  })
  return consumeStamina(stamina, cost, staminaCapacityOf(ability.run, MISSION_TEAM_MORALE, true))
}

/** 타자 미션 마운드 마투수의 레코드 +0x2c — 마투수가 아니거나 판이 없으면 10000 (`missionOpponentStaminaAfterPitch`) */
export function missionAceMoundStaminaOf(run: Pick<MissionRun, 'cpu'> | null): number {
  if (run === null || !isMissionCpuMoundAce(run.cpu)) return FULL_STAMINA
  return run.cpu.pitching?.mound.stamina ?? FULL_STAMINA
}

/**
 * **타자 미션 마운드 투수가 공 하나를 던진 뒤의 CPU 팀** — 0xa5e14 (`missionCpuAfterPitch`). 마투수면 그 레코드 +0x2c 를
 * 세션 셈(`missionOpponentStaminaAfterPitch`)으로 깎아 마운드에 든다 — 내려가면 마스터 줄 소모를 CPU 팀이 든다.
 * 판정된 공을 먹일 때(`handleMissionPitch`)와 타석 화면 투구 AI 의 깎은 뒤 체력%(`opponentStaminaPercentAfterPitch`)가 같은 셈이다.
 */
export function missionCpuAfterThrow(
  run: MissionRun,
  pitchTypeNumber: number,
  batterSkillIds: readonly number[],
  aceLevels?: Readonly<Record<number, number>>,
): MissionCpuTeam {
  const skillIds = missionBatterSkillIdsOf(run, batterSkillIds)
  const aceStamina = isMissionCpuMoundAce(run.cpu)
    ? missionOpponentStaminaAfterPitch(missionAceMoundStaminaOf(run), run.mission, pitchTypeNumber, skillIds, aceLevels)
    : undefined
  return missionCpuAfterPitch(run.cpu, {
    pitchTypeNumber,
    batterIntimidates: skillIds.includes(INTIMIDATE_SKILL_ID),
    ...(aceStamina === undefined ? {} : { aceStamina }),
    // 소모 0x345fc · 싣기 0x3de10 — CPU 팀 +0x28 · 공 +0x10 을 미션 한 판 동안 이어 든다
    magic: { pitcher: missionMoundPitcherAbility(run, aceLevels), aceLevels },
  })
}

/**
 * **타자 미션 타석 화면에 넘길 CPU 마구 두 칸**(`BattingStage.cpuMagic`) — CPU 팀 +0x28 이 아직 안 찼으면(−1) 지금 마운드 투수로 채운 값
 * (타석 교대 0xaebe4 aeea8). 투수진이 없으면(투수 미션) undefined
 */
export function missionCpuMagicStateOf(
  run: MissionRun,
  aceLevels?: Readonly<Record<number, number>>,
): { readonly remaining: number; readonly ballMagicNumber: number } | undefined {
  const pitching = run.cpu.pitching
  if (pitching === null) return undefined
  return cpuMagicStateOf(pitching.magic ?? FRESH_HELD_CPU_MAGIC, missionMoundPitcherAbility(run, aceLevels), aceLevels)
}
