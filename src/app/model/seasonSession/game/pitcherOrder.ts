import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay'
import { SEASON_MODE, cpuGameRotationAdvances, advanceRotation } from '@/entities/pitcher-career/model/pitcherRotation'
import { type League, rotateLeaguePitchers, pitcherOrderOf, UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'

/**
 * 경기 끝 스태미나를 되적는다 — 내 팀은 명단 차례(요약 `ourPitcherStaminas`), 상대는 표 칸 차례.
 * 요약에 없는 칸은 그대로 둔다.
 */
/**
 * 시즌 CPU 경기의 경기용 능력치 갈래 (`0xb570c` 모드 2) — 팀 능력치 정액 `0xb592c`(시즌 기록의 10팀 네 칸)와
 * 코치 `0xb5a74`(SR+0x185, 팀 검사 없음). 리그 CPU 경기 교체의 마무리 후보 정렬(능력 합 `0xb5b50`)이 쓴다 (27f02c7).
 * 간이 타석도 같은 갈래다 — 스윙 0xab214 가 타자 히트·파워를 `0xb570d(팀, k, 타자, 1, 0x5a, 1)`(ab4ce·ab4fe), 0xc11f0 이 주력을
 * `0xb570d(…, 3, …, 0x5a, 1)`(c152e) 로 읽어 팀 정액·코치를 먹는다 (`cpuBatterGameAbilityOf`, f3ba9d1).
 */
export function seasonAbilityContextOf(state: SeasonState): LeagueAbilityContext {
  return { mode: SEASON_MODE, teamAbilities: state.teamAbilities, coach: state.record.coach, coachTeamId: state.record.teamId }
}

/**
 * 정규시즌 사람 경기 그 팀의 **오늘 선발 칸** — 리그가 들고 다니는 투수 레코드 차례(`League.pitcherOrders`)의 0번.
 *
 * 원본 경기 준비 `0x6548`(670e~673e)은 g ≠ 0 이면 두 팀 레코드를 `0xb5ca8` 로 한 칸 돌린 뒤 0번을 세운다. 웹은 그
 * 한 칸을 경기가 끝난 뒤 `playLeagueDay`(`rotatesHumanGameTeams`)가 리그 차례에 넣으므로, 경기 전에는 여기서 미리
 * 한 칸 돌려 본다. 차례는 지난 시즌·포스트시즌에서 이어진다(`nextSeasonLeague`) — 첫 해 정규시즌에서만 `g % 4` 와 같다.
 */
export function seasonLeagueStarterSlotOf(league: League, team: number, day: number): number {
  return seasonLeaguePitcherOrderOf(league, team, day)[0] ?? 0
}

/**
 * 정규시즌 사람 경기를 준비했을 때 그 팀의 **투수 레코드 차례 전체** — 0번이 선발, 나머지가 교체 `0xabfcc` 의 벤치 차례.
 * `seasonLeagueStarterSlotOf` 와 같이 g ≠ 0 이면 `0x6548`(670e~673e)의 한 칸을 미리 돌려 본다.
 */
export function seasonLeaguePitcherOrderOf(league: League, team: number, day: number): readonly number[] {
  const prepared = cpuGameRotationAdvances(SEASON_MODE, day) ? rotateLeaguePitchers(league, [team]) : league
  return pitcherOrderOf(prepared, team)
}

/**
 * 국가대항전 상대국 슬롯(+0x934)의 투수 레코드 차례 — 하루마다 마스터에서 새로 덮이고(0xb818c b8216 → 0x20648) 그날
 * 경기 준비 `0x6548` 이 g ≠ 0 이면 한 칸 돌린다 → 첫날 `[0..7]`, 그 뒤로는 늘 `[1,2,3,0,4..7]` (7dd3826).
 */
export function nationalCupOpponentPitcherOrderOf(cupDay: number): readonly number[] {
  return cupDay === 0 ? UNSHUFFLED_PITCHER_ORDER : advanceRotation(UNSHUFFLED_PITCHER_ORDER)
}
