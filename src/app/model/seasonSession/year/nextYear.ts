import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { DEFAULT_TEAM_MORALE, teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { type SeasonSceneState, SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { isFinalYear, startNextYear } from '@/entities/season-mode/model/seasonRecord'
import { judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { pitcherOrdersAfterPostseason, nextSeasonLeague } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { applyCpuEquipment, rollCpuEquipment } from '@/entities/season-mode/model/cpuEquipment'
import { cpuRosterOf, recordPitcherIndexOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/**
 * 새 해 `0x6e0c` — 결산을 닫은 뒤(국가대항전이 없는 해)와 **국가대항전 결과 팝업을 닫은 뒤**(`0x896c` →
 * `0x8a56`/`0x8b10` 보상 → `0x8b88: bl 0x6e0c`) 두 자리가 같은 함수를 부른다.
 *
 * ```
 * e = 0xa3084(SR)                 ; 연차 idx 가 9(isFinalYear)가 아니면 −1
 * e ≥ 0: 저장+0xa0+e = 1, phase = 6, 저장, 이벤트 500 → 0xd3 → 0xf5(엔딩)
 * e < 0: phase = 1 · 0xa305c(리그 초기화) · 연차 +1 · 사기 100 · SR+0x187 = 0 · 0x665e8(CPU 장비) · CPU 9팀 +30 → 0xc9
 * ```
 * 리그 초기화 `0xa305c → 0xb7b34` 가 **L = SR+0x80 을 0xf8 바이트 memset** 하므로 국가대항전 플래그
 * `SR+0x12c`(= L+0xac)도 여기서 0 이 된다 — `startNextYear` 주석 참고.
 */
/** 상태판 사기(`UseSeasonSession.statusBoardMorale`) — 대회 중이면 상대국 슬롯 +2 = 그날 상대국 표값, 아니면 리그 내 팀 사기 */
export function statusBoardMoraleOf(save: SeasonSave): number {
  if (!save.state.record.nationalCup) return save.state.teamMorale
  const opponent = save.cup === undefined || save.cup === null ? null : (nationalCupMatchupOf(save.cup)?.opponent ?? null)
  return opponent === null ? DEFAULT_TEAM_MORALE : teamRecordMoraleOf(opponent)
}

export function nextYearOf(save: SeasonSave, random: RandomPort): { readonly save: SeasonSave; readonly scene: SeasonSceneState } {
  const { record } = save.state
  // 0x6e0c 머리 — 마지막 해(연차 idx 9)면 새 해 대신 **엔딩**이다.
  // `judgeSeasonEnding` 이 0~4 를 돌려주는 해가 곧 `isFinalYear` 인 해라 둘은 같은 조건이다.
  if (isFinalYear(record) && judgeSeasonEnding(record) !== null) {
    return {
      save: { ...save, state: { ...save.state, record: { ...record, phase: SEASON_PHASE.엔딩 } } },
      scene: SEASON_SCENE_STATE.엔딩,
    }
  }
  // 새 해로 넘어가며 리그 전적·선수 성적을 비운다 (정규시즌 표는 해마다 새로 센다).
  // 투수 레코드 차례는 잇는다 — 리그 초기화 0xb7b34 는 L(SR+0x80)만 지우고 팀 저장 레코드(0x1f570)는 다시 짓지
  // 않으므로 0xb5ca8 로 섞인 차례(정규시즌 + 포스트시즌 시리즈에서 돈 칸)가 새 해로 남는다 (3eb7301)
  const series = save.series ?? null
  const pitcherOrders = series === null ? save.league.pitcherOrders : pitcherOrdersAfterPostseason(series, save.league.pitcherOrders)
  const started: SeasonSave = {
    ...save,
    state: startNextYear(save.state),
    league: nextSeasonLeague(pitcherOrders),
    playerStats: EMPTY_LEAGUE_PLAYER_STATS,
    series: null,
    ranking: [],
  }
  // 0x6ec6 `0x665e8(g, 새 연차, 내 팀)` — 연차 문턱마다 CPU 아홉 팀의 정해진 선수 장비 니블을 굴려 쓴다(`rollCpuEquipment`,
  // 줄마다 팀마다 rand(0, 2)). 투수 칸은 레코드 차례라 새 리그(이어진 로테이션 차례)로 명단 첨자를 찾는다.
  // 장비 니블은 명단 차례(`seasonEntryOrderOf` → 팀 경기)·CPU 레코드(`cpuLeagueRecordOf` → 간이 경기)에 실려 0xb6414 보너스로 먹는다
  const equipped = applyCpuEquipment(
    rollCpuEquipment(random, started.state.record.yearIndex, record.teamId),
    (team) => cpuRosterOf(started, team),
    (team, roster, recordIndex) => recordPitcherIndexOf(started, team, roster, recordIndex),
  )
  return {
    save: Object.keys(equipped).length === 0 ? started : { ...started, cpuRosters: { ...started.cpuRosters, ...equipped } },
    scene: SEASON_SCENE_STATE.관리메뉴,
  }
}
