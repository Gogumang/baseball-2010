import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { tradePenaltyOf, tradeRefusalOf } from '@/entities/season-mode/model/playerTrade'
import type { TradeRefusal } from '@/entities/season-mode/model/playerTrade'
import { TRADE_REQUEST_TAB, playerGradeOf } from '@/entities/season-mode/model/tradeRequest'
import { playerFaceOf } from '@/entities/season-mode/model/seasonEntry'

/**
 * 트레이드 화면(0xe5 영입 선수 · 0xe6 보상 선수)이 보여 줄 명단.
 *
 * 원본은 두 팀의 **선수 레코드**를 그대로 훑는다(`0x1f9a9(저장, 모드, 팀)` → 편집기 0x5561c). 웹은 내 팀 명단을 시즌
 * 저장(`roster`)에, CPU 팀 명단을 시즌 저장의 `cpuRosters`(트레이드로 바뀐 팀만 — 나머지는 붙박이 표, `tableRosterOf`)에
 * 두고 부르는 쪽이 넘긴다.
 *
 * 이름·+0x1b 는 그 선수의 **붙박이 표 팀**(`tableTeamOf` — 트레이드로 옮겨 온 선수는 옛 팀) 표의 id 번째에서 읽는다
 * (원본은 레코드 안 id 로 0xaa458 이름표를 본다 — 엔트리 편집기와 같은 `playerFaceOf`). 영입해 온 나리·명예 선수는 표에
 * 없어 기록 사본 이름, 그것도 없으면 `투수 N번` 이다.
 */

export interface TradePlayerEntry {
  /** 명단 안 첨자 */
  readonly index: number
  readonly name: string
  readonly player: SeasonPlayer
  /**
   * 선수 레코드 `+0x1b` (`RosterPlayer.grade`) — 성공률의 차이 항 `d` 와 성공 시 소지금 변화가 읽는다.
   * 표 밖 나리·명전 선수는 0(어차피 거절된다, `tradeRequest.playerGradeOf`).
   */
  readonly grade: number
  /** 자리 벌점 — 마스터 명단 칸 번호 `0xb6561` 를 탭별로 본 값 (`playerTrade.tradePenaltyOf`) */
  readonly penalty: number
  /** 나리·명예 선수면 트레이드 거절 (StrMODE[165]/[166]) */
  readonly refusal: TradeRefusal | null
}

/** 한 팀 레코드의 탭 명단 — 내 팀(0xe6)·상대 팀(0xe5) 모두 같은 규칙이다 */
export function tradeEntriesOf(
  teamId: number,
  roster: SeasonTeamRoster,
  isPitcher: boolean,
): readonly TradePlayerEntry[] {
  const players = isPitcher ? roster.pitchers : roster.batters
  const tab = isPitcher ? TRADE_REQUEST_TAB.투수 : TRADE_REQUEST_TAB.타자
  return players.map((player, index) => ({
    index,
    name: playerFaceOf(teamId, player, isPitcher, index).name,
    player,
    grade: playerGradeOf(teamId, tab, player),
    penalty: tradePenaltyOf(player, teamId, tab),
    refusal: tradeRefusalOf(player),
  }))
}

/** 상대 팀 명단 (0xe5) — 시즌 저장의 그 팀 레코드 */
export function opponentTradeEntriesOf(
  teamId: number,
  roster: SeasonTeamRoster,
  isPitcher: boolean,
): readonly TradePlayerEntry[] {
  return tradeEntriesOf(teamId, roster, isPitcher)
}

/** 내 팀 명단 (0xe6) — 시즌 세이브의 명단. 나리·명예 선수는 고를 때 걸러진다 */
export function myTradeEntriesOf(
  teamId: number,
  roster: SeasonTeamRoster,
  isPitcher: boolean,
): readonly TradePlayerEntry[] {
  return tradeEntriesOf(teamId, roster, isPitcher)
}
