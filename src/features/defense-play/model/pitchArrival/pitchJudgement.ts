import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { PASSED_BALL_PLAY_KIND, type PassedBallStrikeout } from '@/entities/fielding/model/passedBall'

/** 0x9d57c 투구 판정 — E 4b: 1 스트라이크 · 2 볼 · 3 볼넷 · 4 사구 · 5 삼진 */
export const PITCH_JUDGEMENT = {
  STRIKE: 1,
  BALL: 2,
  WALK: 3,
  HIT_BY_PITCH: 4,
  STRIKEOUT: 5,
} as const

/** 공 도착 판정 `0x3dfac` 를 지나는 공인가 — 맞히지 못한 공(볼·스트라이크·사구)만 */
export function arrivesUnhit(resolution: PitchResolution): boolean {
  return resolution.kind === '볼' || resolution.kind === '스트라이크' || resolution.kind === '사구'
}

/**
 * 못 맞힌 공의 투구 판정 v (0x9d57c) — 이 공을 먹인 뒤의 타석 결과로 고른다.
 * 사구가 맨 먼저(0x9d582), 그다음 스트라이크 쪽(+4 > 1 이면 5) · 볼 쪽(+5 > 2 이면 3).
 */
export function pitchJudgementOf(resolution: PitchResolution, outcomeAfter: AtBatOutcome | null): number {
  if (resolution.kind === '사구') return PITCH_JUDGEMENT.HIT_BY_PITCH
  if (resolution.kind === '볼') return outcomeAfter?.kind === '볼넷' ? PITCH_JUDGEMENT.WALK : PITCH_JUDGEMENT.BALL
  return outcomeAfter?.kind === '삼진' ? PITCH_JUDGEMENT.STRIKEOUT : PITCH_JUDGEMENT.STRIKE
}

/**
 * **낫아웃이 판정 칸을 지웠는가** — 0x3dfac 의 낫아웃 갈래(직접 떴다, r213):
 * ```
 * 3e05a  v = 0x9d57c(…) ; [장면+0x10ac] = v          ; 판정 글자 0x39504 가 읽는 칸
 * 3e062  r(0.1%) && v ≠ 3·4 → 3e070 0x3507c · 3e080 0xb0cb8(플레이, 9) · 3e09a 상태 0x17 예약
 * 3e0a2  v == 5 → 3e0a8 st[0xc] = 5 · 3e0aa [장면+0x10ac] = 0
 * 3e0b8  0xa9879(1)(1루 주자) && st[6] ≤ 1 → 3e0cc [장면+0x10ac] = 5 되돌림(삼진 그대로)
 *        아니면 3e0da 0xa7c4c(삼진 기록) · 3e0e0 st[0x1a] = 1(낫아웃)          ; v 는 0 으로 남는다
 * 3e1d4  v ≠ 0 일 때만 st[0xc] = v · 메시지 0xbba(v)
 * ```
 * 판정 글자는 같은 0x12 의 틱 0 그림 0x4ce9c → 0x39504 가 [장면+0x10ac] 로 game_judge 애니를 고르는데(표 0xcfe90, v 0 → 글자 없음),
 * 이 진입 0x3dfac 가 그 그림보다 **먼저** 돈다(진입 → 같은 틀의 그리기). 그래서 낫아웃이면 '삼진' 글자도, 그 글자가 쏘는
 * 양끝 파티클(0x393b4 39498)도 없다. 판 종류 9 · 낫아웃 갈래 `'batterRuns'`(`passedBallStrikeoutOf`)가 그 경우다 — 열어 둔 판
 * (`OpenedPitchArrivalPlay`)이든 다 돈 판(`PitchArrivalPlay`)이든 같은 칸을 본다.
 */
export function clearsPitchJudgement(play: { readonly kind: number; readonly strikeout?: PassedBallStrikeout | 'none' } | null | undefined): boolean {
  return play != null && play.kind === PASSED_BALL_PLAY_KIND && play.strikeout === 'batterRuns'
}
