import { slotOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  batterPositionPenaltyOf, tradeRefusalOf,
} from '@/entities/season-mode/model/playerTrade'
import type { TradeRefusal } from '@/entities/season-mode/model/playerTrade'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'

/**
 * 트레이드 화면(0xe5 영입 선수 · 0xe6 보상 선수)이 보여 줄 명단.
 *
 * 원본은 두 팀의 **선수 레코드**를 그대로 훑지만(`0x1f9a9(저장, 칸, 팀)`), 웹은
 *   - 내 팀만 시즌 세이브에 명단(`SeasonTeamRoster`)을 들고 있고,
 *   - CPU 팀은 붙박이 표(`shared/config/original/data/roster.json`)뿐이다.
 * 그래서 상대 팀 줄은 표에서 그때그때 만든다 — **근사다**(`useSeasonSession` 의 `rosterOf` 와 같은 자세).
 *
 * 이름도 마찬가지다: 시즌 명단의 선수는 칸 번호(`+0xa & 0x1f`)만 들고 있어 붙박이 표에서
 * 같은 칸의 이름을 빌려 온다. 영입해 온 나리·명예 선수는 표에 없어 `투수 N번` 으로 적힌다
 * (선수영입 화면과 같은 한계).
 */

export interface TradePlayerEntry {
  /** 명단 안 첨자 */
  readonly index: number
  readonly name: string
  readonly player: SeasonPlayer
  /**
   * 원본 등급 바이트 `+0x1b` 자리. ⚠️ 웹 선수 표에 이 칸이 없어 **늘 0** 이다
   * — 성공률의 차이 항 `d` 가 0 이 된다 (`playerTrade.ts` 머리 주석).
   */
  readonly grade: number
  /** 자리 벌점 (타자는 수비 자리, 투수는 보직 — 웹에 보직이 없어 투수는 0) */
  readonly penalty: number
  /** 나리·명예 선수면 트레이드 거절 (StrMODE[165]/[166]) */
  readonly refusal: TradeRefusal | null
}

/** 웹 선수 표에 등급 칸(`+0x1b`)이 없다 — 양쪽 모두 이 값으로 본다 */
export const UNKNOWN_GRADE = 0

const fallbackNameOf = (isPitcher: boolean, slot: number) =>
  `${isPitcher ? '투수' : '타자'} ${slot + 1}번`

/**
 * 상대 팀 명단 (0xe5) — 붙박이 표에서 만든다.
 * 칸 번호·id 는 표의 첨자를 그대로 쓴다 (`rosterOf` 와 같은 규칙).
 */
export function opponentTradeEntriesOf(teamId: number, isPitcher: boolean): readonly TradePlayerEntry[] {
  const table = isPitcher ? teamPitchers(teamId) : teamBatters(teamId)
  return table.map((player, index) => ({
    index,
    name: player.name,
    player: { id: index, kindByte: index, fieldPosition: 0, stamina: 0 },
    grade: UNKNOWN_GRADE,
    // 붙박이 표에는 수비 자리 칸이 없어 0 이다 (타자 자리 0 → 벌점 10)
    penalty: isPitcher ? 0 : batterPositionPenaltyOf(0),
    refusal: null,
  }))
}

/** 내 팀 명단 (0xe6) — 시즌 세이브의 명단. 나리·명예 선수는 여기서 걸러진다 */
export function myTradeEntriesOf(
  teamId: number,
  roster: SeasonTeamRoster,
  isPitcher: boolean,
): readonly TradePlayerEntry[] {
  const players = isPitcher ? roster.pitchers : roster.batters
  const table = isPitcher ? teamPitchers(teamId) : teamBatters(teamId)
  return players.map((player, index) => {
    const slot = slotOf(player)
    return {
      index,
      name: table[slot]?.name ?? fallbackNameOf(isPitcher, slot),
      player,
      grade: UNKNOWN_GRADE,
      penalty: isPitcher ? 0 : batterPositionPenaltyOf(player.fieldPosition & 0xf),
      refusal: tradeRefusalOf(player),
    }
  })
}
