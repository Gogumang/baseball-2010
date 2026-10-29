import { balanceNumber } from '@/shared/config/balance'
import type { SwingBoost } from '@/entities/batting/model/swingBoost'
import { trunc } from '@/entities/batting/model/swingResult/formula'
import type { SwingResultInput } from '@/entities/batting/model/swingResult/types'

/**
 * 내 선수(비트7) 보너스 — d_level.dat 0x1d8·0x1da(타자), 0x1dc·0x1de(투수) (객체 오프셋).
 * `base − perLevel × 연차 idx` 이고 0 에서 멈춘다 (`careerYearIndex` 주석 참고). 모드 3·4 에서만.
 * 투수 미션(원본 모드 5)에서 비트7 투수에게 붙는 고정 보너스는 0xab42a~0xab442 (`swing.missionOwnPitcherBonus`).
 * 0xab5d2 `subs #0xa` — 모드 3·4 밖에서 수비 팀이 사람일 때 (`swing.teamHumanDefensePenalty`).
 * 0xab5f6 `adds #0x64` — 모드 6(타자 미션)에서 공격 팀이 사람일 때 (`swing.batterMissionHumanBonus`).
 *
 * 원본이 B·C 에 각각 더하는 param_15 × 500 (`swing.swingStrengthBonus`). 두 호출자 모두 param_15 로 1 만 넘긴다 —
 * 1 이 아닌 값이 오는 경로는 미해독이라 상수로 뒀다.
 * (예전 이식본은 이 500 을 "직전과 같은 구질" 보너스로 읽었는데, 0xab214 안에는 그런 조건이 없다.)
 */
function ownBonusOf(base: number, perLevel: number, yearIndex: number): number {
  return Math.max(0, base - perLevel * yearIndex)
}

/** 내 선수 보너스와 그 계수는 나리(원본 모드 3·4)에서만 켜진다 (sp40, 0xab2ce~0xab2d8) */
const isCareerModeOf = (input: SwingResultInput) => input.mode === '나만의리그'

/** ab3f2 — 타자 aB = D[0x1d8] − D[0x1da] × 연차 idx (나리 · 비트7 타자만) */
function batterOwnBonusOf(input: SwingResultInput): number {
  if (!isCareerModeOf(input) || input.isBatterOwnPlayer !== true) return 0
  return ownBonusOf(balanceNumber('swing.ownBatterBonusBase'), balanceNumber('swing.ownBatterBonusPerYear'), input.careerYearIndex ?? 0)
}

/** 0xab494 — 투수 aP = D[0x1dc] − D[0x1de] × 연차 idx (나리 · 비트7 투수), 투수 미션 비트7 투수는 고정 보너스 (0xab42a~0xab442) */
function pitcherOwnBonusOf(input: SwingResultInput): number {
  if (input.isPitcherOwnPlayer !== true) return 0
  if (isCareerModeOf(input)) {
    return ownBonusOf(balanceNumber('swing.ownPitcherBonusBase'), balanceNumber('swing.ownPitcherBonusPerYear'), input.careerYearIndex ?? 0)
  }
  return input.mode === '투수미션' ? balanceNumber('swing.missionOwnPitcherBonus') : 0
}

/** 그 계수(K 1000 …)는 나리에서 타자·투수 중 한쪽이라도 비트7 일 때만 쓴다 (0xab628~0xab646) */
export function usesAceFormula(input: SwingResultInput): boolean {
  return isCareerModeOf(input) && (input.isBatterOwnPlayer === true || input.isPitcherOwnPlayer === true)
}

/** 팀 조작 보정 0xab5c0~0xab5fc — 모드 3·4 밖에서 수비가 사람이면 −10, 모드 6 에서 공격이 사람이면 +100 */
function teamAdjustOf(input: SwingResultInput): number {
  const defensePenalty = !isCareerModeOf(input) && input.isDefenseHuman === true ? -balanceNumber('swing.teamHumanDefensePenalty') : 0
  const missionBonus = input.mode === '미션' && input.isOffenseHuman === true ? balanceNumber('swing.batterMissionHumanBonus') : 0
  return defensePenalty + missionBonus
}

/** hit 쪽 · power 쪽 */
export interface SwingEdges {
  readonly hitEdge: number
  readonly powerEdge: number
}

/** 0xab4dc~0xab5a2 — 구조체 out[0]·out[2] 는 타자 쪽, out[4]·out[6] 은 투수 쪽(배율 앞)에 더한다 */
export function swingEdgesOf(input: SwingResultInput, multiplier: number, boost: SwingBoost): SwingEdges {
  const batterBonus = batterOwnBonusOf(input)
  const pitcherBonus = pitcherOwnBonusOf(input)
  const teamAdjust = teamAdjustOf(input)
  const pitcherVelocity = trunc((multiplier * (input.pitcher.velocity + boost.pitcherVelocity + pitcherBonus)) / 100)
  const pitcherControl = trunc((multiplier * (input.pitcher.control + boost.pitcherControl + pitcherBonus)) / 100)
  return {
    hitEdge: input.batter.hit + boost.batterHit + batterBonus - pitcherVelocity + teamAdjust,
    powerEdge: input.batter.power + boost.batterPower + batterBonus - pitcherControl + teamAdjust,
  }
}
