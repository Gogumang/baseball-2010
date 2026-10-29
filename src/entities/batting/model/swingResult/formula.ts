import { balanceGrid, balanceList, balanceNumber } from '@/shared/config/balance'

const ERROR_LIMIT = 40
/**
 * 코스 오차 구간 → [한도, A, B, C] 시작값 (`swing.errorBands`) · 한가운데 [A, B, C] (`swing.centerFactors`).
 * 제구 등급 → 투수 능력 배율 (d_level.dat 0x1e0, `swing.pitchGradeMultipliers`).
 */
const NEUTRAL_MULTIPLIER = 100
/** 제구 등급 배율 표의 마지막 칸 (d_level.dat 0x1e0, 6칸) */
const LAST_PITCH_GRADE = 5

/** 제구 등급 → 투수 능력 배율 — 음수면 100 */
export function pitchGradeMultiplierOf(controlTier: number): number {
  if (controlTier < 0) return NEUTRAL_MULTIPLIER
  return balanceList('swing.pitchGradeMultipliers')[Math.min(controlTier, LAST_PITCH_GRADE)]
}

/** 스윙 식 계수 — 마선수식 D[0x46..0x4e] · 일반식 D[0x50..] */
export interface SwingFormula {
  readonly hitBase: number
  readonly hitCoefficient: number
  readonly extraBase: number
  readonly extraCoefficient: number
  readonly contactFactor: number
}

/** 마선수식(ace, D[0x46..]) · 일반식(normal, D[0x50..]) — `swing.ace*` · `swing.normal*` */
export function swingFormulaOf(isAce: boolean): SwingFormula {
  return isAce
    ? {
        hitBase: balanceNumber('swing.aceHitBase'),
        hitCoefficient: balanceNumber('swing.aceHitCoefficient'),
        extraBase: balanceNumber('swing.aceExtraBase'),
        extraCoefficient: balanceNumber('swing.aceExtraCoefficient'),
        contactFactor: balanceNumber('swing.aceContactFactor'),
      }
    : {
        hitBase: balanceNumber('swing.normalHitBase'),
        hitCoefficient: balanceNumber('swing.normalHitCoefficient'),
        extraBase: balanceNumber('swing.normalExtraBase'),
        extraCoefficient: balanceNumber('swing.normalExtraCoefficient'),
        contactFactor: balanceNumber('swing.normalContactFactor'),
      }
}

export const trunc = Math.trunc
export const clampError = (value: number) => Math.max(-ERROR_LIMIT, Math.min(ERROR_LIMIT, value))

export function startingFactors(horizontal: number, vertical: number): [number, number, number] {
  const band = balanceGrid('swing.errorBands').find(([limit]) => horizontal > limit || vertical > limit)
  if (band === undefined) {
    const center = balanceList('swing.centerFactors')
    return [center[0], center[1], center[2]]
  }
  return [band[1], band[2], band[3]]
}
