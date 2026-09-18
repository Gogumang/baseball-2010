/**
 * 스윙 판정에 붙는 스킬 보정 (binary.mod 0xab214 안, 위치 분석 3차 표).
 * 타자 스킬 번호 = 비트, 투수 스킬 번호 = 비트 + 16 (0xb62b4). 설명문과 다른 수치도 코드 값을 따른다.
 * 16 상승세·17 하락세는 최근 두 타석 기록(0x53100)이 모두 0<x<5 / 4<x<8 일 때만 켠다 (점검 10차).
 * 보정은 스킬마다 그때 값에 차례로 더한다 — B += trunc(B × % / 100) (점검 10차. 1%·2% 외의 나눗수는 추정).
 */
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

export interface SwingSituation {
  /** 1부터 센 이닝 */
  readonly inning: number
  readonly isLosing: boolean
  readonly runnerCount: number
  readonly hasSecondBaseRunner: boolean
  /** 0 = 우완(오른쪽), 1 = 좌완 */
  readonly pitcherSide: number
  readonly batterSide: number
  readonly balls: number
  readonly strikes: number
  /** 0부터 센 타순 칸 */
  readonly batterOrderIndex: number
  /** 최근 타석 기록 코드 (앞이 오래된 것) — atBatRecordCodeOf */
  readonly recentAtBatCodes: readonly number[]
}

/** 기록 목록 0x53100 의 코드. 안타 1~4 · 아웃 5~7 은 16·17 조건 구간에서 거꾸로 짐작한 것이다 (추정) */
export function atBatRecordCodeOf(outcome: AtBatOutcome): number {
  switch (outcome.kind) {
    case '안타':
      return outcome.bases
    case '홈런':
      return 4
    case '삼진':
      return 5
    case '아웃':
      return outcome.detail === '땅볼아웃' ? 6 : 7
    default:
      return 8
  }
}

const lastTwo = (codes: readonly number[]) => (codes.length < 2 ? null : codes.slice(-2))
const isHotStreak = (s: SwingSituation) => lastTwo(s.recentAtBatCodes)?.every((code) => code > 0 && code < 5) ?? false
const isColdStreak = (s: SwingSituation) => lastTwo(s.recentAtBatCodes)?.every((code) => code > 4 && code < 8) ?? false

export interface SwingWeights {
  /** B(잘 맞음) */
  readonly solid: number
  /** C(홈런성) */
  readonly homeRun: number
}

interface SkillRule {
  readonly id: number
  readonly isActive: (situation: SwingSituation) => boolean
  readonly solid: number
  readonly homeRun: number
  /** 주자 한 명마다 곱하는가 */
  readonly perRunner?: boolean
}

const always = () => true
const LATE_INNING = 6

const BATTER_RULES: readonly SkillRule[] = [
  { id: 8, isActive: always, solid: 1, homeRun: 1 },
  { id: 9, isActive: always, solid: 2, homeRun: 0 },
  { id: 10, isActive: (s) => s.inning >= LATE_INNING && s.isLosing, solid: 3, homeRun: 3 },
  { id: 12, isActive: (s) => s.runnerCount >= 2, solid: 0, homeRun: 5 },
  { id: 13, isActive: (s) => s.pitcherSide !== 0, solid: 2, homeRun: 0 },
  { id: 14, isActive: (s) => s.pitcherSide === 0, solid: 2, homeRun: 0 },
  { id: 15, isActive: (s) => s.balls === 0 && s.strikes === 0, solid: 3, homeRun: 0 },
  { id: 16, isActive: isHotStreak, solid: 5, homeRun: 5 },
  { id: 17, isActive: isColdStreak, solid: -10, homeRun: -10 },
  { id: 18, isActive: always, solid: -10, homeRun: 0 },
  { id: 19, isActive: always, solid: 1, homeRun: -10 },
]

const PITCHER_RULES: readonly SkillRule[] = [
  { id: 24, isActive: always, solid: -1, homeRun: -1 },
  { id: 25, isActive: always, solid: -2, homeRun: 0 },
  { id: 27, isActive: (s) => s.strikes === 2, solid: -3, homeRun: 0 },
  { id: 28, isActive: (s) => s.batterSide !== 0, solid: -2, homeRun: 0 },
  { id: 29, isActive: (s) => s.batterSide === 0, solid: -2, homeRun: 0 },
  // 0부터 센 타순 2·3·4 = 3~5번 클린업 (b6394 ∈ {2,3,4})
  { id: 31, isActive: (s) => s.batterOrderIndex >= 2 && s.batterOrderIndex <= 4, solid: 0, homeRun: -10 },
  { id: 33, isActive: (s) => s.hasSecondBaseRunner, solid: -5, homeRun: 0 },
  { id: 35, isActive: always, solid: 5, homeRun: 0 },
  { id: 37, isActive: always, solid: -2, homeRun: -2, perRunner: true },
]

const PERCENT = 100
const stepOf = (value: number, percent: number) => value + Math.trunc((value * percent) / PERCENT)

function applyRules(weights: SwingWeights, rules: readonly SkillRule[], owned: readonly number[], situation: SwingSituation): SwingWeights {
  let { solid, homeRun } = weights
  for (const rule of rules) {
    if (!owned.includes(rule.id) || !rule.isActive(situation)) continue
    const times = rule.perRunner === true ? situation.runnerCount : 1
    for (let repeat = 0; repeat < times; repeat += 1) {
      if (rule.solid !== 0) solid = stepOf(solid, rule.solid)
      if (rule.homeRun !== 0) homeRun = stepOf(homeRun, rule.homeRun)
    }
  }
  return { solid, homeRun }
}

/** 타자 스킬(번호 순) → 투수 스킬(번호 순) 차례로 적용한다 */
export function applySwingSkills(
  weights: SwingWeights,
  batterSkillIds: readonly number[],
  pitcherSkillIds: readonly number[],
  situation: SwingSituation,
): SwingWeights {
  return applyRules(applyRules(weights, BATTER_RULES, batterSkillIds, situation), PITCHER_RULES, pitcherSkillIds, situation)
}
