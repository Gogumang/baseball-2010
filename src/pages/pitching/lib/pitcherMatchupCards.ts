import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { myMoundStaminaOf, opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { leagueBatterIdOf, leagueBatterLineOf } from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import {
  batterCardStatsOf,
  batterHandOf,
  pitcherCardStatsOf,
  staminaGaugeOf,
  sumBatterLines,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterLine, MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/** 투수편 소개 판 시즌 줄의 출처 — 내 투수 레코드 +0x20~ 의 웹 자리(커리어 시즌 줄)와 리그 선수 기록표 */
export interface PitcherMatchupRecords {
  /** 내 투수의 이번 시즌 줄 (이 경기 앞까지) */
  readonly mySeason: MatchupPitcherLine
  /** 리그 선수 기록표 — 상대 타자 줄 */
  readonly stats: LeaguePlayerStats
}

/** 이 경기에서 그 타순 칸 타자가 쌓은 줄 — 링 코드에서 (1~4 안타 · 4 홈런 · 5~7 아웃은 타수 · 8·9 사사구는 타수 아님) */
function gameLineFromResults(results: readonly number[]): MatchupBatterLine {
  return results.reduce<MatchupBatterLine>(
    (line, code) => ({
      atBats: line.atBats + (code >= 1 && code <= 7 ? 1 : 0),
      hits: line.hits + (code >= 1 && code <= 4 ? 1 : 0),
      homeRuns: line.homeRuns + (code === 4 ? 1 : 0),
      runsBattedIn: line.runsBattedIn,
    }),
    { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 },
  )
}

/**
 * **나리 투수편 상태 0xe 의 소개 판 값** (0x44944) — 내가 던지는 타석에만 0xe 를 지난다.
 * - 투수 = 내 투수(PLAYER): 이름 · 보직(`options.role` = +0xb & 3) · 손 0xb63c0(폼 & 1) · 체력 막대(용량 0x66e44 · % 0xaebb0) ·
 *   시즌 줄 = `records.mySeason` + (기록 게이트 0xa56dc 모드 3 갈래: 포스트시즌·국가대항전이 아니면) 이 경기 내 줄
 *   (`summaryOf` 의 seasonDelta 와 같은 칸 — 아웃 R+0x13c · 실점 · 탈삼진 R+0x134).
 * - 타자 = 상대(COM): 타순 `팀+0x32` · 이름 · 수비 · 손 · 시즌 줄 = 리그 기록표 줄 + 이 경기 줄 · 오늘 타석 기록 = 그 타순 칸 링.
 *   ⚠️ 이 경기 줄은 링에서 타수·안타·홈런만 센다 — 웹 투수편 진행기가 상대 타자의 타점을 리그 기록표로 넘기지 않아 타점은
 *   경기 앞 값이다(미해결).
 * - `records` 가 없으면 시즌 줄 칸을 비운다(부르는 쪽이 커리어를 아직 안 넘긴다).
 */
export function pitcherMatchupCardsOf(
  progress: PitcherGameProgress,
  pitcherName: string | undefined,
  records?: PitcherMatchupRecords,
): { readonly batterHand: number; readonly pitcher: MatchupPitcherCard; readonly batter: MatchupBatterCard } {
  const { options } = progress
  // 기록 게이트 0xa56dc 모드 3 갈래 0xa571c — 국가대항전(+0x12c) · 포스트시즌(+0xb4)이면 거짓 (진행기 `countsMyPitcherRecord` 와 같은 조건)
  const countsThisGame = !options.isPostseason && options.isNationalCup !== true
  const batter = opponentBatterOf(progress)
  const batterHand =
    batter.aceIndex !== undefined ? batterHandOf(0, batter.aceIndex) : batterHandOf(batter.profile ?? 0)
  const slot = lineupSlotOf(progress.opponentOrderIndex)
  const results = progress.opponentLineup.records[slot]?.results ?? []

  const myLine = records === undefined
    ? null
    : countsThisGame
      ? sumPitcherLines(records.mySeason, {
          outs: progress.record.outsRecorded,
          runsAllowed: progress.runsAllowedByMe,
          strikeouts: progress.record.strikeouts,
        })
      : records.mySeason
  const batterBase = records === undefined || batter.rosterSlot === null
    ? null
    : leagueBatterLineOf(records.stats, leagueBatterIdOf(options.opponentTeamId, batter.rosterSlot))
  const batterLine = batterBase === null
    ? null
    : countsThisGame ? sumBatterLines(batterBase, gameLineFromResults(results)) : batterBase

  return {
    batterHand,
    pitcher: {
      isComputer: false,
      ...(pitcherName === undefined ? {} : { name: pitcherName }),
      role: options.role,
      throwsLeft: pitcherHandOf(options.repertoire.form, false) === 1,
      stamina: staminaGaugeOf(myMoundStaminaOf(progress)),
      ...(myLine === null ? {} : pitcherCardStatsOf(myLine)),
    },
    batter: {
      isComputer: true,
      battingOrder: slot,
      recentResults: results,
      ...(batter.name === undefined ? {} : { name: batter.name }),
      ...(batter.position === undefined ? {} : { position: batter.position }),
      ...(batterLine === null ? {} : batterCardStatsOf(batterLine)),
    },
  }
}
