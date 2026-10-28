import type { PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import { type MoundBySide, type PitcherOfRecordNames, pitcherOfRecordNamesOf } from '@/features/play-game/model/gameDecisions'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 판정 칸(측 · 명단 칸)을 붙박이 표 칸으로 — 표 칸이 없는 투수(마투수)는 표 밖 칸(8)으로 둬 기록표가 건너뛴다 */
export function decisionTableSlotOf(progress: TeamGameProgress, record: PitcherOfRecord | null): PitcherOfRecord | null {
  if (record === null) return null
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  const tableSlot = entry === undefined || entry.aceIndex >= 0 ? undefined : entry.tableSlot
  return { side: record.side, number: tableSlot ?? PITCHERS_PER_TEAM }
}

/** 판정 받은 투수의 붙박이 표 팀 — 트레이드로 옮겨 온 투수만(그 밖은 측의 팀이라 undefined) */
function decisionTableTeamOf(progress: TeamGameProgress, record: PitcherOfRecord | null): number | undefined {
  if (record === null) return undefined
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  return entry === undefined || entry.aceIndex >= 0 ? undefined : entry.tableTeamId
}

/** 판정 받은 투수가 표 밖 투수(영입한 명전·나리)면 그 원본 id */
function decisionRecordIdOf(progress: TeamGameProgress, record: PitcherOfRecord | null): number | undefined {
  if (record === null) return undefined
  const isOurs = record.side === progress.game.playerSide
  const entry = (isOurs ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[record.number]
  return entry === undefined || entry.aceIndex >= 0 || entry.tableSlot !== undefined ? undefined : entry.recordId
}

type DecisionKeys = { readonly winner?: number; readonly loser?: number; readonly save?: number }

/** 판정 셋에서 칸 하나씩 — 하나도 없으면 undefined (요약에 칸째 안 싣는다 — 예전 모양 그대로) */
function decisionKeysOf(
  ended: { readonly winner: PitcherOfRecord | null; readonly loser: PitcherOfRecord | null; readonly save: PitcherOfRecord | null },
  keyOf: (record: PitcherOfRecord | null) => number | undefined,
): DecisionKeys | undefined {
  const winner = keyOf(ended.winner)
  const loser = keyOf(ended.loser)
  const save = keyOf(ended.save)
  if (winner === undefined && loser === undefined && save === undefined) return undefined
  return {
    ...(winner === undefined ? {} : { winner }),
    ...(loser === undefined ? {} : { loser }),
    ...(save === undefined ? {} : { save }),
  }
}

/** 판정 셋의 표 팀(트레이드로 옮겨 온 투수)·원본 id(표 밖 투수) — 없는 칸은 싣지 않는다 */
export function decisionTableTeamsOf(
  progress: TeamGameProgress,
  ended: { readonly winner: PitcherOfRecord | null; readonly loser: PitcherOfRecord | null; readonly save: PitcherOfRecord | null },
): Pick<GameLeaguePitchers, 'decisionTableTeams' | 'decisionRecordIds'> {
  const tableTeams = decisionKeysOf(ended, (record) => decisionTableTeamOf(progress, record))
  const recordIds = decisionKeysOf(ended, (record) => decisionRecordIdOf(progress, record))
  return {
    ...(tableTeams === undefined ? {} : { decisionTableTeams: tableTeams }),
    ...(recordIds === undefined ? {} : { decisionRecordIds: recordIds }),
  }
}

/** 측별 지금 마운드 투수 칸 — 승·패·세 칸이 "그 순간 마운드에 선 투수" 로 적는다 */
export function moundsOf(progress: TeamGameProgress): MoundBySide {
  return { our: progress.ourPitcherIndex, opponent: progress.opponentPitcherIndex }
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다(`0xb62c0(0xb8b60(팀[측], 번호))`). 측 2(없음)면 그 줄은 빈다.
 */
export function pitchersOfRecordOf(progress: TeamGameProgress): PitcherOfRecordNames {
  return pitcherOfRecordNamesOf(
    progress.decisions,
    progress.game.playerSide,
    (isOurTeam, index) => (isOurTeam ? progress.ourPitcherEntry : progress.opponentPitcherEntry)[index]?.name,
  )
}
