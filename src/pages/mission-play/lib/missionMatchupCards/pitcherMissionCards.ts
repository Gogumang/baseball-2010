import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionCpuBatterOf, missionRecordNibbleRowOf } from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuBatting } from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import {
  batterCardStatsOf,
  batterHandOf,
  batterLineOfRecord,
  pitcherCardStatsOf,
  pitcherLineOfRecord,
  staminaGaugeOf,
  sumPitcherLines,
} from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupPitcherLine } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { ringOf, rosterBatterCardOf } from './cardParts'
import type { BatterCardCommon, MissionCardPitcher, MissionMatchupCards } from './cardParts'

/**
 * 이 경기 미션 투수 줄 — +0x20 잡은 아웃(정산 a8cca 의 결과 코드 5 · 0xd 수 = R+0x13c 와 같은 콜) · +0x22 실점(a8ef4, R+0x128 과 같은
 * 주자 루프 — 미션 투수는 0xb6388 도 참) · +0x26 탈삼진(R+0x134 와 같은 판)
 */
function missionPitcherGameLineOf(run: PitcherRun): MatchupPitcherLine {
  return {
    outs: run.progress.counts['아웃'] ?? 0,
    runsAllowed: run.allowed.runs,
    strikeouts: run.progress.counts['탈삼진'] ?? 0,
  }
}

/** 미션 투수 판 — 기록 줄에 이 경기 줄을 더한다 */
function missionPitcherCardOf(run: PitcherRun, missionPitcher: MissionCardPitcher): MatchupPitcherCard {
  const line =
    missionPitcher.recordLine === undefined ? null : sumPitcherLines(pitcherLineOfRecord(missionPitcher.recordLine), missionPitcherGameLineOf(run))
  return {
    isComputer: false,
    ...(missionPitcher.name === null ? {} : { name: missionPitcher.name }),
    ...(missionPitcher.role === undefined ? {} : { role: missionPitcher.role }),
    throwsLeft: pitcherHandOf(missionPitcher.form, false) === 1,
    ...(line === null ? {} : pitcherCardStatsOf(line)),
    // 0xb8820 이 team+0x26 · +0x33 을 함께 +1 해 f = 1 — 미션은 '#' 교체가 막혀(0x38984) 내내 첫 투수다
    stamina: staminaGaugeOf({
      staminaAbility: missionPitcher.staminaAbility,
      teamMorale: teamRecordMoraleOf(run.game.humanBatting.teamId),
      isFirstPitcher: true,
      stamina: missionPitcher.stamina,
    }),
  }
}

/**
 * 마타자의 수비 — XlsACE_BAT 행 +0x1c 는 다섯 줄 모두 0 이지만, 0xaae7c 의 맞바꿈 0xb8cb8(팀, team+0x32, 9) → 0xb5e98(r3 = 0)이
 * 한쪽 자리가 0 이면 자리를 칸에 되써(b5f10~b5f4a) 마타자는 옛 그 칸 선수의 자리로 선다(`missionRecordNibbleRowOf`)
 */
function aceBatterPositionOf(batting: MissionCpuBatting): number {
  const row = missionRecordNibbleRowOf(batting.records, rosterSlotAt(batting.lineup, batting.order))
  return row === null || row < 0 ? 0 : (teamBatters(batting.teamId)[row]?.position ?? 0) & 0xf
}

/** 지금 타순에 끼운 마타자 — XlsACE_BAT 행 줄 · 손 표 0xd88b0 */
function aceBatterCardsOf(run: PitcherRun, batting: MissionCpuBatting, common: BatterCardCommon, pitcher: MatchupPitcherCard): MissionMatchupCards {
  const aceIndex = run.mission.opponentAce - 1
  const ace = missionOpponentOf('타자', run.mission.opponentAce)
  const hand = batterHandOf(0, aceIndex)
  if (ace === null) return { batterHand: hand, pitcher, batter: common }
  return {
    batterHand: hand,
    pitcher,
    batter: {
      ...common,
      name: ace.name,
      position: aceBatterPositionOf(batting),
      ...batterCardStatsOf(batterLineOfRecord(ace.recordLine)),
    },
  }
}

/** 투수 미션의 소개 판 — 미션 투수(이 경기 줄을 더한다)와 CPU 타선 지금 타자(마스터 줄 · 마타자, 표값) */
export function missionPitcherMatchupCardsOf(run: PitcherRun, missionPitcher: MissionCardPitcher): MissionMatchupCards {
  const pitcher = missionPitcherCardOf(run, missionPitcher)
  const batting = run.cpu.batting
  const cpuBatter = missionCpuBatterOf(run.cpu)
  if (batting === null || cpuBatter === null) return { batterHand: 0, pitcher, batter: { isComputer: true } }
  const slot = lineupSlotOf(batting.order)
  const common = { isComputer: true, battingOrder: slot, recentResults: ringOf(batting.lineup.records, slot) }
  if (cpuBatter.isAce) return aceBatterCardsOf(run, batting, common, pitcher)
  const player = cpuBatter.row
  if (player === null) return { batterHand: 0, pitcher, batter: common }
  return { batterHand: batterHandOf(player.profile), pitcher, batter: rosterBatterCardOf(player, common) }
}
