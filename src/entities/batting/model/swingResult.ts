import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { applySwingSkills } from '@/entities/batting/model/swingSkills'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import { NO_SWING_BOOST } from '@/entities/batting/model/swingBoost'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'

/**
 * 스윙 결과 (binary.mod 0xab214 — 디컴파일 전문 대조). 정수 나눗셈은 모두 0쪽으로 자른다.
 *   contact  맞힐 확률(만분율) — 넘지 못하면 헛스윙
 *   solid(B) 잘 맞을 확률 — 넘으면 15·18·24, 못 넘으면 9·0·3
 *   homeRun(C) 홈런성(24) 확률
 * 수치는 함수 리터럴이 아니라 `base/work/jar/data/d_level.dat` 에 있고, 읽기 실패 시 쓰는
 * 하드코딩 폴백(0xb6f28)과 값이 완전히 같다. 아래 상수는 그 표에서 가져왔다.
 * 능력치 이름(히트·파워 / 제구·구속)은 StrMODE 순서로 붙였다.
 *
 * 12바이트 스택 인자(예전 주석의 "존 보정 네 쌍·pctA~D")는 투구 존이 아니라 **필살타법·마구 보정
 * 구조체 0x34d6c** 다 — `boost` 로 받는다 (`swingBoost.ts`). 쓰이는 자리:
 * ```
 * ab4dc: hit 쪽   = eff(타자 히트) + out[0] + aB − 배율·(eff(투수 구속) + out[4] + aP)/100
 * ab502: power 쪽 = eff(타자 파워) + out[2] + aB − 배율·(eff(투수 제구) + out[6] + aP)/100
 * abd92: (스킬 보정 뒤) if out[0xa]: B += B·out[0xa]/100 ; if out[0xb]: C += C·out[0xb]/100
 * abdcc: if out[8]: B += …  ; if out[9]: C += …     ; 0x34d6c 가 늘 0 으로 채운다
 * ```
 * hit 쪽 값은 contact 식에도 들어간다 (0xab648 `K·hit/1000 + 1200`) — 구조체가 contact 를 안 바꾼다는
 * H2 2절의 말은 존 시작값(sp34) 이야기다.
 *
 * **팀 조작 보정** (0xab5c0~0xab5fc, 확정):
 * ```
 * if 모드(0x1552d10) ∉ {3,4}:  if state[0x31 + state[0xa]] == 0 (수비 팀을 사람이 조작):  hit 쪽·power 쪽 −10
 * if 모드 == 6:                if state[0x31 + state[9]]   == 0 (공격 팀을 사람이 조작):  hit 쪽·power 쪽 +100
 * ```
 * 0xb6c20(state, 팀) = s8 state[0x31 + 팀] (0 이면 사람 — J 노트), state[9] 공격 · state[0xa] 수비.
 * 존 시작값 배율(sp34) 뒤, contact 식 앞이라 contact 에도 들어간다. 0xab5fe 의 셋째 호출은 결과를 버린다.
 *
 * **홈런더비 갈래** (모드 7, sp44 = 1 — 0xab2c2). contact·B·C 를 **보정 없는 능력치**로 따로 센다 (확정):
 * ```
 * ab60e: if sp44: → ab69a                         ; 번트 contact(×12/10, ab610)도 건너뛴다
 * ab69a: contact = (eff(히트) + 1200) · (타이밍·sp34/10000) / 10      ; K 계수·hit 쪽 보정 없음
 * ab6d4: B += D[0x46]·10 + ((D[0x48]·eff(히트)·D[0x5a] + D[0x4c]·eff(파워)·D[0x5b])/100)/(D[0x5a]+D[0x5b])
 *        → ab820 (B 의 +500 ab812 를 건너뛴다)
 * ab854: C += D[0x4a]·10 + D[0x48]·eff(파워)/100   → ab90a (C 의 +500 ab8fc 를 건너뛴다)
 * abf18: 15/18 경계에서 18 이 나오면 rand(0,2) == 1 → 24, 아니면 18
 * ```
 * eff 는 hit 쪽·power 쪽과 같은 인자(0xb570d …, 1, 0x5a, 1)로 부른 타자 능력치 = `batter.hit`·`batter.power` 다 —
 * 보정 구조체 out[0]·out[2], 내 선수 보너스, 투수 능력, 팀 조작 보정이 모두 빠진다. 계수는 **마선수식(D[0x46..0x4e])** 이고
 * C 의 곱은 D[0x4c](extraCoefficient)가 아니라 **D[0x48](hitCoefficient)** 다 (ab876 `ldr r3,[sp,#0x7c]` — 원본 그대로).
 * 타이밍 배율·탈진 2000·스킬·out[0xa]/[0xb]·상한은 다른 모드와 같은 길을 탄다.
 */
