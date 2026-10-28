import { resultOf, type PlayerSide } from '@/entities/game/model/gameState'
import type { LeaguePlateAppearance, LeagueStolenBase, LeagueFieldingError } from '@/entities/league/model/leaguePlayerStats'
import type { CompleteGameKind } from '@/entities/season-mode/model/seasonReputation'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import {
  type CompleteGameFlags,
  popularityCompleteGameOf,
  reputationCompleteGameOf,
  reputationCompleteGameInningIndexOf,
} from '@/entities/season-mode/model/seasonEvaluation'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { gameEndRecordIdsFor } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { decisionTableSlotOf, decisionTableTeamsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import { REGULATION_LAST_INNING_INDEX } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'
import type { TeamPitchingLine } from '@/features/play-team-game/model/teamGameFlow/types/records'

/* ── 경기 뒤 ─────────────────────────────────────────────────────────────────── */

export interface TeamGameSummary {
  readonly result: ReturnType<typeof resultOf>
  readonly won: boolean
  readonly ourScore: number
  readonly opponentScore: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람(우리) 측 — 전역 경기 상태 +0x28 · +0x7e 의 측 차례 (`setLiveGameSides`). 손으로 만든 요약에는 없다 */
  readonly playerSide?: PlayerSide
  /** 치른 이닝 (1-기준) */
  readonly inningsPlayed: number
  readonly pitching: TeamPitchingLine
  /** 리그 선수 기록표에 그대로 넣는다 (`recordLeaguePlateAppearances`) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 리그 기록표 +0x2c 도루 (`recordLeagueStolenBases`) — 양 팀. 없으면 빈 것 */
  readonly leagueStolenBases?: readonly LeagueStolenBase[]
  /** 리그 기록표 +0x2e 실책 (`recordLeagueErrors`) — 양 팀. 게이트가 없다(포스트시즌에도). 없으면 빈 것 */
  readonly leagueErrors?: readonly LeagueFieldingError[]
  /** 시즌 평가 `evaluateSeasonGame` 에 그대로 넘기는 두 칸 (인기도·평판이 서로 다른 이닝 칸을 본다) */
  readonly popularityCompleteGame: CompleteGameKind
  readonly reputationCompleteGame: CompleteGameKind
  /**
   * 시즌 평판 평가 16칸 (`SR+0x1a0..0x1af`) — 부르는 쪽이 `evaluateSeasonGame` **앞에서**
   * `record.gameRecord` 에 꽂는다. 시즌(모드 2)이 아니면 전부 0 이다 (게이트 `0xa755c`).
   */
  readonly gameRecord: readonly number[]
  /**
   * 이 경기 **기록달성 번호** — 경기 중 쌓인 것 + 경기 끝 0xa7de8 몫(37~39 점수차 승 · 28~31 완투 계열).
   * 원본 경기 끝 0x4ea0c 는 모드 5·6 이 아니면 `Σ 횟수 × 0xcfbf8[k]` 를 저장 G(+0x64)에 더한다(4ebe0~4ec5a, 99999 상한).
   * (`summaryOf` 는 늘 채운다. 선택 칸인 것은 이 칸을 아직 안 읽는 앱 쪽 시험용 요약들이 그대로 맞게 하려는 것뿐이다.)
   */
  readonly recordIds?: readonly number[]
  /**
   * 리그 투수 기록 재료 — 양 팀 투수 줄(붙박이 표 칸, 마투수 뺌)과 경기 끝 판정 0xa7de8 (판정 칸도 표 칸으로 되돌린 것).
   * 부르는 쪽이 `leaguePitcherAppearancesOf` → `recordLeaguePitcherAppearances` 로 쌓는다 — 정산의 투수 칸 쓰기는
   * `0xa56dc` 가 참일 때만이라 시즌(모드 2 갈래 0xa56fa)도 국가대항전·포스트시즌 경기는 쌓지 않는다.
   */
  readonly leaguePitchers?: GameLeaguePitchers
  /** 위 기록의 G — `recordGamePointsOf` (0xcfbf8 표). 저장 G 에 더하는 것은 부르는 쪽(앱 세션)의 몫이다 */
  readonly gamePoints?: number
  /**
   * **경기가 끝났을 때의 투수 스태미나** `+0x2c` — 옵션 `ourPitcherStaminas` 와 같은 차례(명단 차례, 마투수 뺌).
   * 원본은 이 값이 레코드에 남아 다음 경기로 이어진다 — 시즌 저장에 되적고 하루 끝 회복을 거는 것은 부르는 쪽 몫이다.
   * 하루 끝 회복은 정규·포스트시즌 모두 `0x4ea0c` 4f2bc 의 열 팀 `0xb617c`(+20%) 하나뿐이다 (5d61cf2).
   * `0xb818c` 의 10000 채우기(b81e0)는 **국가대항전 갈래 안에만** 있고 포스트시즌 갈래(L+0x34)는 b8228 → b8320 으로
   * 곧장 끝난다 — a583fe0 이 적은 "포스트시즌은 내 팀만 10000" 은 틀렸다.
   */
  readonly ourPitcherStaminas?: readonly number[]
  /** 상대 팀 투수의 끝 스태미나 — 표 칸 차례 (`opponentPitcherStaminas` 와 같은 차례) */
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * 내 팀 **마투수**(명단 밖 8번 칸)의 끝 스태미나 `+0x2c` — 마투수를 안 넣은 경기면 없다. 원본은 이 줄도 시즌 레코드에
   * 남는다(0xb512c 가 빼기 전까지 — 시즌 `SeasonRecordAces.pitcherStamina`, U-105 r154)
   */
  readonly ourAcePitcherStamina?: number
  /**
   * 이 경기 **돌발 보상·페널티** — `resolveBurst` 의 `deltas` 를 판정 차례대로 모은 것 (시즌 모드 2 만, 한 경기 최대 1회
   * 발동이라 많아야 한 판정 몫). 원본 0x8e34c 는 판정이 난 경기 중에 더하므로 부르는 쪽이 경기 끝 평가 0x4ea0c **앞에**
   * 먹인다 (`seasonRewards`, fded413).
   */
  readonly burstRewardDeltas?: readonly BurstRewardDelta[]
}

/** 명단 칸별 스태미나(지금 마운드 칸은 `current`)를 명단 차례로 되돌린다 — 마투수는 뺀다 */
function orderedPitcherStaminasOf(
  entry: readonly TeamEntryPitcher[],
  staminas: readonly number[],
  moundIndex: number,
  current: number,
): readonly number[] {
  const out: number[] = []
  entry.forEach((pitcher, index) => {
    if (pitcher.orderIndex < 0) return
    out[pitcher.orderIndex] = index === moundIndex ? current : (staminas[index] ?? FULL_STAMINA)
  })
  return Array.from(out, (value) => value ?? FULL_STAMINA)
}

/** 내 팀 마투수 줄(`aceIndex` ≥ 0)의 끝 스태미나 — 마운드면 지금 값, 아니면 그 칸 값 */
function acePitcherStaminaOf(progress: TeamGameProgress): { readonly ourAcePitcherStamina?: number } {
  const index = progress.ourPitcherEntry.findIndex((pitcher) => pitcher.aceIndex >= 0)
  if (index < 0) return {}
  const stamina = index === progress.ourPitcherIndex ? progress.stamina : (progress.ourPitcherStaminas[index] ?? FULL_STAMINA)
  return { ourAcePitcherStamina: stamina }
}

export function summaryOf(progress: TeamGameProgress): TeamGameSummary {
  const ended = gameEndDecisionOf(progress.decisions)
  const recordIds = [...progress.recordIds, ...gameEndRecordIdsFor(progress)]
  const game = progress.game
  const flags: CompleteGameFlags = {
    allowedBaserunner: progress.pitching.allowedBaserunner,
    allowedHit: progress.pitching.hitsAllowed > 0,
    allowedRun: progress.pitching.runsAllowed > 0,
  }
  const outs = progress.pitching.outsRecorded
  return {
    result: resultOf(game),
    won: game.ourScore > game.opponentScore,
    ourScore: game.ourScore,
    opponentScore: game.opponentScore,
    ourTeamId: progress.options.ourTeamId,
    opponentTeamId: progress.options.opponentTeamId,
    playerSide: game.playerSide,
    inningsPlayed: game.inning,
    pitching: progress.pitching,
    leaguePlateAppearances: progress.leaguePlateAppearances,
    leagueStolenBases: progress.leagueStolenBases ?? [],
    leagueErrors: progress.leagueErrors ?? [],
    // ⚠️ 원본 그대로 — 인기도는 `st+0x6b`(현재 이닝), 평판은 `st+0x69`(정규 마지막 이닝)를 본다.
    //    그래서 **연장 완투는 인기도만 보너스를 받는다** (P4 "원본 버그·이상" 3번)
    popularityCompleteGame: popularityCompleteGameOf(outs, game.inning - 1, flags),
    //    고침(B-38): 평판도 지금 이닝으로 본다 (`reputationCompleteGameInningIndexOf`)
    reputationCompleteGame: reputationCompleteGameOf(outs, reputationCompleteGameInningIndexOf(game.inning - 1, REGULATION_LAST_INNING_INDEX), flags),
    gameRecord: progress.gameRecord,
    recordIds,
    gamePoints: recordGamePointsOf(recordIds),
    ourPitcherStaminas: orderedPitcherStaminasOf(progress.ourPitcherEntry, progress.ourPitcherStaminas, progress.ourPitcherIndex, progress.stamina),
    opponentPitcherStaminas: orderedPitcherStaminasOf(
      progress.opponentPitcherEntry,
      progress.opponentPitcherStaminas,
      progress.opponentPitcherIndex,
      progress.opponentStamina,
    ),
    ...acePitcherStaminaOf(progress),
    leaguePitchers: {
      lines: progress.pitcherLines,
      decision: {
        winner: decisionTableSlotOf(progress, ended.winner),
        loser: decisionTableSlotOf(progress, ended.loser),
        save: decisionTableSlotOf(progress, ended.save),
      },
      sideTeams:
        game.playerSide === 0
          ? [progress.options.ourTeamId, progress.options.opponentTeamId]
          : [progress.options.opponentTeamId, progress.options.ourTeamId],
      ...decisionTableTeamsOf(progress, ended),
    },
    burstRewardDeltas: progress.burstRewardDeltas,
  }
}
