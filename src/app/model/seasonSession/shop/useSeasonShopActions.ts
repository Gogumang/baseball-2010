import { useCallback } from 'react'
import {
  applySeasonSubItem,
  SEASON_STAMINA_ITEM,
  seasonGpItemPriceOf,
  applySeasonGpItem,
  FULL_PITCHER_STAMINA,
  seasonShopTextOf,
  SEASON_SHOP_TEXT,
} from '@/entities/season-mode/model/seasonItemShop'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { recordPitcherIndexOf } from '@/app/model/seasonSession/roster/roster'
import { rosterTradeSwapOf, withTradeSwap } from '@/app/model/seasonSession/roster/tradeSwap'
import type { SeasonEquipPurchase } from '@/app/model/seasonSession/types/actions'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useGamePointPurse } from '@/app/model/seasonSession/state/useGamePointPurse'
import {
  isAceStaminaFull,
  payStaminaItem,
  staminaTargetOf,
  withAceStaminaFull,
  withPitcherStaminaFull,
} from '@/app/model/seasonSession/shop/staminaRecovery'

/** 장비 · 상점 아이템 · 스태미나 회복 · 트레이드 정산 */
export function useSeasonShopActions(scope: SeasonScope) {
  const { atoms, random, recordStat } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const { commit } = useSeasonSaveWriters(scope)
  const { spendGamePoint } = useGamePointPurse(scope)
  /**
   * 트레이드 진행 결과 (0xe7 — `docs/re/J-modes-rules.md` 4-4).
   *
   * 레코드(SR+0x56)·명단·G(저장+0x64)가 한꺼번에 바뀌므로 **한 번에 커밋한다** —
   * `updateRecord` 와 `updateRoster` 를 잇달아 부르면 같은 `save` 를 보고 한쪽이 덮인다.
   */
  const equipSeasonPlayer = useCallback(
    (purchase: SeasonEquipPurchase) => {
      const current = atoms.get(saveAtom)
      if (current === null) return
      const myTeamId = current.state.record.teamId
      const rosterIndex = purchase.isPitcher ? recordPitcherIndexOf(current, myTeamId, current.roster, purchase.recordIndex) : purchase.recordIndex
      const players = purchase.isPitcher ? current.roster.pitchers : current.roster.batters
      if (players[rosterIndex] === undefined) return
      const replaced = players.map((player, index) =>
        index === rosterIndex
          ? {
              ...player,
              equipment: purchase.equipment,
              ...(purchase.ownedEquipment === undefined ? {} : { ownedEquipment: purchase.ownedEquipment }),
            }
          : player,
      )
      commit({
        ...current,
        state: { ...current.state, record: { ...current.state.record, money: purchase.money } },
        roster: purchase.isPitcher ? { ...current.roster, pitchers: replaced } : { ...current.roster, batters: replaced },
      })
    },
    [atoms, commit],
  )
  const buySeasonSubItem = useCallback(
    (slot: number) => {
      const current = atoms.get(saveAtom)
      if (current === null) return ''
      const applied = applySeasonSubItem(current.state.record, slot)
      commit({ ...current, state: { ...current.state, record: applied.record } })
      return applied.notice
    },
    [atoms, commit],
  )
  const buySeasonGpItem = useCallback(
    (slot: number) => {
      const current = atoms.get(saveAtom)
      if (current === null || slot === SEASON_STAMINA_ITEM) return null
      // 0x8034~0x8058: G 를 빼고 0x22c29(3, 값) — spendGamePoint 가 같은 차례로 적는다
      spendGamePoint(seasonGpItemPriceOf(slot))
      const effect = applySeasonGpItem(current.state.record, current.state.teamMorale, slot, random)
      commit({ ...current, state: { ...current.state, record: effect.record, teamMorale: effect.teamMorale } })
      // 0x8086 — 0x22e35(2, 칸)
      recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: slot })
      return effect.notice
    },
    [atoms, commit, random, recordStat, spendGamePoint],
  )
  const recoverSeasonPitcherStamina = useCallback(
    (recordIndex: number) => {
      const current = atoms.get(saveAtom)
      if (current === null) return { notice: '', recovered: false }
      const full = () => ({ notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나최대), recovered: false })
      const recovered = () => ({ notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나회복), recovered: true })
      const target = staminaTargetOf(current, recordIndex)
      if (target.kind === '마투수') {
        if (isAceStaminaFull(target.aces)) return full()
        payStaminaItem(spendGamePoint, recordStat)
        commit(withAceStaminaFull(current, target.aces))
        return recovered()
      }
      const pitcher = current.roster.pitchers[target.rosterIndex]
      if (pitcher === undefined) return { notice: '', recovered: false }
      if (pitcher.stamina === FULL_PITCHER_STAMINA) return full()
      // 0x7ca2~0x7ce8: 값 치르기 · 스태미나 = 10000 · 저장
      payStaminaItem(spendGamePoint, recordStat)
      commit(withPitcherStaminaFull(current, target.rosterIndex))
      return recovered()
    },
    [atoms, commit, recordStat, spendGamePoint],
  )
  const finishTrade = useCallback(
    (settlement: TradeSettlement) => {
      if (save === null) return
      // 성공이면 두 팀 레코드의 한 칸씩을 맞바꾼다 (0xd1cc~0xd3ae — 스태미나 +0x2c 도 레코드를 따라간다).
      // 화면·요청 칸은 레코드 차례라 명단 첨자로 되돌려 건다
      const swapped = settlement.swap === undefined ? save : withTradeSwap(save, rosterTradeSwapOf(save, settlement.swap))
      commit({
        ...swapped,
        state: { ...save.state, record: settlement.record },
      })
      spendGamePoint(settlement.gamePointCost)
    },
    [commit, save, spendGamePoint],
  )
  return { equipSeasonPlayer, buySeasonSubItem, buySeasonGpItem, recoverSeasonPitcherStamina, finishTrade }
}