/**
 * 판정이 보는 원본 모드(0x1552d10) 묶음 —
 * '나만의리그' = 모드 3·4 (투수편·타자편) · '미션' = 모드 6 (**타자** 미션) · '투수미션' = 모드 5 ·
 * '홈런더비' = 모드 7 (sp44) · '일반' = 그 밖.
 */
export type SwingMode = '일반' | '나만의리그' | '미션' | '투수미션' | '홈런더비'

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
  /**
   * 타자가 **육성·명전 선수**인가 = `0xb6389` (선수 레코드 `rec[0xa]` 비트7 — 등록 타자 0xa0 · 투수 0x80, C 노트).
   * ⚠️ 마선수는 비트6 이고 비트7 이 **꺼져 있다** (rec[0xa] = 0x40~0x44 · 0x60~0x64, R3·S6 바이트 확인) —
   * 예전 이름 `isBatterAce`·`isPitcherAce` 는 이 비트를 마선수로 잘못 읽은 것이었다.
   */
  readonly isBatterOwnPlayer?: boolean
  /** 투수가 육성·명전 선수인가 (0xb6389, 같은 비트) */
  readonly isPitcherOwnPlayer?: boolean
  /**
   * **나리 연차 idx** (0 = 1년차) — 내 선수 보너스 `D[0x1d8] − D[0x1da] × 연차` 를 깎는 값.
   * ```
   * ab3e2: rec = 0x1f8d4(전역 저장 [0x1400054], (s8)state[1])   ; 모드 4 → [저장+0xbc]+0x11c (타자편)
   *                                                              ; 모드 3 → [저장+0xb8]+0x11c (투수편), 그 밖 0
   * ab3f2: aB = D[0x1d8] − D[0x1da] × u8 rec[0xb3] (음수면 0)   ; 투수 aP 는 0xab494 에서 D[0x1dc] − D[0x1de] ×
   * ```
   * `+0x11c` 레코드는 시즌 레코드(`[저장+0xb4]+0x11c`, P4 0x1f55c)와 같은 꼴이고 `+0xb3` 은 **연차 idx** 다
   * (B·P3·P5 — 연말 0x1b768 이 1 씩 올린다). 웹 커리어의 `season` 은 1 부터라 `season − 1` 이다.
   * 안 넘기면 0 = 보너스 최대(타자·투수 400).
   */
  readonly careerYearIndex?: number
  /** 공격 팀을 사람이 조작하는가 (state[0x31 + state[9]] == 0) — 모드 6 의 +100. 안 넘기면 거짓 */
  readonly isOffenseHuman?: boolean
  /** 수비 팀을 사람이 조작하는가 (state[0x31 + state[0xa]] == 0) — 모드 3·4 밖의 −10. 안 넘기면 거짓 */
  readonly isDefenseHuman?: boolean
  /** 보정 구조체 0x34d6c (필살타법·마구). 안 넘기면 0 (보통 스윙에 마구가 실리지 않은 공) */
  readonly boost?: SwingBoost
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
/**
 * 내 선수(비트7) 보너스 — d_level.dat 0x1d8·0x1da(타자), 0x1dc·0x1de(투수) (객체 오프셋).
 * `base − perLevel × 연차 idx` 이고 0 에서 멈춘다 (`careerYearIndex` 주석 참고). 모드 3·4 에서만.
 */
