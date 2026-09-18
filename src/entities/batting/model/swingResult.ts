import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { applySwingSkills } from '@/entities/batting/model/swingSkills'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'

/**
 * 스윙 결과 (binary.mod 0xab214 — 디컴파일 전문 대조). 정수 나눗셈은 모두 0쪽으로 자른다.
 *   contact  맞힐 확률(만분율) — 넘지 못하면 헛스윙
 *   solid(B) 잘 맞을 확률 — 넘으면 15·18·24, 못 넘으면 9·0·3
 *   homeRun(C) 홈런성(24) 확률
 * 수치는 함수 리터럴이 아니라 `base/work/jar/data/d_level.dat` 에 있고, 읽기 실패 시 쓰는
 * 하드코딩 폴백(0xb6f28)과 값이 완전히 같다. 아래 상수는 그 표에서 가져왔다.
 * 능력치 이름(히트·파워 / 제구·구속)은 StrMODE 순서로 붙였다.
 *
 * **생략**: 존 보정 네 쌍(batPower·batExtra·pitPower·pitExtra 와 pctA~D) — 원본은 투구 존
 * 구조체 12바이트를 그대로 받는데 웹판에는 그 구조체가 아직 없다.
 * 팀 플래그로 켜지는 ±10(원본 모드 3·4 가 아닐 때)·+100(모드 6) 보정도 뺐다 — 어떤 웹 모드가
 * 원본 모드 번호에 해당하는지 확정하지 못했다.
 */
export type SwingMode = '일반' | '나만의리그' | '미션'

export interface SwingResultInput {
  /** 공 도착점 − 기준점 + 타자 좌우 이동 (원본 픽셀, ±40 으로 자름) */
  readonly horizontalError: number
  readonly verticalError: number
  /** 0~100 (timingOf) */
  readonly timing: number
  /** 0 스윙 · 1~3 번트 종류 */
  readonly buntKind: number
  /** 제구 등급 (controlTierOf). 음수면 배율 100 */
  readonly controlTier: number
  readonly batter: { readonly hit: number; readonly power: number }
  readonly pitcher: { readonly control: number; readonly velocity: number }
  readonly mode: SwingMode
  /** 타자가 마선수인가 (원본 isAce = 선수 레코드 [10] 의 부호 비트, 0xb6388) */
  readonly isBatterAce?: boolean
  readonly isPitcherAce?: boolean
  /** 마선수 보너스를 깎는 팀 레벨 — 원본은 팀 데이터 +0xb3 */
  readonly teamLevel?: number
  readonly isPitcherExhausted: boolean
  readonly batterSkillIds: readonly number[]
  readonly pitcherSkillIds: readonly number[]
  readonly situation: SwingSituation
}

export type SwingResult =
  | { readonly kind: '헛스윙' }
  /** code 는 방향을 붙이기 전의 결과 코드. isSolid 는 원본 out[7] */
  | { readonly kind: '타구'; readonly code: number; readonly isSolid: boolean }

export interface SwingFactors {
  readonly contact: number
  readonly solid: number
  readonly homeRun: number
}

