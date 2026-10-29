import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { controlTierOf } from '@/entities/pitching/model/controlTier'
import { cpuPitchStatsOf } from '@/entities/pitching/model/pitcherGameStats'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch/types'

/** 마구의 제구 등급 — 0x4dbac 가 구질 22 면 굴림 없이 돌려주는 값 (4dbbc) */
const MAGIC_PITCH_CONTROL_TIER = 5

/** 실투 판정 0x33cbc 가 보는 투수 스킬 비트 — 33d7a 16 안정감 · 33daa 17 새가슴 · 33dce 22 냉정 (`mistakePitch` 머리말) */
const STEADY_SKILL_BIT = 16
const TIMID_SKILL_BIT = 17
const COOL_SKILL_BIT = 22
const hasSkillBit = (bits: number | undefined, bit: number) => (((bits ?? 0) >>> bit) & 1) === 1

/** 놓을 때의 체력 · 경기용 능력치 */
export interface ReleaseStats {
  /** 깎은 뒤 체력% — 깎는 셈이 없으면 투수 칸 그대로 */
  readonly staminaPercent: number | undefined
  readonly gameStats: ReturnType<typeof cpuPitchStatsOf>
  readonly stats: { readonly control: number; readonly velocity: number; readonly breaking: number }
}

/**
 * 소모 0xa5e14 — 구질이 정해진 뒤 상태 0x11 진입 0x3de10(0x3dec6)에서 깎는다. 놓기 0x4dc78 의 0x4dbac · 0x34968 은 그 **뒤**
 * 체력을 본다 (`staminaPercentAfterPitch`). 난수는 쓰지 않는다.
 * 경기용 능력치 0xb570c(…, 체력% 0xaebb0) — 피로 0xb58e6 를 먹인 제구·구속·변화 (`pitcherGameStats`)
 */
export function releaseStatsOf(pitcher: PitcherAbility, typeNumber: number): ReleaseStats {
  const staminaPercent = pitcher.staminaPercentAfterPitch?.(typeNumber) ?? pitcher.staminaPercent
  const gameStats = cpuPitchStatsOf(staminaPercent === undefined ? pitcher : { ...pitcher, staminaPercent })
  const stats = { control: gameStats.control, velocity: gameStats.velocity, breaking: gameStats.breaking }
  return { staminaPercent, gameStats, stats }
}

/**
 * 0x4dbac: 구질(scene+0xfc8) == 22(마구)면 굴림 없이 5 를 돌려준다 (4dbb8 cmp #0x16 → 4dbbc movs r0,#5).
 * 마구가 아니면 0xb74bc(전역, 피로 먹인 제구, 체력%) 제구 등급을 굴린다 — 체력% 0 이면 지친 갈래.
 * 그 값이 scene+0x17c0 에 앉아 제구 오차(0xcfd60 행 5)에도 쓰인다
 */
export function rollControlTier(isMagic: boolean, release: ReleaseStats, random: RandomPort): number {
  if (isMagic) return MAGIC_PITCH_CONTROL_TIER
  return controlTierOf(release.stats.control, release.gameStats.isNotExhausted, random)
}

/** 실투 판정 0x33cbc 의 재료 중 놓기마다 바뀌는 것 */
export interface MistakeRollInput {
  readonly isMagic: boolean
  readonly controlTier: number
  readonly release: ReleaseStats
  readonly pitcher: PitcherAbility
  readonly situation: PitchSituation
  readonly batterIntimidates: boolean
}

/**
 * 실투 판정 0x33cbc — 0x4dc78 이 궤적 준비 0x9e669(4de86) **뒤** 4dea0 에서 부른다. 사람이 칠 때도
 * CPU 투수의 공마다 돈다. 마구가 아니면 rand(0,100) 한 번 (마구면 굴림 없음).
 *  t = scene+0x17c0 = 0x4dbac 가 돌려준 제구 등급 0xb74bc 값 (4dcbe) = `controlTier`
 *  c = 0xb570d(ctx, 1, 투수, 1, 90, 1) — 경기용 칸 1 **구속**, 체력 인자 90 이라 피로가 없다 (`mistakeVelocity`)
 */
export function rollMistakePitch(input: MistakeRollInput, random: RandomPort): boolean {
  const { pitcher, situation } = input
  return isMistakePitch(
    {
      isMagicPitch: input.isMagic,
      grade: input.controlTier,
      effectiveVelocity: input.release.gameStats.mistakeVelocity,
      runnerCount: situation.runnerCount,
      hasSecondBaseRunner: situation.hasSecondBaseRunner === true,
      batterIntimidates: input.batterIntimidates,
      // 투수 레코드 +0x14 의 비트 16 안정감 · 17 새가슴 · 22 냉정 (0xb62b4) — 마투수도 제 행(`pitcherAbilityOf`). 안 실으면 0
      pitcherIsSteady: hasSkillBit(pitcher.skillBits, STEADY_SKILL_BIT),
      pitcherIsTimid: hasSkillBit(pitcher.skillBits, TIMID_SKILL_BIT),
      pitcherIsCool: hasSkillBit(pitcher.skillBits, COOL_SKILL_BIT),
    },
    random,
  )
}
