import { balanceList, balanceNumber } from '@/shared/config/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { swingFactorsOf } from '@/entities/batting/model/swingResult/factors'
import { clampError, trunc } from '@/entities/batting/model/swingResult/formula'
import type { SwingFactors, SwingResult, SwingResultInput } from '@/entities/batting/model/swingResult/types'

const BUNT_LIMIT = { horizontal: 20, vertical: 18 }
const BUNT_SKILL = 11
const BUNT_SKILL_PENALTY = 10
const BUNT_SUCCESS_CODES = [0, 6, 7, 8]
const BUNT_FAIL_CODES = [0, 12, 13, 14]
/** 결과 코드 — 24 홈런성 · 18 · 15 (잘 맞음) · 9 파울 · 0 · 3 (빗맞음) */
const CODE = { 홈런성: 24, 장타: 18, 잘맞음: 15, 파울: 9, 빗맞음: 0, 약한타구: 3 } as const
/** 만분율 굴림 위끝 */
const PER_MYRIAD = 10_000

/** 번트 — 오차가 한도를 넘으면 헛스윙, 아니면 rand(0,100) 을 성공률(번트왕 −10)과 견준다 */
function buntResultOf(input: SwingResultInput, buntRoll: number): SwingResult {
  const horizontal = Math.abs(clampError(input.horizontalError))
  const vertical = Math.abs(clampError(input.verticalError))
  if (horizontal > BUNT_LIMIT.horizontal || vertical > BUNT_LIMIT.vertical) return { kind: '헛스윙' }
  const penalty = input.batterSkillIds.includes(BUNT_SKILL) ? BUNT_SKILL_PENALTY : 0
  const isSuccess = buntRoll < balanceList('swing.buntSuccessPercent')[input.buntKind] - penalty
  const code = (isSuccess ? BUNT_SUCCESS_CODES : BUNT_FAIL_CODES)[input.buntKind]
  return { kind: '타구', code, isSolid: true }
}

/** 잘 맞은 공 — C 굴림 → 15/18 경계 굴림 (→ 홈런더비만 18 에서 rand(0,2) == 1 이면 24, 0xabf18~0xabf2a) */
function rollSolidHit(input: SwingResultInput, homeRun: number, random: RandomPort): SwingResult {
  const homeRunRoll = random.rand(0, PER_MYRIAD)
  if (homeRunRoll < homeRun) return { kind: '타구', code: CODE.홈런성, isSolid: true }
  const lineDriveLimit = trunc((homeRun * balanceNumber('swing.lineDriveFactor')) / trunc((PER_MYRIAD - homeRun) / 100))
  const lineDriveRoll = random.rand(0, PER_MYRIAD)
  if (lineDriveRoll >= lineDriveLimit) return { kind: '타구', code: CODE.잘맞음, isSolid: true }
  if (input.mode !== '홈런더비') return { kind: '타구', code: CODE.장타, isSolid: true }
  const derbyRoll = random.rand(0, 2)
  return { kind: '타구', code: derbyRoll === 1 ? CODE.홈런성 : CODE.장타, isSolid: true }
}

/** 빗맞은 공 — rand − 파울% × 100 < 0 이면 9, 거기서 아웃% × 100 을 더 빼 < 0 이면 0, 아니면 3 */
function rollWeakHit(random: RandomPort): SwingResult {
  const roll = random.rand(0, PER_MYRIAD) - balanceNumber('swing.foulPercent') * 100
  if (roll < 0) return { kind: '타구', code: CODE.파울, isSolid: true }
  return roll - balanceNumber('swing.outPercent') * 100 < 0
    ? { kind: '타구', code: CODE.빗맞음, isSolid: false }
    : { kind: '타구', code: CODE.약한타구, isSolid: false }
}

/** 맞았다 — B(상한 0xabeba) 굴림으로 잘 맞음 · 빗맞음을 가른다 */
function rollBattedBall(input: SwingResultInput, factors: SwingFactors, random: RandomPort): SwingResult {
  const solid = Math.min(factors.solid, balanceNumber('swing.solidCap'))
  const homeRun = Math.min(factors.homeRun, balanceNumber('swing.homeRunCap'))
  const solidRoll = random.rand(0, PER_MYRIAD)
  if (solidRoll < solid) return rollSolidHit(input, homeRun, random)
  return rollWeakHit(random)
}

/** 원본 난수 순서: 번트용 rand(0,100) → contact → B → C → 15/18 경계 (→ 홈런더비만 18 에서 rand(0,2)) */
export function swingResultOf(input: SwingResultInput, random: RandomPort): SwingResult {
  const factors = swingFactorsOf(input)
  const buntRoll = random.rand(0, 100)
  if (input.buntKind > 0) return buntResultOf(input, buntRoll)
  const contactRoll = random.rand(0, PER_MYRIAD)
  if (contactRoll >= factors.contact) return { kind: '헛스윙' }
  return rollBattedBall(input, factors, random)
}