const ERROR_LIMIT = 40
/** 코스 오차 구간 → [A, B, C] 시작값 */
const ERROR_BANDS: readonly (readonly [number, number, number, number])[] = [
  [22, 0, -1000, -2000],
  [19, 3000, -500, -1000],
  [15, 6000, -300, -400],
  [12, 8500, -125, -100],
  [9, 9000, -50, -50],
  [3, 9500, 0, 0],
]
const CENTER_FACTORS = [10_000, 500, 350] as const
/** 제구 등급 → 투수 능력 배율 (d_level.dat 0x1e0) */
const TIER_MULTIPLIERS = BALANCE.swing.pitchGradeMultipliers
const NEUTRAL_MULTIPLIER = 100
/** 마선수 보너스 — 타자 0x1d8·0x1da, 투수 0x1dc·0x1de. 팀 레벨만큼 깎고 0 에서 멈춘다 */
const ACE_BONUS = {
  batter: { base: BALANCE.swing.aceBonus.batterBase, perLevel: BALANCE.swing.aceBonus.batterPerLevel },
  pitcher: { base: BALANCE.swing.aceBonus.pitcherBase, perLevel: BALANCE.swing.aceBonus.pitcherPerLevel },
}
/** 미션(원본 모드 5)에서 마선수 투수에게만 붙는 고정 보너스 */
const MISSION_ACE_PITCHER_BONUS = BALANCE.swing.missionAcePitcherBonus
/**
 * 원본이 B·C 에 각각 더하는 param_15 × 500. 두 호출자 모두 param_15 로 1 만 넘긴다 —
 * 1 이 아닌 값이 오는 경로는 미해독이라 상수로 뒀다.
 * (예전 이식본은 이 500 을 "직전과 같은 구질" 보너스로 읽었는데, 0xab214 안에는 그런 조건이 없다.)
 */
const SWING_STRENGTH_BONUS = BALANCE.swing.swingStrengthBonus
const EXHAUSTED_BONUS = BALANCE.swing.exhaustedBonus
const TIMING_PIVOT = BALANCE.swing.powerPivot
const SOLID_CAP = BALANCE.swing.solidCap
const HOME_RUN_CAP = BALANCE.swing.homeRunCap
const BUNT_LIMIT = { horizontal: 20, vertical: 18 }
const BUNT_SUCCESS_PERCENT = [0, 75, 50, 50]
const BUNT_SKILL = 11
const BUNT_SKILL_PENALTY = 10
const BUNT_SUCCESS_CODES = [0, 6, 7, 8]
const BUNT_FAIL_CODES = [0, 12, 13, 14]

const trunc = Math.trunc
const clampError = (value: number) => Math.max(-ERROR_LIMIT, Math.min(ERROR_LIMIT, value))

function startingFactors(horizontal: number, vertical: number): [number, number, number] {
  const band = ERROR_BANDS.find(([limit]) => horizontal > limit || vertical > limit)
  if (band === undefined) return [...CENTER_FACTORS]
  return [band[1], band[2], band[3]]
}

/** 난수 없이 정해지는 contact · B · C */
export function swingFactorsOf(input: SwingResultInput): SwingFactors {
  const horizontal = Math.abs(clampError(input.horizontalError))
  const vertical = Math.abs(clampError(input.verticalError))
  const [baseContact, baseSolid, baseHomeRun] = startingFactors(horizontal, vertical)

  // 마선수 보너스와 마선수 계수는 육성(원본 모드 3·4 = 나만의리그)에서만 켜진다.
  const isCareerMode = input.mode === '나만의리그'
  const teamLevel = input.teamLevel ?? 0
  const aceBonusOf = ({ base, perLevel }: { base: number; perLevel: number }) => Math.max(0, base - perLevel * teamLevel)
  const batterBonus = isCareerMode && input.isBatterAce === true ? aceBonusOf(ACE_BONUS.batter) : 0
  const pitcherBonus = isCareerMode && input.isPitcherAce === true
    ? aceBonusOf(ACE_BONUS.pitcher)
    : input.mode === '미션' && input.isPitcherAce === true
      ? MISSION_ACE_PITCHER_BONUS
      : 0
  // 마선수 계수는 육성 모드에서 타자·투수 중 한쪽이라도 마선수일 때만 쓴다
  const isAceFormula = isCareerMode && (input.isBatterAce === true || input.isPitcherAce === true)

  const multiplier = input.controlTier < 0 ? NEUTRAL_MULTIPLIER : TIER_MULTIPLIERS[Math.min(input.controlTier, 5)]
  const hitEdge = input.batter.hit + batterBonus - trunc((multiplier * (input.pitcher.velocity + pitcherBonus)) / 100)
  const powerEdge = input.batter.power + batterBonus - trunc((multiplier * (input.pitcher.control + pitcherBonus)) / 100)
  const scaledContact = trunc((baseContact * (300 - multiplier)) / 200)

  const contact = input.buntKind > 0
    ? trunc((scaledContact * 12) / 10)
    : trunc(
        ((trunc((hitEdge * (isAceFormula ? BALANCE.swing.aceFormula : BALANCE.swing.normalFormula).contactFactor / 1000) + 1200) *
          trunc((scaledContact * input.timing) / 10_000)) /
          10),
      )

  const formula = isAceFormula ? BALANCE.swing.aceFormula : BALANCE.swing.normalFormula
  const { hitWeight, extraWeight } = BALANCE.swing
  const solidWeight =
    trunc(
      trunc((hitEdge * formula.hitCoefficient * hitWeight + powerEdge * formula.extraCoefficient * extraWeight) / 100) /
        (hitWeight + extraWeight),
    ) + formula.hitBase * 10
  const timingScale = (input.timing - TIMING_PIVOT) * 2 + 100
  // 원본은 B 를 먼저 배율까지 끝내고 나서 탈진 보너스를 더하고, C 는 그 보너스를 먼저 받은 뒤 배율을 먹는다
  const exhausted = input.isPitcherExhausted ? EXHAUSTED_BONUS : 0
  const solid = trunc(((baseSolid + solidWeight + SWING_STRENGTH_BONUS) * timingScale) / 100) + exhausted
  const homeRunWeight = formula.extraBase * 10 + trunc((powerEdge * formula.extraCoefficient) / 100)
  const homeRun = trunc(((baseHomeRun + exhausted + homeRunWeight + SWING_STRENGTH_BONUS) * timingScale) / 100)

  const skilled = applySwingSkills({ solid, homeRun }, input.batterSkillIds, input.pitcherSkillIds, input.situation)
  return { contact, solid: skilled.solid, homeRun: skilled.homeRun }
}