const ACE_BONUS = {
  batter: { base: BALANCE.swing.aceBonus.batterBase, perLevel: BALANCE.swing.aceBonus.batterPerLevel },
  pitcher: { base: BALANCE.swing.aceBonus.pitcherBase, perLevel: BALANCE.swing.aceBonus.pitcherPerLevel },
}
/** 투수 미션(원본 모드 5)에서 비트7 투수에게 붙는 고정 보너스 (0xab42a~0xab442) */
const MISSION_ACE_PITCHER_BONUS = BALANCE.swing.missionAcePitcherBonus
/** 0xab5d2 `subs #0xa` — 모드 3·4 밖에서 수비 팀이 사람일 때 (코드 리터럴) */
const TEAM_HUMAN_DEFENSE_PENALTY = 10
/** 0xab5f6 `adds #0x64` — 모드 6(타자 미션)에서 공격 팀이 사람일 때 (코드 리터럴) */
const BATTER_MISSION_HUMAN_BONUS = 100
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

  // 내 선수 보너스와 그 계수는 나리(원본 모드 3·4)에서만 켜진다 (sp40, 0xab2ce~0xab2d8)
  const isCareerMode = input.mode === '나만의리그'
  const yearIndex = input.careerYearIndex ?? 0
  const ownBonusOf = ({ base, perLevel }: { base: number; perLevel: number }) =>
    Math.max(0, base - perLevel * yearIndex)
  const batterBonus = isCareerMode && input.isBatterOwnPlayer === true ? ownBonusOf(ACE_BONUS.batter) : 0
  const pitcherBonus = isCareerMode && input.isPitcherOwnPlayer === true
    ? ownBonusOf(ACE_BONUS.pitcher)
    : input.mode === '투수미션' && input.isPitcherOwnPlayer === true
      ? MISSION_ACE_PITCHER_BONUS
      : 0
  // 그 계수(K 1000 …)는 나리에서 타자·투수 중 한쪽이라도 비트7 일 때만 쓴다 (0xab628~0xab646)
  const isAceFormula = isCareerMode && (input.isBatterOwnPlayer === true || input.isPitcherOwnPlayer === true)
  // 팀 조작 보정 0xab5c0~0xab5fc — 모드 3·4 밖에서 수비가 사람이면 −10, 모드 6 에서 공격이 사람이면 +100
  const teamAdjust =
    (!isCareerMode && input.isDefenseHuman === true ? -TEAM_HUMAN_DEFENSE_PENALTY : 0) +
    (input.mode === '미션' && input.isOffenseHuman === true ? BATTER_MISSION_HUMAN_BONUS : 0)

  const boost = input.boost ?? NO_SWING_BOOST
  const multiplier = input.controlTier < 0 ? NEUTRAL_MULTIPLIER : TIER_MULTIPLIERS[Math.min(input.controlTier, 5)]
  // 0xab4dc~0xab5a2 — 구조체 out[0]·out[2] 는 타자 쪽, out[4]·out[6] 은 투수 쪽(배율 앞)에 더한다
  const hitEdge =
    input.batter.hit + boost.batterHit + batterBonus -
    trunc((multiplier * (input.pitcher.velocity + boost.pitcherVelocity + pitcherBonus)) / 100) +
    teamAdjust
  const powerEdge =
    input.batter.power + boost.batterPower + batterBonus -
    trunc((multiplier * (input.pitcher.control + boost.pitcherControl + pitcherBonus)) / 100) +
    teamAdjust
  const scaledContact = trunc((baseContact * (300 - multiplier)) / 200)
  const exhausted = input.isPitcherExhausted ? EXHAUSTED_BONUS : 0
  const timingScale = (input.timing - TIMING_PIVOT) * 2 + 100
  const { hitWeight, extraWeight } = BALANCE.swing

  if (input.mode === '홈런더비') {
    // 0xab69a~0xab744 · 0xab854~0xab888 — 머리말 "홈런더비 갈래"
    const ace = BALANCE.swing.aceFormula
    const { hit, power } = input.batter
    const derbyContact = trunc(((hit + 1200) * trunc((scaledContact * input.timing) / 10_000)) / 10)
    const derbySolidWeight =
      ace.hitBase * 10 +
      trunc(trunc((ace.hitCoefficient * hit * hitWeight + ace.extraCoefficient * power * extraWeight) / 100) /
        (hitWeight + extraWeight))
    const derbySolid = trunc(((baseSolid + derbySolidWeight) * timingScale) / 100) + exhausted
    const derbyHomeRunWeight = ace.extraBase * 10 + trunc((ace.hitCoefficient * power) / 100)
    const derbyHomeRun = trunc(((baseHomeRun + exhausted + derbyHomeRunWeight) * timingScale) / 100)
    return finishFactors(derbyContact, derbySolid, derbyHomeRun, input, boost)
  }

  const contact = input.buntKind > 0
    ? trunc((scaledContact * 12) / 10)
    : trunc(
        ((trunc((hitEdge * (isAceFormula ? BALANCE.swing.aceFormula : BALANCE.swing.normalFormula).contactFactor / 1000) + 1200) *
          trunc((scaledContact * input.timing) / 10_000)) /
          10),
      )

  const formula = isAceFormula ? BALANCE.swing.aceFormula : BALANCE.swing.normalFormula
  const solidWeight =
    trunc(
      trunc((hitEdge * formula.hitCoefficient * hitWeight + powerEdge * formula.extraCoefficient * extraWeight) / 100) /
        (hitWeight + extraWeight),
    ) + formula.hitBase * 10
  // 원본은 B 를 먼저 배율까지 끝내고 나서 탈진 보너스를 더하고, C 는 그 보너스를 먼저 받은 뒤 배율을 먹는다
  const solid = trunc(((baseSolid + solidWeight + SWING_STRENGTH_BONUS) * timingScale) / 100) + exhausted
  const homeRunWeight = formula.extraBase * 10 + trunc((powerEdge * formula.extraCoefficient) / 100)
  const homeRun = trunc(((baseHomeRun + exhausted + homeRunWeight + SWING_STRENGTH_BONUS) * timingScale) / 100)
  return finishFactors(contact, solid, homeRun, input, boost)
}

