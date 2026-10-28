import { isAcePlayer } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

type BurstGameRecord = { readonly hitsInGame: number; readonly homeRunsInGame: number; readonly strikeoutsInGame: number }

/**
 * 돌발 경기 기록 검사 `0x8ec9c`(b6·b7)가 보는 세 값 — 돌발 객체의 state(+0x22c)·팀 표(+0x230)로 읽는다:
 * ```
 * 8ecbe  b6 == 1: team = 팀[state[9]](공격) ; rec = team + 0x34 + team[0x32]·0x18 ; rec[+0x12]   ; 그 타순 칸 안타
 * 8ece8  b6 == 2:                                 같은 rec 의 [+0x13]                            ; 그 타순 칸 홈런
 * 8ed14  b6 == 3: team = 팀[state[0xa]](수비) ; 0xb8cec(team)[0]                                ; 지금 투수 경기 탈삼진
 * ```
 * `+0x13` 은 정산 `0xa8024` 의 안타 갈래 a874c 가 `[sp+0x24] > 0` 일 때 올린다 — sp+0x24 는 홈런 이벤트(8)·그라운드
 * 홈런(state[0x25])이 세는 **홈런 수**다(a80a8 · E-defense 1e, 바로 뒤가 한 타자 홈런 0xa7b00·대타 홈런 5).
 * `0xb8cec` 는 `team + 0x244 + 4·team[0]` — 지금 마운드 투수의 경기 기록이고 R[0] 이 탈삼진이다(`recordTally` 주석).
 *
 * 웹 칸: 안타·홈런 = 타순 칸 기록 `+0x12`·`+0x13`(`*EntryRecords[칸].hits`·`.homeRuns` — 양 팀 같은 칸),
 * 우리 투수 탈삼진 = `recordTally.moundStrikeouts`(교체 때 0), 상대 투수 탈삼진 = 그 투수의 경기 줄(`pitcherLines`).
 *
 * **상대 마투수의 탈삼진**은 마투수가 붙박이 표 칸이 없어 경기 줄에서 빠지므로 `opponentAceStrikeouts` 로 따로 센다(r278).
 * 시즌 표(XlsSEASON_BURST 56행)에는 b6 ≠ 0 인 행이 하나도 없어 지금 경기 결과는 바뀌지 않는다 (b6 은 타자·투수편 표만 쓴다).
 */
export function burstGameRecordOf(progress: TeamGameProgress, humanBatting: boolean): BurstGameRecord {
  return humanBatting ? ourBattingBurstRecordOf(progress) : opponentBattingBurstRecordOf(progress)
}

/** 사람이 친다 — 우리 타순 칸 안타 · 홈런, 상대 마운드 투수 탈삼진 */
function ourBattingBurstRecordOf(progress: TeamGameProgress): BurstGameRecord {
  const record = progress.ourEntryRecords[progress.game.battingOrderIndex]
  return {
    hitsInGame: record?.hits ?? 0,
    homeRunsInGame: record?.homeRuns ?? 0,
    strikeoutsInGame: opponentMoundStrikeoutsOf(progress),
  }
}

/** 사람이 던진다 — 상대 타순 칸 안타 · 홈런, 우리 마운드 투수 탈삼진(교체 때 0) */
function opponentBattingBurstRecordOf(progress: TeamGameProgress): BurstGameRecord {
  const record = progress.opponentEntryRecords[progress.opponentOrderIndex]
  return {
    hitsInGame: record?.hits ?? 0,
    homeRunsInGame: record?.homeRuns ?? 0,
    strikeoutsInGame: progress.recordTally.moundStrikeouts,
  }
}

/** 상대 마운드 투수의 경기 탈삼진 — 마투수는 따로 센 칸, 붙박이 투수는 그 투수의 경기 줄, 표 칸이 없으면 0 */
function opponentMoundStrikeoutsOf(progress: TeamGameProgress): number {
  const teamId = progress.options.opponentTeamId
  const entry = pitcherEntryAt(progress, teamId, progress.opponentPitcherIndex)
  if (entry === undefined) return 0
  if (isAcePlayer(entry)) return progress.opponentAceStrikeouts
  if (entry.tableSlot === undefined) return 0
  const lineTeamId = entry.tableTeamId ?? teamId
  const line = progress.pitcherLines.find((candidate) => candidate.teamId === lineTeamId && candidate.pitcherSlot === entry.tableSlot)
  return line?.strikeouts ?? 0
}
