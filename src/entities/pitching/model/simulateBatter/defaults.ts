import type { BatterSituation, PitcherStats } from '@/entities/pitching/model/simulateBatter/types'

/**
 * 상황을 넘겨주지 않는 부르는 곳이 쓰는 자리표시 — 무사 0-0 주자 없음. 원본에 이런 기본값은 없다.
 * 경기 쪽 세 부르는 곳(미션 · 투수편 · 팀 경기)은 모두 상황을 넘기고, 시험만 이 값을 쓴다.
 */
export const UNWIRED_SITUATION: BatterSituation = {
  strikes: 0,
  balls: 0,
  outs: 0,
  hasRunner: false,
}

/**
 * 투수 능력치를 넘기지 않을 때의 자리표시 — 원본에 이런 기본값은 없다. 경기 쪽 세 부르는 곳(미션 `useMissionSession` ·
 * `pitcherGameFlow` · `teamGameFlow`)은 모두 피로를 먹인 값(`fatigued`)을 넘기고, 시험만 이 값을 쓴다.
 */
export const DEFAULT_PITCHER_STATS: PitcherStats = { control: 500, velocity: 500 }
