import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { opponentMoundOf } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MY_RECORD_SLOT, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { leaguePitcherIdOf, leaguePitcherLineOf } from '@/entities/league/model/leaguePlayerStats'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import {
  batterCardStatsOf,
  pitcherCardStatsOf,
  staminaGaugeOf,
  sumBatterLines,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/**
 * **나리 타자편 상태 0xe 의 소개 판 값** (0x44944) — 내 타석에만 0xe 를 지난다(동료·상대 타석은 자동진행 0x21).
 *
 * - 타자 = 내 선수 레코드(저장 +0xbc 의 0x1f8d4): 타순 `팀+0x32` · 이름 · 수비 `+0x1c & 0xf`(내 팀 레코드의 내 줄) ·
 *   손 0xb63c0(`battingSide`) · 시즌 줄 = `career.stats`(웹이 내 레코드 +0x20~ 대신 세는 칸) + 이 경기 내 타석
 *   (기록 게이트 0xa56dc 모드 4 갈래 0xa571c: 포스트시즌·국가대항전이면 거짓) · 오늘 타석 기록 = 내 타순 칸 링.
 * - 투수 = 상대 마운드(`opponentMoundOf`): 이름 · 보직 · 손 · 체력 막대 · 시즌 줄 = 리그 기록표 줄(`career.leaguePlayerStats`)
 *   + 이 경기 줄(`pitcherLines`, 같은 게이트). 마투수는 표에 칸이 없어 시즌 줄을 비운다.
 * - 팀 글자 0xb6c20: 내 팀 PLAYER · 상대 COM.
 * ⚠️ 근사: 웹 `career.stats` 는 포스트시즌 경기도 더한다(applyGameResult) — 원본 레코드는 게이트가 막아 정규시즌 줄만 든다.
 */
export function gameMatchupCardsOf(progress: GameProgress, career: PlayerCareer): {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
} {
  const countsThisGame = career.postseason === null
  const mound = opponentMoundOf(progress)
  const pitcherBase = mound.pitcherSlot === null
    ? null
    : leaguePitcherLineOf(career.leaguePlayerStats, leaguePitcherIdOf(progress.opponentTeamId, mound.pitcherSlot))
  const pitcherGame = mound.pitcherSlot === null
    ? undefined
    : progress.pitcherLines.find(
        (line) =>
          line.teamId === progress.opponentTeamId && line.pitcherSlot === mound.pitcherSlot && line.recordId === undefined,
      )
  const pitcherLine = pitcherBase === null
    ? null
    : countsThisGame
      ? sumPitcherLines(pitcherBase, {
          outs: pitcherGame?.outs ?? 0,
          runsAllowed: pitcherGame?.runsAllowed ?? 0,
          strikeouts: pitcherGame?.strikeouts ?? 0,
        })
      : pitcherBase

  const myLine = countsThisGame ? sumBatterLines(career.stats, progress.myStats) : career.stats
  const myPosition = nariTeamRecordOf(nariTeamsOf(career), progress.ourTeamId).batters
    .find((batter) => batter.slot === MY_RECORD_SLOT)?.position
  const mySlot = lineupSlotOf(progress.game.battingOrderIndex)

  return {
    batterHand: career.battingSide,
    pitcher: {
      isComputer: true,
      ...(mound.name === undefined ? {} : { name: mound.name }),
      ...(mound.role === undefined ? {} : { role: mound.role }),
      ...(mound.throwsLeft === undefined ? {} : { throwsLeft: mound.throwsLeft }),
      stamina: staminaGaugeOf(mound),
      ...(pitcherLine === null ? {} : pitcherCardStatsOf(pitcherLine)),
    },
    batter: {
      isComputer: false,
      name: career.name,
      battingOrder: career.battingOrder - 1,
      ...(myPosition === undefined ? {} : { position: myPosition }),
      ...batterCardStatsOf(myLine),
      recentResults: progress.ourLineup.records[mySlot]?.results ?? [],
    },
  }
}
