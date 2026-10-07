import { staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/**
 * **소개 판 0x44944 가 읽는 값의 셈** — 판은 지금 투수 `0xae83c(수비 팀)`·지금 타자 `0xae89c(공격 팀)` 의
 * **선수 레코드(0x30 바이트)** 를 그대로 읽는다 (0x449ce~0x44a22).
 *
 * - 레코드 +0x20~+0x2a 는 **그 레코드의 시즌 줄**이다 — 투수 +0x20 잡은 아웃 · +0x22 실점 · +0x26 탈삼진,
 *   타자 +0x20 타수 · +0x22 안타 · +0x28 홈런 · +0x2a 타점 (P1 6절 · P3 7절 · P7 A1).
 *   경기 중에는 정산 0xa8024 가 **기록 게이트 0xa56dc(R, 팀, 0)** 가 참일 때만 그 자리에서 올린다:
 *   점프표 0xd8204[모드 − 2] — 모드 2 0xa56fa(국가대항전 +0x12c · 포스트시즌 +0xb4 이면 거짓, 아니면 마선수만 거짓) ·
 *   모드 3·4 0xa571c(같은 두 칸, 아니면 마선수만 거짓) · 모드 5·6 0xa5764 · **그 밖(1·7·8·9)은 거짓** — 일반·대전·홈런더비는
 *   경기 중에 안 오른다.
 *   그래서 판 값 = (그 경기를 세울 때 레코드에 들어 있던 줄) + (게이트가 열린 모드면 이 경기에서 그 선수가 쌓은 줄)이다.
 * - 모드 1(일반)의 레코드는 XlsBATTER_DATA · XlsPITCHER_DATA 행 그대로다 — 행 바이트 32~45 에 그 줄이 차 있다
 *   (타자 예: 첫 행 타수 1000 · 안타 373 · 홈런 17 · 타점 63). 시즌·나리 저장의 레코드는 0x204e0 이 모드 2·3·4 를 만들 때
 *   0xb6cc4 로 +0x20~+0x2a 를 0 으로 비운다.
 */

/** 투수 시즌 줄 — 방어율 셈 두 칸과 탈삼진 */
export interface MatchupPitcherLine {
  /** +0x20 잡은 아웃 */
  readonly outs: number
  /** +0x22 실점 */
  readonly runsAllowed: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
}

/** 타자 시즌 줄 */
export interface MatchupBatterLine {
  /** +0x20 타수 */
  readonly atBats: number
  /** +0x22 안타 */
  readonly hits: number
  /** +0x28 홈런 */
  readonly homeRuns: number
  /** +0x2a 타점 */
  readonly runsBattedIn: number
}

/** `0xb6ce8` 방어율 × 100 — 아웃 > 0 이면 min(9999, trunc(실점 × 2700 / 아웃)), 아니면 실점 있으면 9999 · 없으면 0 */
export function earnedRunAverageValueOf(line: Pick<MatchupPitcherLine, 'outs' | 'runsAllowed'>): number {
  if (line.outs > 0) return Math.min(9999, Math.trunc((line.runsAllowed * 2700) / line.outs))
  return line.runsAllowed > 0 ? 9999 : 0
}

/** `0xb8e3c` 타율 × 1000 — 타수 ≤ 0 이면 0, min(1000, trunc(안타 × 1000 / 타수)) */
export function battingAverageValueOf(line: Pick<MatchupBatterLine, 'atBats' | 'hits'>): number {
  if (line.atBats <= 0) return 0
  return Math.min(1000, Math.trunc((line.hits * 1000) / line.atBats))
}

/** 두 줄을 더한다 — 경기를 세울 때의 줄 + 이 경기 줄 */
export function sumPitcherLines(left: MatchupPitcherLine, right: MatchupPitcherLine): MatchupPitcherLine {
  return {
    outs: left.outs + right.outs,
    runsAllowed: left.runsAllowed + right.runsAllowed,
    strikeouts: left.strikeouts + right.strikeouts,
  }
}

export function sumBatterLines(left: MatchupBatterLine, right: MatchupBatterLine): MatchupBatterLine {
  return {
    atBats: left.atBats + right.atBats,
    hits: left.hits + right.hits,
    homeRuns: left.homeRuns + right.homeRuns,
    runsBattedIn: left.runsBattedIn + right.runsBattedIn,
  }
}

/** 판에 넘길 투수 줄 값 — 방어율(×100) · 탈삼진 */
export function pitcherCardStatsOf(line: MatchupPitcherLine): { earnedRunAverage: number; strikeouts: number } {
  return { earnedRunAverage: earnedRunAverageValueOf(line), strikeouts: line.strikeouts }
}

/** 판에 넘길 타자 줄 값 — 타율(×1000) · 홈런 · 타점 */
export function batterCardStatsOf(
  line: MatchupBatterLine,
): { battingAverage: number; homeRuns: number; runsBattedIn: number } {
  return { battingAverage: battingAverageValueOf(line), homeRuns: line.homeRuns, runsBattedIn: line.runsBattedIn }
}

/** 마타자 순번(0xb63a0 = 0~4)별 손 — 표 0xd88b0 [1, 0, 0, 0, 1] (b63ea) */
const ACE_BATTER_HANDS: readonly number[] = [1, 0, 0, 0, 1]

/**
 * **타자의 손** `0xb63c0(rec)` 타자 갈래 (b63ea, 확정) — 마타자(0xb63a0 이 0~4)면 표 0xd88b0, 아니면 폼 니블
 * `rec[0xb] >> 4` 의 낮은 비트. 1 좌타 · 0 우타.
 * @param profile 레코드 +0xb (`RosterPlayer.profile`)
 * @param aceIndex 마타자 순번 (아니면 음수)
 */
export function batterHandOf(profile: number, aceIndex = -1): number {
  if (aceIndex >= 0) return ACE_BATTER_HANDS[aceIndex] ?? 0
  return (profile >> 4) & 1
}

/**
 * **체력 막대 값** (0x44ea0~0x44f04) — 길이 = `0x66e44(0xb8680(수비 팀), 투수, f)` = 용량 X(`staminaCapacityOf`),
 * 최대 = f ? 1449 : 1249, 붉은 막대 % = `0xaebb0(팀)` = 지금 투수 스태미나 / 100. f = `팀[+0x26] − 팀[+0x33] == 1`
 * (아직 교체가 없다 — 웹 각 진행기의 첫 투수 표시와 같은 칸).
 */
export function staminaGaugeOf(mound: {
  /** 체력 실효 능력치 `0xb6414(투수, 3, 1)` */
  readonly staminaAbility: number
  /** 팀 사기 `0xb8680(팀)` */
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  /** 레코드 +0x2c (0~10000) */
  readonly stamina: number
  /** 0xaebb0 을 따로 대는 경우(홈런더비는 늘 100) */
  readonly percent?: number
}): StaminaGauge {
  return {
    lengthValue: staminaCapacityOf(mound.staminaAbility, mound.teamMorale, mound.isFirstPitcher),
    maxValue: mound.isFirstPitcher ? 0x5a9 : 0x4e1,
    percent: mound.percent ?? staminaPercentOf(mound.stamina),
  }
}
