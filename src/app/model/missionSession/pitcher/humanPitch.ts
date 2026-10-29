import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionFightingSpiritOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import { missionCpuBatterOf } from '@/entities/mission/model/missionCpuTeam'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { consumeStamina, pitchStaminaCostOf, staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { withFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberOfPitch } from '@/entities/pitcher-career/model/magicPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { buildHumanPitch, fatiguedStatsOf, mistakeHumanPitchOf, pitchGradeOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { ModePitcher } from '@/app/model/modePitcher'
import {
  FIGHTING_SPIRIT_PITCHER_SKILL_ID,
  INTIMIDATE_SKILL_ID,
  MISSION_STAGE_SIDE,
  MISSION_TEAM_MORALE,
} from '@/app/model/missionSession/constants/missionConstants'
import { missionCpuBatterSkillIdsOf } from '@/app/model/missionSession/lineup/cpuBatter'

/** 사람 공 하나를 만드는 재료 — 고른 구질 · 조준 · 게이지와 이 공 앞의 투수 칸 */
export interface HumanPitchInput {
  readonly run: PitcherRun
  readonly pitcher: ModePitcher
  readonly typeNumber: number
  /** 메뉴의 마구 칸(`isModeMagicPitchType`)을 골랐나 — 남은 마구를 줄인다 */
  readonly isMagic: boolean
  readonly aim: WorldPoint
  readonly gaugeCell: number
  readonly gaugeSettingOn: boolean
  readonly staminaBefore: number
  readonly magicRemaining: number
  readonly ballMagicNumber: number
}

/** 놓은 사람 공 — 공 · 등급 · 깎은 뒤 체력 · 마구 칸 · 피로를 먹인 능력치 */
export interface HumanPitch {
  readonly pitch: Pitch
  readonly grade: number
  readonly pitcherStamina: number
  readonly pitcherStaminaPercent: number
  readonly fatigued: ReturnType<typeof fatiguedStatsOf>
  readonly magicRemainingAfter: number
  readonly nextBallMagicNumber: number
  readonly cpuBatterIntimidates: boolean
  readonly isMistake: boolean
}

/**
 * 스태미나 소모 0xa5e14 — 0x11 진입 0x3de10 의 0x3dec6(모드 갈래 없음)이라 놓기 0x4dc78 의 등급 0x4dbac · 피로 0x34968 과
 * CPU 타자 스윙 0xab214 가 **깎은 뒤** 체력을 본다. 용량 0x66e44 의 사기는 모드 5 라 100(`MISSION_TEAM_MORALE`), 첫 투수 +200 은
 * 선다 — 0xb8820 이 투수를 넣으며 team+0x26 · +0x33 을 함께 +1 해 `+0x26 − +0x33 == 1` 그대로다(b884a~b885a)
 */
function staminaAfterThrowOf({ pitcher, typeNumber, staminaBefore }: HumanPitchInput, cpuBatterIntimidates: boolean): number {
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: typeNumber,
    batterIntimidates: cpuBatterIntimidates,
    pitcherIsCoward: pitcher.isCoward,
    pitcherEndures: pitcher.endures,
  })
  return consumeStamina(staminaBefore, cost, staminaCapacityOf(pitcher.staminaAbility, MISSION_TEAM_MORALE, true))
}

/** 실투 판정 0xb570d(ctx, 1, 투수, 1, 90, 1) 의 칸 1 구속 — 스킬 14 갈래가 서면 자르기 앞 값에 v/10 을 얹고 자른다 */
const mistakeVelocityOf = (pitcher: ModePitcher, fightingSpirit: boolean) =>
  fightingSpirit ? Math.min(999, Math.max(0, withFightingSpirit(pitcher.ability.velocity))) : pitcher.stats.velocity

/**
 * 원작 투구 조작의 사람 공 — 공은 나리 투수편과 **같은 진행기 부품**(`buildHumanPitch`)으로 만든다. 굴림 차례: 등급 0x4dbac →
 * 흩어짐 0x4dc78 → 실투 0x33cbc.
 * 공격 팀 지금 타자의 압도 22 — 0xa5e14(×2) · 실투 0x33cbc(+5)가 `0xb62b4(타자, 22)` 로 레코드 +0x14 를 본다(모드 갈래 없음).
 * 마스터 줄은 Xls 행 사본, 마타자는 XlsACE_BAT 행 그대로(킹타이거 22 — `missionCpuBatterSkillIdsOf`)
 */
