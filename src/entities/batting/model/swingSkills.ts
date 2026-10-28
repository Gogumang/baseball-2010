/**
 * 스윙 판정에 붙는 스킬 보정 (binary.mod 0xab214 안, 위치 분석 3차 표).
 * 타자 스킬 번호 = 비트, 투수 스킬 번호 = 비트 + 16 (0xb62b4). 설명문과 다른 수치도 코드 값을 따른다.
 * 16 상승세·17 하락세는 최근 두 타석 기록(0x53100)이 모두 0<x<5 / 4<x<8 일 때만 켠다 (점검 10차).
 * 보정은 스킬마다 그때 값에 차례로 더한다 — B += trunc(B × % / 100) (점검 10차. 1%·2% 외의 나눗수는 추정).
 */
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { balanceGrid } from '@/shared/config/balance'

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

/**
 * 타석 기록 링버퍼의 코드 (0xa8024 가 넣는 값, P7 A1 확정):
 *   1~4 안타(루타) · **5 그 밖의 아웃(땅볼·포스·태그) · 6 뜬공 아웃 · 7 삼진** · 8 볼넷 · 9 사구
 * 앞서 웹은 5 삼진 · 6 땅볼 · 7 그 밖 아웃으로 5·6·7 을 다르게 짚고 있었다.
 */
export function atBatRecordCodeOf(outcome: AtBatOutcome): number {
  switch (outcome.kind) {
    case '안타':
      return outcome.bases
    case '홈런':
      return 4
    case '삼진':
      return 7
    case '아웃':
      return outcome.detail === '뜬공아웃' ? 6 : 5
    case '사구':
      // 0xa8024 사구 갈래가 링에 9 를 넣는다 (0xa8b9c) — 볼넷 8 과 다르다
      return 9
    default:
      return 8
  }
}

/**
 * 스킬 16 상승세 · 17 하락세 (0xaba7e~, A-5 확정).
 *
 * 타자마다 **용량 10 의 링버퍼**가 있고, 읽기 `i=0` 이 **가장 오래된** 기록이다.
 * 그래서 보는 것은 "최근 두 타석" 이 아니라 **버퍼의 맨 앞 두 칸**이고, 개수 조건이 따로 붙는다:
 *   - 상승세: 개수 > 3 이고 code(0)·code(1) 이 모두 1~4(안타)
 *   - 하락세: 개수 > 2 이고 code(0)·code(1) 이 모두 5~7(아웃)
 * 앞서 웹은 `slice(-2)`(가장 최근 둘)를 보고 개수 조건이 없었다 — 조건이 훨씬 자주 걸렸다.
 */
const HOT_STREAK_MINIMUM = 3
const COLD_STREAK_MINIMUM = 2

const oldestTwo = (codes: readonly number[], minimumCount: number) => (codes.length > minimumCount ? codes.slice(0, 2) : null)

const isHotStreak = (s: SwingSituation) => oldestTwo(s.recentAtBatCodes, HOT_STREAK_MINIMUM)?.every((code) => code > 0 && code < 5) ?? false
const isColdStreak = (s: SwingSituation) => oldestTwo(s.recentAtBatCodes, COLD_STREAK_MINIMUM)?.every((code) => code > 4 && code < 8) ?? false

export interface SwingWeights {
  /** B(잘 맞음) */
  readonly solid: number
  /** C(홈런성) */
  readonly homeRun: number
}

interface SkillRule {
  readonly id: number
  readonly isActive: (situation: SwingSituation) => boolean
  /** 주자 한 명마다 곱하는가 */
  readonly perRunner?: boolean
}

const always = () => true
const LATE_INNING = 6

/**
 * 켜지는 조건만 여기 둔다 — B · C % 는 숨은 판정값 표 `skill.batterSwingPercents` · `skill.pitcherSwingPercents` 의
 * 같은 차례 칸에서 읽는다 (원본 값: 8 [1,1] · 9 [2,0] · 10 [3,3] · 12 [0,5] · 13 [2,0] · 14 [2,0] · 15 [3,0] · 16 [5,5] ·
 * 17 [−10,−10] · 18 [−10,0] · 19 [1,−10] / 24 [−1,−1] · 25 [−2,0] · 27 [−3,0] · 28 [−2,0] · 29 [−2,0] · 31 [0,−10] ·
 * 33 [−5,0] · 35 [5,0] · 37 [−2,−2]).
 */
const BATTER_RULES: readonly SkillRule[] = [
  { id: 8, isActive: always },
  { id: 9, isActive: always },
  { id: 10, isActive: (s) => s.inning >= LATE_INNING && s.isLosing },
  { id: 12, isActive: (s) => s.runnerCount >= 2 },
  { id: 13, isActive: (s) => s.pitcherSide !== 0 },
  { id: 14, isActive: (s) => s.pitcherSide === 0 },
  { id: 15, isActive: (s) => s.balls === 0 && s.strikes === 0 },
  { id: 16, isActive: isHotStreak },
  { id: 17, isActive: isColdStreak },
  { id: 18, isActive: always },
  { id: 19, isActive: always },
]

const PITCHER_RULES: readonly SkillRule[] = [
  { id: 24, isActive: always },
  { id: 25, isActive: always },
  { id: 27, isActive: (s) => s.strikes === 2 },
  { id: 28, isActive: (s) => s.batterSide !== 0 },
  { id: 29, isActive: (s) => s.batterSide === 0 },
  // 0부터 센 타순 2·3·4 = 3~5번 클린업 (b6394 ∈ {2,3,4})
  { id: 31, isActive: (s) => s.batterOrderIndex >= 2 && s.batterOrderIndex <= 4 },
  { id: 33, isActive: (s) => s.hasSecondBaseRunner },
  { id: 35, isActive: always },
  { id: 37, isActive: always, perRunner: true },
]

const PERCENT = 100
const stepOf = (value: number, percent: number) => value + Math.trunc((value * percent) / PERCENT)

function applyRules(
  weights: SwingWeights,
  rules: readonly SkillRule[],
  percents: readonly (readonly number[])[],
  owned: readonly number[],
  situation: SwingSituation,
): SwingWeights {
  let { solid, homeRun } = weights
  rules.forEach((rule, index) => {
    if (!owned.includes(rule.id) || !rule.isActive(situation)) return
    const [solidPercent, homeRunPercent] = percents[index]
    const times = rule.perRunner === true ? situation.runnerCount : 1
    for (let repeat = 0; repeat < times; repeat += 1) {
      if (solidPercent !== 0) solid = stepOf(solid, solidPercent)
      if (homeRunPercent !== 0) homeRun = stepOf(homeRun, homeRunPercent)
    }
  })
  return { solid, homeRun }
}

/** 타자 스킬(번호 순) → 투수 스킬(번호 순) 차례로 적용한다 */
export function applySwingSkills(
  weights: SwingWeights,
  batterSkillIds: readonly number[],
  pitcherSkillIds: readonly number[],
  situation: SwingSituation,
): SwingWeights {
  const batterApplied = applyRules(weights, BATTER_RULES, balanceGrid('skill.batterSwingPercents'), batterSkillIds, situation)
  return applyRules(batterApplied, PITCHER_RULES, balanceGrid('skill.pitcherSwingPercents'), pitcherSkillIds, situation)
}
