import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { opponentMoundOf } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MY_RECORD_SLOT, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { leaguePitcherIdOf, leaguePitcherLineOf } from '@/entities/league/model/leaguePlayerStats'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { ACE_BATTER_ROSTER_SLOT } from '@/entities/league/model/leagueDay'
import {
  batterCardStatsOf,
  batterHandOf,
  pitcherCardStatsOf,
  pitcherLineOfRecord,
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
 *   + 이 경기 줄(`pitcherLines`, 같은 게이트). 마투수는 XlsACE_PIT 행의 줄 그대로(`aceRecordLine` — 게이트가 마선수를 거른다).
 * - 팀 글자 0xb6c20: 내 팀 PLAYER · 상대 COM.
 * `career.stats` 도 포스트시즌 경기의 레코드 줄(+0x20~+0x2c)은 안 더한다(`applyGameResult` 의 `withoutRecordLine`) — 원본 레코드처럼
 * 정규시즌 줄만 든다.
 */
export function gameMatchupCardsOf(progress: GameProgress, career: PlayerCareer): {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
} {
  const countsThisGame = career.postseason === null
  const mound = opponentMoundOf(progress)
  // 마투수는 XlsACE_PIT 행의 줄 그대로 — 게이트 0xa571c 가 마선수를 걸러 이 경기 줄이 없다(칸이 null 이라 아래 이 경기 줄도 0)
  const pitcherBase = mound.aceRecordLine !== undefined
    ? pitcherLineOfRecord(mound.aceRecordLine)
    : mound.pitcherSlot === null
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

/**
 * **경기 시작 인트로 배경의 타자 손 (타자편 모드 4)** — 인트로 진입 0x3b084 가 3b0f2 `0xae89d`(공격 팀 [+0xe + 팀[+0x32]]) →
 * 3b0fe `0xb63c1`(손) 을 3b108 에서 경기 구장 +0x60 에 쓴다(모드를 안 가린다). 공격 측은 경기 상태 초기화 0xb6814 의 st[9] = 0,
 * 팀[+0x32] 는 상태 7(0x3e340)이 0 으로 채워 새로 만든 팀 객체 그대로 0 이다(`pitcherIntroBatterHandOf` 주석) → **측 0 팀의 1번 타자**.
 * - 측 0 이 내 팀이면 나리 팀 레코드 명단 칸 0 — 내 줄(타순 1번)이면 내 손 `battingSide`, 마타자 칸이면 표 0xd88b0, 그 밖은 붙박이 표 행 +0xb.
 *   진행기는 경기를 세울 때 첫 내 타석까지 밀어 두지만 1번 칸은 그 사이 한 번밖에 안 서고 CPU 대타 0xac228 은 타석 2번(ac28e) 뒤라
 *   명단 칸 0 은 시작 그대로다.
 * - 측 0 이 상대 팀이면 웹 상대 명단(로스터 차례, 마타자는 9번)의 1번 = 로스터 0번.
 */
export function gameIntroBatterHandOf(progress: GameProgress, career: Pick<PlayerCareer, 'battingSide'>): number {
  if (progress.game.playerSide !== 0) {
    const profile = teamBatters(progress.opponentTeamId)[0]?.profile
    return profile === undefined ? 0 : batterHandOf(profile)
  }
  if (progress.game.playerOrderIndex === 0) return career.battingSide
  const slot = rosterSlotAt(progress.ourLineup, 0)
  if (slot === ACE_BATTER_ROSTER_SLOT) return batterHandOf(0, progress.aces?.ours.batter ?? -1)
  const roster = teamBatters(progress.ourTeamId)
  const profile = roster[slot % roster.length]?.profile
  return profile === undefined ? 0 : batterHandOf(profile)
}
