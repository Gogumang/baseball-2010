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
import { recordAceSeatOf, SEASON_RECORD_ACE_PITCHER_SLOT } from '@/entities/season-mode/model/seasonEntry'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { recordPitcherIndexOf } from '@/app/model/seasonSession/roster/roster'
import { rosterTradeSwapOf, withTradeSwap } from '@/app/model/seasonSession/roster/tradeSwap'
import type { SeasonEquipPurchase } from '@/app/model/seasonSession/types/actions'
import type { SeasonRosterActionsContext } from '@/app/model/seasonSession/roster/useSeasonRosterActions'

/** `useSeasonSession` 몸통 문장 75~79 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonShopActions(ctx: SeasonRosterActionsContext) {
  const { latestSave, commit, spendGamePoint, random, recordStat, save } = ctx
  /**
   * 트레이드 진행 결과 (0xe7 — `docs/re/J-modes-rules.md` 4-4).
   *
   * 레코드(SR+0x56)·명단·G(저장+0x64)가 한꺼번에 바뀌므로 **한 번에 커밋한다** —
   * `updateRecord` 와 `updateRoster` 를 잇달아 부르면 같은 `save` 를 보고 한쪽이 덮인다.
   */
  const equipSeasonPlayer = useCallback(
    (purchase: SeasonEquipPurchase) => {
      const current = latestSave.current
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit],
  )
  const buySeasonSubItem = useCallback(
    (slot: number) => {
      const current = latestSave.current
      if (current === null) return ''
      const applied = applySeasonSubItem(current.state.record, slot)
      commit({ ...current, state: { ...current.state, record: applied.record } })
      return applied.notice
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit],
  )
  const buySeasonGpItem = useCallback(
    (slot: number) => {
      const current = latestSave.current
      if (current === null || slot === SEASON_STAMINA_ITEM) return null
      // 0x8034~0x8058: G 를 빼고 0x22c29(3, 값) — spendGamePoint 가 같은 차례로 적는다
      spendGamePoint(seasonGpItemPriceOf(slot))
      const effect = applySeasonGpItem(current.state.record, current.state.teamMorale, slot, random)
      commit({ ...current, state: { ...current.state, record: effect.record, teamMorale: effect.teamMorale } })
      // 0x8086 — 0x22e35(2, 칸)
      recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: slot })
      return effect.notice
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, random, recordStat, spendGamePoint],
  )
  const recoverSeasonPitcherStamina = useCallback(
    (recordIndex: number) => {
      const current = latestSave.current
      if (current === null) return { notice: '', recovered: false }
      // 0x5870 목록은 레코드 그대로라 남은 마투수가 8번 칸에 있고 옛 8번은 맨 끝이다(`SeasonRecordAces`) — 목록 칸을 레코드 줄로
      const myTeamId = current.state.record.teamId
      const aces = current.recordAces?.[myTeamId]
      const seat = recordAceSeatOf(current.roster.pitchers.length, aces === undefined ? -1 : aces.pitcher, SEASON_RECORD_ACE_PITCHER_SLOT)[
        recordIndex
      ]
      if (seat === 'ace' && aces !== undefined) {
        // 7c5c~7c64 — 마투수 레코드 +0x2c 도 같은 검사 · 같은 값(마선수 거름 없음). 다음 0xdd · CPU 경기 넣기가 줄을 통째 덮는다
        if ((aces.pitcherStamina ?? FULL_PITCHER_STAMINA) === FULL_PITCHER_STAMINA) {
          return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나최대), recovered: false }
        }
        spendGamePoint(seasonGpItemPriceOf(SEASON_STAMINA_ITEM))
        recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: SEASON_STAMINA_ITEM })
        commit({
          ...current,
          recordAces: { ...current.recordAces, [myTeamId]: { ...aces, pitcherStamina: FULL_PITCHER_STAMINA } },
        })
        return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나회복), recovered: true }
      }
      const rosterIndex = recordPitcherIndexOf(current, myTeamId, current.roster, seat === undefined || seat === 'ace' ? recordIndex : seat)
      const pitcher = current.roster.pitchers[rosterIndex]
      if (pitcher === undefined) return { notice: '', recovered: false }
      if (pitcher.stamina === FULL_PITCHER_STAMINA) {
        return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나최대), recovered: false }
      }
      // 0x7ca2~0x7ce8: G −= 0xcbbe3[3] × 100 · 0x22c29(3, 값) · 0x22e35(2, 3) · 스태미나 = 10000 · 저장
      // 대상 팀은 0x7c38 `0x1f9a9(저장, 모드, SR[1])` → 0x1f570 — 대회 중(S+0x12c)이면 상대국 칸 +0x934 를 돌려줄 꼴이지만,
      // 0xe8 에 들어오는 길이 GP 상점 0x7d90(8014) 하나 · 0xdc ← 0xd0 ← 관리 메뉴 0xc9 뿐이고 대회 중 진입 0x4b50(4bc2~4bd2)은 0xf3 으로,
      // 대회 고리(0xf3 0xe6f8 → 0xf4 0x4a18 → 0xdd ⇄ 0xe0 → 경기)에는 0xc9 를 세우는 곳이 없어 대회 중엔 닿지 않는다 — 늘 리그 칸(R9 19-2)
      spendGamePoint(seasonGpItemPriceOf(SEASON_STAMINA_ITEM))
      recordStat?.({ kind: 'GP아이템수', mode: SEASON_STAT_MODE, index: SEASON_STAMINA_ITEM })
      const pitchers = current.roster.pitchers.map((player, index) => (index === rosterIndex ? { ...player, stamina: FULL_PITCHER_STAMINA } : player))
      commit({ ...current, roster: { ...current.roster, pitchers } })
      return { notice: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나회복), recovered: true }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, recordStat, spendGamePoint],
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

/** `useSeasonShopActions` 까지 선 값 */
export type SeasonShopActionsContext = SeasonRosterActionsContext & ReturnType<typeof useSeasonShopActions>
