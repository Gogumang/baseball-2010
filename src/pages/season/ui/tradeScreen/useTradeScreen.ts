import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { TRADE_BOOST_COUNT } from '@/entities/season-mode/model/playerTrade'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import type { TradeScreenProps } from './tradeScreenProps'
import { isListStep, type TradeStep } from './tradeTexts'
import { tradeEntriesOf, tradeListRowsOf, tradeRateOf } from './tradeView'
import { tradeChoicesOf } from './tradeChoices'
import { tradeRunOf } from './tradeRun'
import { useTradeState, type TradeState } from './useTradeState'
import { useTradeListKeys } from './useTradeListKeys'
import { useListTop } from './useListTop'

const NO_HIDDEN_IDS: readonly number[] = []
const ignoreCursor = () => undefined

/** 서 있는 CPU 요청 — 요청 객체가 있어도 플래그(+0)가 서 있어야 한다 */
const forcedRequestOf = (request: TradeRequest | null | undefined) => (request?.isRequested === true ? request : null)

/**
 * 요청이면 커서가 묶인다 — 0xe5 는 상대 칸, 0xe6 은 내 칸, 0xe7 은 비용 칸 0.
 * 0xe5·0xe6 진입(0x5cd0·0x5b28)이 목록 커서를 요청 칸에 두고 ed+0x439 = 1 로 목록 객체가 위·아래를 못 받게 하며,
 * 키 0x7104·0x727c 는 위·아래·'2'·'8' 을 −3 으로 바꿔 편집기에 넘긴다. −3 은 편집기 왼쪽 갈래 0x559f8 인데
 * 트레이드 목록은 보기 전용(ed+0x330 = −1, 0x5561c 셋째 인자 0)이고 ed+0x337 = 0 이라 **끝 코드 ed+0x338 = 2 만**
 * 적는다 — 0x7104·0x727c 는 그 칸을 읽지 않으므로 보이는 일은 없다(커서가 안 움직일 뿐이다).
 * 0xe7(0xc66c)은 비용 칸 이동 키를 안 받는다(0xc756).
 */
function lockedCursorOf(forced: TradeRequest | null, step: TradeStep): number | null {
  if (forced === null) return null
  if (step.kind === '영입') return forced.opponentIndex
  if (step.kind === '보상') return forced.myIndex
  return 0
}

/** 팝업(예·아니오 · 알림 · 진행 판)이 키를 먹는 동안 — 장면 틀 0xe9ac 의 창 게이트 */
const isTradeBusy = (state: TradeState) => state.question !== null || state.notice !== null || state.progress !== null

interface TradeCursorInput {
  readonly step: TradeStep
  readonly isBusy: boolean
  readonly forced: TradeRequest | null
  readonly listCount: number
  readonly onSelect: (index: number) => void
  readonly onCancel: () => void
}

/** 목록 · 비용 칸 커서 — 요청이면 묶인 칸(`lockedCursorOf`)이고 옮기기는 아무 일도 안 한다 */
function useTradeCursor({ step, isBusy, forced, listCount, onSelect, onCancel }: TradeCursorInput) {
  const lockedCursor = lockedCursorOf(forced, step)
  const isConfirm = step.kind === '확인'
  const { cursor, moveTo } = useSeasonCursor({
    count: isConfirm ? TRADE_BOOST_COUNT : listCount,
    onSelect,
    onCancel,
    isEnabled: step.kind !== '팀' && !isBusy,
    ...(lockedCursor === null ? {} : { cursor: lockedCursor, onCursorChange: ignoreCursor }),
    // 0xe7 비용 칸 [this+0x7c] 은 장면 생성자 0x3c60~0x3c88 이 0x6bd7d vt+0x10(1열, 3줄, 숫자키 꼴 1, 꼴 0x330) 으로 짓는다(r263 직접 뜸).
    // 1열이라 ← → 는 0x6bead 의 0x10 갈래에서 끝을 넘고(0x6bdc4) 0x100 · 줄 > 1 로 세로 같은 부호 한 칸 — 곧 ← = ↑ · → = ↓,
    // '2' '4' '6' '8' 도 격자 키 0x6c030 이 방향으로 바꾼다. 커맨드 줄과 같은 걸음이다
    isCommandBar: isConfirm,
  })
  return { lockedCursor, cursor, moveTo, moveCursor: lockedCursor === null ? moveTo : ignoreCursor }
}

/** 트레이드 한 바퀴의 칸 · 파생 값 · 고르기 — 훅 차례는 옛 몸통 그대로(칸 → 커서 → 목록 키 → 윗줄) */
export function useTradeScreen(props: TradeScreenProps) {
  const { state: season, roster, gamePoints, random, onTrade, onCancelRequest, onBack, entryCellSourceOf } = props
  const { record } = season
  const forced = forcedRequestOf(props.request)
  const isRequest = forced !== null
  const state = useTradeState(forced, props.onEnterAcquired)
  const { step, tradeTab, listTab } = state
  const isListPitcher = listTab === TRADE_REQUEST_TAB.투수
  const isBusy = isTradeBusy(state)
  const opponentRosterOf = props.opponentRosterOf ?? tableRosterOf
  const entries = tradeEntriesOf({ step, tradeTab, listTab, record, roster, opponentRosterOf })
  const rateOf = tradeRateOf(entries.acquiredEntry, entries.givenEntry)
  const openedHiddenIds = props.openedHiddenIds ?? NO_HIDDEN_IDS
  const resetListCursor = () => cursorControl.moveTo(0)
  const choices = tradeChoicesOf({ state, forced, myTeamId: record.teamId, openedHiddenIds, entries, resetListCursor, onBack })
  const run = tradeRunOf({ state, isRequest, record, gamePoints, random, entries, rateOf, onTrade, onCancelRequest })
  const listSelect = step.kind === '영입' ? choices.chooseAcquired : choices.chooseGiven
  const cursorControl = useTradeCursor({
    step,
    isBusy,
    forced,
    listCount: entries.shownEntries.length,
    onSelect: (index) => (step.kind === '확인' ? run.chooseBoost(index) : listSelect(index)),
    onCancel: () => choices.backOneStep(),
  })
  const { cursor, moveCursor } = cursorControl
  const opponentRoster = entries.opponentRoster
  const listRows = tradeListRowsOf({ step, isListPitcher, record, roster, opponentRoster, entryCellSourceOf })
  const rowCount = listRows.length
  const keys = useTradeListKeys({ state, isRequest, isBusy, rowCount, cursor, moveCursor, moveTo: cursorControl.moveTo })
  const top = useListTop(cursor, rowCount)
  return {
    ...state,
    ...choices,
    ...run,
    ...keys,
    record,
    isRequest,
    isListPitcher,
    isPitcher: tradeTab === TRADE_REQUEST_TAB.투수,
    isListShown: isListStep(step),
    isBusy,
    entries,
    rateOf,
    openedHiddenIds,
    listSelect,
    lockedCursor: cursorControl.lockedCursor,
    cursor,
    moveCursor,
    listRows,
    top,
  }
}

export type TradeScreenModel = ReturnType<typeof useTradeScreen>