export function rollHumanPitch(input: HumanPitchInput, random: RandomPort): HumanPitch {
  const { run, pitcher, typeNumber, aim, gaugeCell, gaugeSettingOn } = input
  const cpuBatterIntimidates = missionCpuBatterSkillIdsOf(run, missionCpuBatterOf(run.cpu)).includes(INTIMIDATE_SKILL_ID)
  const pitcherStamina = staminaAfterThrowOf(input, cpuBatterIntimidates)
  const pitcherStaminaPercent = staminaPercentOf(pitcherStamina)
  // 0xb570c(모드 5) — 0xb6414 에 곧장 피로 0xb58e6 → 스킬 14 투지(장착 비트 14 ∧ 지금 판, 사람 칸 팀 레코드 +0) → 0..999
  // (`modePitcher` 머리말 · A-23)
  const fightingSpirit = pitcher.skillIds.includes(FIGHTING_SPIRIT_PITCHER_SKILL_ID) && missionFightingSpiritOf(run, missionTeamIdsOf(run).human)
  const fatigued = fatiguedStatsOf(pitcher.ability, pitcherStamina, fightingSpirit)
  // 게이지를 쓰면 칸에서 t = max(g−4, 1) 을, 안 쓰면 제구·체력 확률표 0xd896c 로 뽑는다 (0x4dbac)
  const grade = pitchGradeOf(
    { gaugeSettingOn, typeNumber, gaugeCell, effectiveControl: fatigued.control, staminaPercent: pitcherStaminaPercent },
    random,
  )
  const shape = { typeNumber, grade, stats: fatigued, repertoire: pitcher.repertoire, side: MISSION_STAGE_SIDE }
  const builtPitch = buildHumanPitch({ ...shape, aim, gaugeCell }, random)
  // 코스 확정 0x50e9c 가 남은 마구를 먼저 줄이고(`0xae9c4(팀, 남은−1)`), 상태 0x11 진입 0x3de10 이 그 **뒤**에
  // `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수 +0x18 — 마지막 한 개(1 → 0)는 안 싣는다. 되돌리는 줄이 없다 (H2 3-4).
  // CPU 타석 판정의 보정 구조체 0x34d6c 투수 쪽이 이 칸을 본다 — 미션 투수는 비트7 이라 n = 공+0x10 − 1 칸
  const magicRemainingAfter = input.isMagic ? input.magicRemaining - 1 : input.magicRemaining
  // 고침(B-01)이면 마구로 던진 이 공에만 싣는다 — `ballMagicNumberOfPitch`
  const nextBallMagicNumber = ballMagicNumberOfPitch({
    previous: input.ballMagicNumber,
    pitchTypeNumber: typeNumber,
    pitcherMagicNumber: pitcher.repertoire.magicNumber,
    remainingBefore: input.magicRemaining,
    remainingAfter: magicRemainingAfter,
  })
  const aimedPitch = { ...builtPitch, magicNumber: nextBallMagicNumber, pitcherMagicNumber: pitcher.repertoire.magicNumber }
  // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
  // 미션도 같은 투구 길이다(위 주석). 마구가 아니면 rand(0,100) 을 늘 한 번 굴린다.
  const isMistake = isMistakePitch(
    {
      isMagicPitch: typeNumber === MAGIC_PITCH_TYPE_NUMBER,
      grade,
      // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속. 모드 5 는 0xb6414 를 0..999 로 자른 값 (`modePitcherOf`).
      effectiveVelocity: mistakeVelocityOf(pitcher, fightingSpirit),
      runnerCount: runnerCountOf(run.bases),
      hasSecondBaseRunner: run.bases.second,
      // 지금 CPU 타자의 압도 22 (+5) — 위 소모와 같은 값
      batterIntimidates: cpuBatterIntimidates,
      // 미션 투수의 장착 비트 0xb62b4 — 32 안정감 · 33 새가슴 · 38 냉정 (투수 비트 16·17·22)
      pitcherIsSteady: pitcher.isSteady,
      pitcherIsTimid: pitcher.isTimid,
      pitcherIsCool: pitcher.isCool,
    },
    random,
  )
  // 실투면 0x4dec0~0x4df5e 가 곡선 0x9e3c9 앞에서 공을 존 한가운데 · N 18/20 으로 다시 놓는다 (굴림 없음)
  const pitch = isMistake ? mistakeHumanPitchOf(aimedPitch, shape) : aimedPitch
  return { pitch, grade, pitcherStamina, pitcherStaminaPercent, fatigued, magicRemainingAfter, nextBallMagicNumber, cpuBatterIntimidates, isMistake }
}
