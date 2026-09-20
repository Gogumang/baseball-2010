import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { GameResult } from '@/entities/game/model/gameState'
import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'

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
  /** 평판 가산 칸 (0xa57f8) — 만루홈런·끝내기·볼넷·역전/동점 득점 */
  readonly reputationCounts: ReputationCounts
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 달성한 기록 id — 경기 끝 G포인트 지급의 입력 (0x4ea0c) */
  readonly recordIds: readonly number[]
  /**
   * 이 경기에서 나온 **리그 선수 타석 결과** (동료 여덟 타순 + 상대 팀). 원본은 사람 경기도
   * CPU 끼리 경기와 같은 기록 함수 0xa8024 를 불러 선수 레코드에 쌓는다 (B-2 확정).
   * 내 선수 타석은 빠져 있다 — `stats` 가 이미 세고 있어 두 번 세지 않는다.
   *
   * 리그 밖 경기(미션·홈런더비)는 주지 않으므로 **선택 칸**이다.
   */
  readonly leaguePlateAppearances?: readonly LeaguePlateAppearance[]
}
