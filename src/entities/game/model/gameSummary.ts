import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { GameResult } from '@/entities/game/model/gameState'

/** 경기 한 판이 끝났을 때의 요약. 육성 보상 계산의 입력이 된다. */
export interface GameSummary {
  readonly result: GameResult
  readonly ourScore: number
  readonly opponentScore: number
  /** 이 경기에서 플레이어가 낸 성적 */
  readonly stats: SeasonStats
  /** 사용자 타석 인기도 점수 합 (0xa59c0) — 경기 후 평가의 입력 */
  readonly popularityPoints: number
  readonly doublePlays: number
  readonly scoringPositionOuts: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 달성한 기록 id — 경기 끝 G포인트 지급의 입력 (0x4ea0c) */
  readonly recordIds: readonly number[]
}
