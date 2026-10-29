import type { MissionRun } from '@/entities/mission/model/missionRun'
import { isMissionBatterUp } from '@/entities/mission/model/missionRun'
import { battingRecordAt, MISSION_NARI_RECORD_FALLBACK } from '@/entities/mission/model/missionGame'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { batterCardStatsOf, batterHandOf, batterLineOfRecord, sumBatterLines } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { ringOf, rosterBatterCardOf } from './cardParts'
import type { BatterCardCommon, MissionCardBatter, MissionMatchupCards } from './cardParts'
import { cpuMoundCardOf } from './cpuMoundCard'

/** 이 경기 미션 타자 줄 — 게이트 0xa5764 가 연 타석의 +0x20 타수 · +0x22 안타 · +0x28 홈런 · +0x2a 타점 (사건 0xa57f8 칸과 같은 판) */
function missionBatterGameLineOf(run: MissionRun): MatchupBatterLine {
  const { counts } = run.progress
  return {
    atBats: run.progress.atBats ?? 0,
    hits: counts['안타'] ?? 0,
    homeRuns: counts['홈런'] ?? 0,
    runsBattedIn: counts['타점'] ?? 0,
  }
}

/**
 * 미션 타자의 수비 칸 — 0xb53f0 b54b6~b5520 이 넣기 전 레코드[k] 의 +0x1c 를 옮긴 것(k = `humanRecordSlot`) — 마스터 줄 k 의 수비다.
 * 끝 칸(12)은 0xb4e34 가 늘린 새 칸이다 — 새 배열의 칸마다 0xb8de4 가 0x30 바이트를 0 으로 지운 뒤(memset 0x1400428) 옛 칸만
 * 베끼므로(b4f6e) 옛 레코드[12]+0x1c = 0 → 수비 0 (직접 뜬 것). k > 12 는 웹이 12 로 둔다(`missionRecordSlotOf`).
 * k 를 모르면(부르는 쪽이 안 넘김) 비운다
 */
function missionBatterPositionOf(run: MissionRun): number | undefined {
  const k = run.game.humanRecordSlot
  if (k === undefined) return undefined
  if (k >= MISSION_NARI_RECORD_FALLBACK) return 0
  return teamBatters(run.game.humanBatting.teamId)[k]?.position
}

/** 미션 타자 판 — 기록 줄에 이 경기 줄을 더한다 */
function missionBatterCardOf(run: MissionRun, missionBatter: MissionCardBatter, common: BatterCardCommon): MatchupBatterCard {
  const position = missionBatterPositionOf(run)
  const line =
    missionBatter.recordLine === undefined ? null : sumBatterLines(batterLineOfRecord(missionBatter.recordLine), missionBatterGameLineOf(run))
  return {
    ...common,
    ...(missionBatter.name === null ? {} : { name: missionBatter.name }),
    ...(position === undefined ? {} : { position }),
    ...(line === null ? {} : batterCardStatsOf(line)),
  }
}

/**
 * **타자 미션의 소개 판** — 지금 사람 칸 타순이 미션 타자면 그 선수(이 경기 줄을 더한다), 아니면 사람 칸 팀 마스터 줄(표값).
 */
export function missionBatterMatchupCardsOf(
  run: MissionRun,
  missionBatter: MissionCardBatter,
  aceLevels?: Readonly<Record<number, number>>,
): MissionMatchupCards {
  const batting = run.game.humanBatting
  const slot = lineupSlotOf(batting.order)
  const common = { isComputer: false, battingOrder: slot, recentResults: ringOf(batting.lineup.records, slot) }
  const pitcher = cpuMoundCardOf(run, aceLevels)
  if (isMissionBatterUp(run)) return { batterHand: missionBatter.hand, pitcher, batter: missionBatterCardOf(run, missionBatter, common) }
  const player = teamBatters(batting.teamId)[battingRecordAt(batting)]
  if (player === undefined) return { batterHand: 0, pitcher, batter: common }
  return { batterHand: batterHandOf(player.profile), pitcher, batter: rosterBatterCardOf(player, common) }
}
