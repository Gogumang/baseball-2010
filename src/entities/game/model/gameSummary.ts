import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
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
  /**
   * 경기 끝 결과 판(상태 0x18, 0x4fe9c)의 승리투수·패전투수·세이브 이름 — state+0x44/0x50/0x5c 를
   * 거르지 않고 그대로 읽은 것이다(측 2 = 없음이면 null). 사람 경기 진행기만 채운다 — **선택 칸**.
   */
  readonly pitchersOfRecord?: {
    readonly win: string | null
    readonly loss: string | null
    readonly save: string | null
  }
  /**
   * 경기가 끝났을 때 양 팀 투수 칸(붙박이 표 칸 0~7)별 레코드 스태미나 `+0x2c` — 리그 표로 이어지는 값이다
   * (하루 끝 `0xb617c` 회복 전). 리그 사람 경기 진행기(타자편)만 채운다 — **선택 칸**.
   */
  /**
   * 리그 투수 기록 재료 — 이 경기를 던진 투수 줄과 경기 끝 판정 0xa7de8 (`entities/game/model/gamePitcherLines`).
   * 사람 경기도 CPU 끼리 경기와 같은 0xa8024·0xa7de8 을 지난다. 리그 사람 경기 진행기만 채운다 — **선택 칸**.
   */
  readonly leaguePitchers?: GameLeaguePitchers
  /**
   * 경기 끝 판 0x4fe9c(503d8)가 (14, 252) 에 부르는 이닝별 점수판 0x41c18 의 판 값 — st[0x6b] · st[9] · 칸 st[0x6c..](이닝 mod 9).
   * `gameState.lineScoreSlotsOf`. 사람 경기 진행기만 채운다 — **선택 칸**.
   */
  readonly lineScore?: {
    readonly inning: number
    readonly offenseSide: 0 | 1
    readonly inningRuns: readonly [readonly number[], readonly number[]]
  }
  readonly pitcherStaminas?: {
    readonly ours: readonly number[]
    readonly opponent: readonly number[]
  }
}