/** 스킬(0xab91c~) → 보정 구조체 % (0xabd92~0xabe02) — 모든 모드가 같은 길로 모인다 */
function finishFactors(
  contact: number,
  solid: number,
  homeRun: number,
  input: SwingResultInput,
  boost: SwingBoost,
): SwingFactors {
  const skilled = applySwingSkills({ solid, homeRun }, input.batterSkillIds, input.pitcherSkillIds, input.situation)
  // 0xabd92~0xabe02 — 스킬 보정 뒤, 상한(0xabeba) 앞. 마구 % 도 부호가 양수라 타자 쪽을 올린다 (원본 그대로)
  const boostedSolid = skilled.solid + trunc((skilled.solid * boost.solidPercent) / 100)
  const boostedHomeRun = skilled.homeRun + trunc((skilled.homeRun * boost.homeRunPercent) / 100)
  return { contact, solid: boostedSolid, homeRun: boostedHomeRun }
}

/** 원본 난수 순서: 번트용 rand(0,100) → contact → B → C → 15/18 경계 (→ 홈런더비만 18 에서 rand(0,2)) */
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
    if (randomIntegerBelow(random, 0, 10_000) >= lineDriveLimit) return { kind: '타구', code: 15, isSolid: true }
    // 홈런더비는 18 자리에서 한 번 더 굴린다 — rand(0,2) == 1 이면 24 (0xabf18~0xabf2a)
    if (input.mode === '홈런더비' && randomIntegerBelow(random, 0, 2) === 1) return { kind: '타구', code: 24, isSolid: true }
    return { kind: '타구', code: 18, isSolid: true }
  }
  const roll = randomIntegerBelow(random, 0, 10_000) - BALANCE.swing.foulPercent * 100
  if (roll < 0) return { kind: '타구', code: 9, isSolid: true }
  return roll - BALANCE.swing.outPercent * 100 < 0
    ? { kind: '타구', code: 0, isSolid: false }
    : { kind: '타구', code: 3, isSolid: false }
}
