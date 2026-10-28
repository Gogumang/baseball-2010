import { resultOf } from '@/entities/game/model/gameState'
import type { LeagueFieldingError, LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import type { PitcherGameRecord } from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { GameEndDecision } from '@/entities/game/model/winLossSave'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import type { PitcherEvaluationRecord, PitcherGameEvaluation } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'

/* ── 경기 뒤 ─────────────────────────────────────────────────────────────────── */

export interface PitcherGameSummary {
  readonly result: ReturnType<typeof resultOf>
  readonly ourScore: number
  readonly opponentScore: number
  readonly record: PitcherEvaluationRecord
  readonly pitcherRecord: PitcherGameRecord
  readonly pitchCount: number
  readonly evaluation: PitcherGameEvaluation
  /** 승·패·세이브 투수. ⚠️ 세이브는 원본 버그(state+0x64 를 지우지 않음)로 거의 늘 없다 */
  readonly decision: GameEndDecision
  /** 내 투수가 무엇으로 적히는가 — R+0x124 (1 승 · 2 패 · 3 세이브 · 0 없음) */
  readonly decisionCode: number
  /** 방어율 × 100 (0xb6ce8) */
  readonly earnedRunAverage: number
  /** 시즌 레코드에 더할 값 — +0x20 아웃 · +0x22 실점 · +0x26 탈삼진 · +0x28 투구 수 · +0x2e 승 · +0x2f 패 · +0x24 세이브 · +0x2a 사사구 */
  readonly seasonDelta: {
    readonly outs: number
    readonly runsAllowed: number
    readonly strikeouts: number
    readonly pitches: number
    readonly wins: number
    readonly losses: number
    readonly saves: number
    readonly walks: number
  }
  /** 경기 뒤 남은 스태미나 (레코드 +0x2c). 경기 사이 회복은 `recoverStaminaAfterGameDay` 가 한다 */
  readonly stamina: number
  /**
   * 이 경기에서 달성한 기록 id — 경기 끝 G포인트 지급(0x4ea0c)의 입력.
   * 앱은 `recordGamePointsOf(summary.recordIds)` 로 G 를 구해 커리어에 얹으면 된다.
   */
  readonly recordIds: readonly number[]
  /**
   * 이 경기에 한 번이라도 마운드에 섰는가 (`progress.hasEntered`) — 등판 경기 수를 세는 입력.
   * 선발이면 경기 시작부터 참이고, 구원은 8회에 올라오는 순간 참이 된다.
   */
  readonly hasEntered: boolean
  /**
   * 경기 끝 이닝 `state+0x6b` (0-기준) — 평가 0xa719c 가 구원 연속 기록을 `> 6` 일 때만 잇고(0xa7334),
   * 116 감독 글 38 이 `state+0x6a == state+0x6b` 로 본다(0x12ade).
   */
  readonly endedInningIndex: number
  /**
   * 경기 끝 양 팀 투수 칸(붙박이 표 칸 0~7)별 레코드 스태미나 `+0x2c` — 리그 표로 이어지는 값(하루 끝 0xb617c 회복 전).
   * 마운드 값까지 얹었다. 내 값은 `stamina` 다.
   */
  readonly pitcherStaminas: { readonly ours: readonly number[]; readonly opponent: readonly number[] }
  /**
   * 리그 투수 기록 재료 — CPU 투수 줄(내 투수 빼고, 마운드 투구 수를 얹어)과 경기 끝 판정 0xa7de8 · 측 → 팀.
   * 판정이 내 투수(`MY_PITCHER_NUMBER`)를 가리키면 부르는 쪽이 건너뛴다(내 기록은 `seasonDelta`).
   */
  readonly leaguePitchers: GameLeaguePitchers
  /** 리그 타자 기록표 도루 +0x2c 재료 (`PitcherGameProgress.leagueStolenBases`) — 정규시즌만 쌓는 것은 부르는 쪽 몫 */
  readonly leagueStolenBases: readonly LeagueStolenBase[]
  /** 리그 타자 기록표 실책 +0x2e 재료 (`PitcherGameProgress.leagueErrors`) — 게이트가 없다 */
  readonly leagueErrors: readonly LeagueFieldingError[]
  /** 리그 타자 기록표 타석 줄 재료 (`PitcherGameProgress.leaguePlateAppearances`) — 정규시즌만 쌓는 것은 부르는 쪽 몫 */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /**
   * 이 경기 돌발 보상 · 페널티 0x8e34c (`PitcherGameProgress.burstRewardDeltas`) — 앱이 정산 앞에 커리어에 얹는다
   * (사기는 0xa3a44 — 대회 중이면 상대국 칸, `applyPitcherBurstRewards`)
   */
  readonly burstRewardDeltas?: readonly BurstRewardDelta[]
  /** 상대 팀 레코드 +2 에 이 경기가 남긴 값 (`PitcherGameProgress.opponentRecordMorale`) — 없으면 한 번도 안 덮였다 */
  readonly opponentRecordMorale?: number
}
