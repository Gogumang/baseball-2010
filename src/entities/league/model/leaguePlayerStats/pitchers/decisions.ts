import type {
  LeaguePitcherAppearance,
  LeaguePitcherDecision,
  LeaguePitcherGameLine,
  LeaguePitcherOfRecord,
} from '@/entities/league/model/leaguePlayerStats/types/events'

/** 경기 끝 0xa7de8 이 판정을 매긴 투수 셋 — 승 · 패 · 세 */
interface PitchersOfRecord {
  readonly winner: LeaguePitcherOfRecord | null
  readonly loser: LeaguePitcherOfRecord | null
  readonly save: LeaguePitcherOfRecord | null
}

/** 판정도 줄도 쌓지 않는 칸 — 마선수 8번처럼 다음 경기에 덮이는 칸 */
type PitcherSkip = (teamId: number, pitcherSlot: number, recordId?: number) => boolean

/** 붙이는 차례 — 승 · 패 · 세 */
const DECISION_ORDER: readonly (readonly [keyof PitchersOfRecord, LeaguePitcherDecision])[] = [
  ['winner', '승'],
  ['loser', '패'],
  ['save', '세'],
]

/** 판정 받은 투수에게 붙일 0 줄 — 던지지 않았거나 그 줄이 이미 다른 판정을 받았다 */
function zeroAppearanceOf(teamId: number, record: LeaguePitcherOfRecord, decision: LeaguePitcherDecision): LeaguePitcherAppearance {
  return {
    teamId,
    pitcherSlot: record.pitcherSlot,
    outs: 0,
    runsAllowed: 0,
    strikeouts: 0,
    pitches: 0,
    decision,
    ...(record.recordId === undefined ? {} : { recordId: record.recordId }),
  }
}

/** 판정 하나를 붙인다 — 같은 팀 · 칸 · id 의 첫 줄이 판정 없으면 그 줄에, 아니면 0 줄을 하나 더 (배열을 고친다) */
function applyDecision(appearances: LeaguePitcherAppearance[], teamId: number, record: LeaguePitcherOfRecord, decision: LeaguePitcherDecision): void {
  const index = appearances.findIndex(
    (appearance) => appearance.teamId === teamId && appearance.pitcherSlot === record.pitcherSlot && appearance.recordId === record.recordId,
  )
  const found = index < 0 ? undefined : appearances[index]
  if (found !== undefined && found.decision === null) {
    appearances[index] = { ...found, decision }
    return
  }
  appearances.push(zeroAppearanceOf(teamId, record, decision))
}

/**
 * 한 경기의 투수 줄에 경기 끝 판정(0xa7de8)을 붙인다 — CPU 끼리 경기(`simulateLeagueGame`)와 사람 경기 요약이
 * 같이 쓴다. `teamOfSide(측)` 은 그 측(state 칸)에서 **던진** 팀 번호다.
 *
 * 판정 받은 투수에게 줄이 없으면(던지지 않았는데 그 순간 마운드에 서 있던 투수) 0 줄을 하나 만들어 붙이고,
 * 이미 다른 판정을 받은 줄이면 0 줄을 하나 더 붙인다 — 원본은 레코드 칸을 따로 올리므로 둘 다 남는다.
 * `skip` 이 참인 칸(마선수 8번처럼 다음 경기에 덮이는 칸)은 판정도 줄도 쌓지 않는다.
 */
export function leaguePitcherAppearancesOf(
  lines: readonly LeaguePitcherGameLine[],
  decisions: PitchersOfRecord,
  teamOfSide: (side: number) => number,
  skip: PitcherSkip = () => false,
): LeaguePitcherAppearance[] {
  const appearances: LeaguePitcherAppearance[] = lines
    .filter((line) => !skip(line.teamId, line.pitcherSlot, line.recordId))
    .map((line) => ({ ...line, decision: null }))
  for (const [key, decision] of DECISION_ORDER) {
    const record = decisions[key]
    if (record === null) continue
    const teamId = record.teamId ?? teamOfSide(record.side)
    if (skip(teamId, record.pitcherSlot, record.recordId)) continue
    applyDecision(appearances, teamId, record, decision)
  }
  return appearances
}
