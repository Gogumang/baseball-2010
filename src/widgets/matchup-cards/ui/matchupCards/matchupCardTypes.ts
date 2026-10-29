import type { StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/**
 * 투수 판에 적을 것. 값을 모르면 비워 둔다 — 그 칸은 안 그린다(원본은 늘 그린다 — 부르는 쪽이 값을 못 대는 칸이다).
 */
export interface MatchupPitcherCard {
  /** `0xb6c20(st, st[0xa]) == 1` — 수비 팀이 COM 이면 img_text 158, 아니면 157 PLAYER */
  readonly isComputer: boolean
  /** 0xb62c0(투수) */
  readonly name?: string
  /** 0xb6704 = 레코드 +0xb & 3 (0 선발 · 1 중계 · 2 구원) */
  readonly role?: number
  /** 0xb63c0(투수) — 참이면 54 좌완, 아니면 55 우완 */
  readonly throwsLeft?: boolean
  /** 0xb6ce8 — 방어율 × 100 (0~9999) */
  readonly earnedRunAverage?: number
  /** 레코드 +0x26 (s16) */
  readonly strikeouts?: number
  readonly stamina?: StaminaGauge
}

/** 타자 판에 적을 것 */
export interface MatchupBatterCard {
  /** `0xb6c20(st, st[9]) == 1` */
  readonly isComputer: boolean
  /** 0xb62c0(타자) */
  readonly name?: string
  /** 레코드 +0x1c & 0xf (0x54590) */
  readonly position?: number
  /** 0xb8e3c — 타율 × 1000 (0~1000) */
  readonly battingAverage?: number
  /** 레코드 +0x28 (s16) */
  readonly homeRuns?: number
  /** 레코드 +0x2a (s16) */
  readonly runsBattedIn?: number
  /** 팀 +0x32 (0 부터) — 판에는 + 1 */
  readonly battingOrder?: number
  /** 오늘 타석 기록 코드를 오래된 차례로 (0x53100(칸, i), i = 0..칸+0xc−1) */
  readonly recentResults?: readonly number[]
}
