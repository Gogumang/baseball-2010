import { balanceNumber } from '@/shared/config/balance'
import { applySwingSkills } from '@/entities/batting/model/swingSkills'
import { NO_SWING_BOOST, type SwingBoost } from '@/entities/batting/model/swingBoost'
import { swingEdgesOf, usesAceFormula } from '@/entities/batting/model/swingResult/edges'
import { clampError, pitchGradeMultiplierOf, startingFactors, swingFormulaOf, trunc } from '@/entities/batting/model/swingResult/formula'
import type { SwingFactors, SwingResultInput } from '@/entities/batting/model/swingResult/types'

/** 0xab648 의 존 시작값 배율 — (300 − 배율) / 200 */
const CONTACT_SCALE_TOP = 300
const CONTACT_SCALE_DIVISOR = 200
/** 번트 contact — ×12/10 (ab610) */
const BUNT_CONTACT_NUMERATOR = 12
/** 계수 기준값 D[..] 는 10 배로 더한다 */
const BASE_SCALE = 10

/** 두 갈래(보통 · 홈런더비)가 함께 쓰는 값 */
interface FactorBase {
  readonly baseSolid: number
  readonly baseHomeRun: number
  /** 존 시작 contact × (300 − 배율) / 200 */
  readonly scaledContact: number
  /** 탈진 2000 */
  readonly exhausted: number
  /** 타이밍 배율 (타이밍 − 기준) × 2 + 100 */
  readonly timingScale: number
}

/** 존 시작값 · 타이밍 배율 · 탈진 — 난수 없음 */
function factorBaseOf(input: SwingResultInput, multiplier: number): FactorBase {
  const horizontal = Math.abs(clampError(input.horizontalError))
  const vertical = Math.abs(clampError(input.verticalError))
  const [baseContact, baseSolid, baseHomeRun] = startingFactors(horizontal, vertical)
  return {
    baseSolid,
    baseHomeRun,
    scaledContact: trunc((baseContact * (CONTACT_SCALE_TOP - multiplier)) / CONTACT_SCALE_DIVISOR),
    exhausted: input.isPitcherExhausted ? balanceNumber('swing.exhaustedBonus') : 0,
    timingScale: (input.timing - balanceNumber('swing.timingPivot')) * 2 + 100,
  }
}

/** contact 의 타이밍 몫 — trunc(scaledContact · 타이밍 / 10000) */
const timedContactOf = (base: FactorBase, input: SwingResultInput) => trunc((base.scaledContact * input.timing) / 10_000)

/** 0xab69a~0xab744 · 0xab854~0xab888 — 머리말 "홈런더비 갈래" (보정 없는 능력치 · 마선수식 · +500 없음) */
function derbyFactorsOf(input: SwingResultInput, base: FactorBase): SwingFactors {
  const ace = swingFormulaOf(true)
  const { hit, power } = input.batter
  const hitWeight = balanceNumber('swing.hitWeight')
  const extraWeight = balanceNumber('swing.extraWeight')
  const contact = trunc(((hit + balanceNumber('swing.contactBase')) * timedContactOf(base, input)) / 10)
  const solidWeight =
    ace.hitBase * BASE_SCALE +
    trunc(trunc((ace.hitCoefficient * hit * hitWeight + ace.extraCoefficient * power * extraWeight) / 100) / (hitWeight + extraWeight))
  const solid = trunc(((base.baseSolid + solidWeight) * base.timingScale) / 100) + base.exhausted
  // C 의 곱은 D[0x4c](extraCoefficient)가 아니라 D[0x48](hitCoefficient)다 (ab876 — 원본 그대로)
  const homeRunWeight = ace.extraBase * BASE_SCALE + trunc((ace.hitCoefficient * power) / 100)
  const homeRun = trunc(((base.baseHomeRun + base.exhausted + homeRunWeight) * base.timingScale) / 100)
  return { contact, solid, homeRun }
}

/** 보통 갈래 — hit 쪽 · power 쪽(0xab4dc~0xab5a2)과 마선수식 · 일반식 계수, B · C 에 param_15 × 500 */
function regularFactorsOf(input: SwingResultInput, base: FactorBase, multiplier: number, boost: SwingBoost): SwingFactors {
  const { hitEdge, powerEdge } = swingEdgesOf(input, multiplier, boost)
  const formula = swingFormulaOf(usesAceFormula(input))
  const hitWeight = balanceNumber('swing.hitWeight')
  const extraWeight = balanceNumber('swing.extraWeight')
  const strengthBonus = balanceNumber('swing.swingStrengthBonus')
  const contact =
    input.buntKind > 0
      ? trunc((base.scaledContact * BUNT_CONTACT_NUMERATOR) / 10)
      : trunc((trunc((hitEdge * formula.contactFactor) / 1000 + balanceNumber('swing.contactBase')) * timedContactOf(base, input)) / 10)
  const solidWeight =
    trunc(
      trunc((hitEdge * formula.hitCoefficient * hitWeight + powerEdge * formula.extraCoefficient * extraWeight) / 100) / (hitWeight + extraWeight),
    ) +
    formula.hitBase * BASE_SCALE
  // 원본은 B 를 먼저 배율까지 끝내고 나서 탈진 보너스를 더하고, C 는 그 보너스를 먼저 받은 뒤 배율을 먹는다
  const solid = trunc(((base.baseSolid + solidWeight + strengthBonus) * base.timingScale) / 100) + base.exhausted
  const homeRunWeight = formula.extraBase * BASE_SCALE + trunc((powerEdge * formula.extraCoefficient) / 100)
  const homeRun = trunc(((base.baseHomeRun + base.exhausted + homeRunWeight + strengthBonus) * base.timingScale) / 100)
  return { contact, solid, homeRun }
}

/** 스킬(0xab91c~) → 보정 구조체 % (0xabd92~0xabe02) — 모든 모드가 같은 길로 모인다 */
function finishFactors(factors: SwingFactors, input: SwingResultInput, boost: SwingBoost): SwingFactors {
  const skilled = applySwingSkills({ solid: factors.solid, homeRun: factors.homeRun }, input.batterSkillIds, input.pitcherSkillIds, input.situation)
  // 0xabd92~0xabe02 — 스킬 보정 뒤, 상한(0xabeba) 앞. 마구 % 도 부호가 양수라 타자 쪽을 올린다 (원본 버그 B-02 — 고친 길은 swingBoostOf 가 음수 % 를 준다)
  const boostedSolid = skilled.solid + trunc((skilled.solid * boost.solidPercent) / 100)
  const boostedHomeRun = skilled.homeRun + trunc((skilled.homeRun * boost.homeRunPercent) / 100)
  return { contact: factors.contact, solid: boostedSolid, homeRun: boostedHomeRun }
}

/** 난수 없이 정해지는 contact · B · C */
export function swingFactorsOf(input: SwingResultInput): SwingFactors {
  const boost = input.boost ?? NO_SWING_BOOST
  const multiplier = pitchGradeMultiplierOf(input.controlTier)
  const base = factorBaseOf(input, multiplier)
  const factors = input.mode === '홈런더비' ? derbyFactorsOf(input, base) : regularFactorsOf(input, base, multiplier, boost)
  return finishFactors(factors, input, boost)
}
