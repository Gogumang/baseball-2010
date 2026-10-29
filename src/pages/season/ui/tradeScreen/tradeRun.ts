import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  markTradeUsed,
  rollTradeSuccess,
  tradeBoostCostOf,
  tradeMoneyChangeOf,
  withTradeMoney,
  type TradeSettlement,
} from '@/entities/season-mode/model/playerTrade'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { LACK_MONEY } from './tradeTexts'
import type { TradeState } from './useTradeState'
import type { tradeEntriesOf } from './tradeView'

interface TradeRunContext {
  readonly state: TradeState
  readonly isRequest: boolean
  readonly record: SeasonRecord
  readonly gamePoints: number
  readonly random: RandomPort
  readonly entries: ReturnType<typeof tradeEntriesOf>
  readonly rateOf: (which: number) => number
  readonly onTrade: (settlement: TradeSettlement) => void
  readonly onCancelRequest: (() => void) | undefined
}

/** 0xe7 확인 · 진행 — 비용 칸 고르기 → [171] 예 → 진행 가드 → 게이지가 다 찬 틀에 굴림 */
export function tradeRunOf({ state, isRequest, record, gamePoints, random, entries, rateOf, onTrade, onCancelRequest }: TradeRunContext) {
  const { step, boost } = state
  const { acquiredEntry, givenEntry } = entries

  const chooseBoost = (which: number) => {
    // 0xc756 — 요청 중에는 비용 칸이 안 움직여 늘 기본 진행(0)이다
    state.setBoost(isRequest ? 0 : which)
    state.setQuestion('진행')
  }

  /**
   * 0xe7 진행 — G 를 내고 굴린다. 성공이면 소지금에 d 가 더해지고 두 팀 레코드의 고른 칸이 맞바뀐다
   * (0xd1cc~0xd3ae — 세션이 `swapTradedPlayers` 로 시즌 저장의 두 명단에 건다)
   */
  const runTrade = () => {
    state.setQuestion(null)
    if (step.kind !== '확인' || acquiredEntry === null || givenEntry === null) return
    const rate = rateOf(boost)
    const isSuccess = rollTradeSuccess(random, rate, isRequest)
    const settled = isSuccess ? withTradeMoney(record, givenEntry.grade, acquiredEntry.grade) : record
    const swap = { opponentTeamId: step.teamId, tab: state.tradeTab, myIndex: step.given, opponentIndex: step.acquired }
    onTrade({
      record: markTradeUsed(settled),
      // 비용은 성공·실패와 상관없이 나간다 (0xcf24 는 굴리기 전에 깎는다)
      gamePointCost: tradeBoostCostOf(boost),
      isSuccess,
      ...(isSuccess ? { swap } : {}),
    })
    state.setProgress(isSuccess ? '성공' : '실패')
  }

  /**
   * [171] 에 "예" — 진행 가드 0xd3e6~0xd45c (직접 떴다). 걸리면 진행도 굴림도 SR+0x56 도 없이 0xe7 에 남는다:
   * ```
   * G(전역 +0x64) < 비용표 0xcbbed[칸] × 100      → [65] 팝업 (2, 2)   ; 예 → 0xfa G 충전 (0xd47a~0xd4a4)
   * d < 0 이고 소지금 SR+2 < −d                   → [77] 팝업 (1, 1)
   * 그 밖                                         → this+0x160 = 1 (진행) · +0x164 = 0 · +0x168 = 0
   * ```
   * d 는 성공 때 소지금에 더할 그 값이다(`tradeMoneyChangeOf`). 요청이면 비용 칸이 0 이라 G 가드는 늘 지나지만 d 가드는 같다.
   * 웹에는 G 충전 0xfa 가 없어 [65] 의 "예" 도 충전하지 않고 0xe7 에 남는 길로 둔다(시즌 트레이닝 [65] 과 같다).
   */
  const proceedTrade = () => {
    if (step.kind !== '확인' || acquiredEntry === null || givenEntry === null) return
    if (gamePoints < tradeBoostCostOf(boost)) return state.setQuestion('G부족')
    const moneyChange = tradeMoneyChangeOf(givenEntry.grade, acquiredEntry.grade)
    if (moneyChange < 0 && record.money < -moneyChange) return state.setNotice(LACK_MONEY)
    // this+0x160 = 1 · +0x164 = 0 · +0x168 = 0 — 굴림은 게이지가 다 찬 틀에 (`TradeProgress`)
    state.setProgress('진행')
  }

  const answerQuestion = (answer: number) => {
    const which = state.question
    state.setQuestion(null)
    if (answer !== 0) return
    if (which === '진행') return proceedTrade()
    if (which === '요청취소') onCancelRequest?.()
  }

  return { chooseBoost, runTrade, answerQuestion }
}