/** 원본 난수 순서: 번트용 rand(0,100) → contact → B → C → 15/18 경계 */
export function swingResultOf(input: SwingResultInput, random: RandomPort): SwingResult {
  const factors = swingFactorsOf(input)
  const buntRoll = randomIntegerBelow(random, 0, 100)

  if (input.buntKind > 0) {
    const horizontal = Math.abs(clampError(input.horizontalError))
    const vertical = Math.abs(clampError(input.verticalError))
    if (horizontal > BUNT_LIMIT.horizontal || vertical > BUNT_LIMIT.vertical) return { kind: '헛스윙' }
    const penalty = input.batterSkillIds.includes(BUNT_SKILL) ? BUNT_SKILL_PENALTY : 0
    const isSuccess = buntRoll < BUNT_SUCCESS_PERCENT[input.buntKind] - penalty
    const code = (isSuccess ? BUNT_SUCCESS_CODES : BUNT_FAIL_CODES)[input.buntKind]
    return { kind: '타구', code, isSolid: true }
  }

  if (randomIntegerBelow(random, 0, 10_000) >= factors.contact) return { kind: '헛스윙' }
  const solid = Math.min(factors.solid, SOLID_CAP)
  const homeRun = Math.min(factors.homeRun, HOME_RUN_CAP)
  if (randomIntegerBelow(random, 0, 10_000) < solid) {
    if (randomIntegerBelow(random, 0, 10_000) < homeRun) return { kind: '타구', code: 24, isSolid: true }
    const lineDriveLimit = trunc((homeRun * 120) / trunc((10_000 - homeRun) / 100))
    const code = randomIntegerBelow(random, 0, 10_000) >= lineDriveLimit ? 15 : 18
    return { kind: '타구', code, isSolid: true }
  }
  const roll = randomIntegerBelow(random, 0, 10_000) - BALANCE.swing.foulPercent * 100
  if (roll < 0) return { kind: '타구', code: 9, isSolid: true }
  return roll - BALANCE.swing.outPercent * 100 < 0
    ? { kind: '타구', code: 0, isSolid: false }
    : { kind: '타구', code: 3, isSolid: false }
}
