import { type TradeSwap, TRADE_TAB, swapTradedPlayers } from '@/entities/season-mode/model/playerTrade'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { cpuRosterOf, recordPitcherIndexOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/** 트레이드 화면·요청이 낸 레코드 칸을 명단 첨자로 — 투수 탭만 (타자 배열은 섞이지 않는다) */
export function rosterTradeSwapOf(save: SeasonSave, swap: TradeSwap): TradeSwap {
  if (swap.tab !== TRADE_TAB.투수) return swap
  const myTeamId = save.state.record.teamId
  return {
    ...swap,
    myIndex: recordPitcherIndexOf(save, myTeamId, save.roster, swap.myIndex),
    opponentIndex: recordPitcherIndexOf(save, swap.opponentTeamId, cpuRosterOf(save, swap.opponentTeamId), swap.opponentIndex),
  }
}

/**
 * 성공한 트레이드를 시즌 저장의 두 팀 레코드에 건다 — `swapTradedPlayers`(0xd1cc~0xd3ae).
 * 투수 스태미나(+0x2c)도 레코드째 옮겨 가므로, 상대 팀 칸은 `cpuPitcherStaminas`(표 칸 차례)에서 꺼내 실어 보내고
 * 받은 내 투수의 값을 그 칸에 되적는다.
 */
export function withTradeSwap(save: SeasonSave, swap: TradeSwap): SeasonSave {
  const myTeamId = save.state.record.teamId
  const opponent = swap.opponentTeamId
  const staminas = save.cpuPitcherStaminas?.[opponent] ?? teamPitchers(opponent).map(() => FULL_STAMINA)
  const theirs = cpuRosterOf(save, opponent)
  const swapped = swapTradedPlayers(
    myTeamId,
    {
      mine: save.roster,
      theirs: {
        ...theirs,
        pitchers: theirs.pitchers.map((player, index) => ({ ...player, stamina: staminas[index] ?? FULL_STAMINA })),
      },
    },
    swap,
  )
  return {
    ...save,
    roster: swapped.mine,
    cpuRosters: { ...save.cpuRosters, [opponent]: swapped.theirs },
    cpuPitcherStaminas: {
      ...save.cpuPitcherStaminas,
      [opponent]: swapped.theirs.pitchers.map((player) => player.stamina),
    },
  }
}
