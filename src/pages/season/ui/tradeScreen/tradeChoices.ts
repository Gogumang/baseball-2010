import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import { hiddenTeamHintOf } from '@/pages/season/lib/hiddenTeamHint'
import {
  CHOOSE_ACQUIRED,
  CHOOSE_GIVEN,
  LAST_TRADE_TEAM,
  REFUSE_CAREER,
  REFUSE_HALL_OF_FAME,
  REQUEST_ACQUIRED,
  REQUEST_GIVEN,
  type TradeStep,
} from './tradeTexts'
import type { TradeState } from './useTradeState'
import type { tradeEntriesOf } from './tradeView'

interface TradeChoiceContext {
  readonly state: TradeState
  readonly forced: TradeRequest | null
  readonly myTeamId: number
  readonly openedHiddenIds: readonly number[]
  readonly entries: ReturnType<typeof tradeEntriesOf>
  /** 단계 진입마다 커서를 첫 칸으로 (`useSeasonCursor` 의 moveTo(0)) */
  readonly resetListCursor: () => void
  readonly onBack: () => void
}

/** 0xe4 · 0xe5 · 0xe6 고르기와 취소 — 단계 칸만 바꾼다(굴림 · 저장 없음) */
export function tradeChoicesOf({ state, forced, myTeamId, openedHiddenIds, entries, resetListCursor, onBack }: TradeChoiceContext) {
  const { step } = state
  const isRequest = forced !== null

  /** 요청이면 단계에 들어갈 때마다 진입 알림 [204]/[205] 를 다시 띄운다 (0x5cd0·0x5b28 은 진입 함수다) */
  const enterStep = (next: TradeStep) => {
    state.setStep(next)
    resetListCursor()
    // 0x5cd0 · 0x5b28 — 편집기를 this+0x154 탭으로 다시 세운다
    if (next.kind === '영입' || next.kind === '보상') state.setListTab(state.tradeTab)
    // 0x5cd0 · 0x5b28 진입이 늘 알림을 띄운다 — 요청이면 [204] · [205], 아니면 [163] · [164] (0x5cf0~0x5d18 · 0x5b2a~0x5b56)
    if (next.kind === '영입') state.setNotice(isRequest ? REQUEST_ACQUIRED : CHOOSE_ACQUIRED)
    if (next.kind === '보상') state.setNotice(isRequest ? REQUEST_GIVEN : CHOOSE_GIVEN)
  }

  /**
   * 0xe4 확인 — 키 0x8250 (0x82a4~0x8382, 직접 떴다):
   * ```
   * 칸 == SR+1(내 팀)  → 아무것도 안 한다
   * 칸 > 9            → 히든 팀 힌트 팝업 (1, 1, 1) — 0xca 와 같은 글(`hiddenTeamHintOf`), 열린 팀도 못 고른다
   * 그 밖             → this+0x158 = 칸 · 0xe5
   * ```
   */
  const chooseTeam = (teamId: number) => {
    if (teamId === myTeamId) return
    if (teamId > LAST_TRADE_TEAM) return state.setHiddenHint(hiddenTeamHintOf(teamId, openedHiddenIds))
    // 0xe4 진입 0x4774 가 20바이트를 지워 트레이드 탭은 0(투수)이다 — 0xe5 진입이 그 탭으로 목록을 연다
    state.setTradeTab(TRADE_REQUEST_TAB.투수)
    state.setListTab(TRADE_REQUEST_TAB.투수)
    state.setStep({ kind: '영입', teamId })
    resetListCursor()
    // 0x5cd0 — StrMODE[163] 알림
    state.setNotice(CHOOSE_ACQUIRED)
  }

  const chooseAcquired = (index: number) => {
    if (step.kind !== '영입') return
    // 요청이면 커서가 상대 칸에 묶여 있다
    const chosen = forced === null ? index : forced.opponentIndex
    // 0x7104 — 트레이드 탭은 여기서 목록 탭으로 정해진다
    const nextTab = isRequest ? state.tradeTab : state.listTab
    const entry = entries.shownEntries[chosen]
    if (entry === undefined) return
    state.setTradeTab(nextTab)
    // 0x71bc~0x723a — 요청이 아니면 탭 · 칸을 먼저 적고(this+0x154 · +0x150) 상대 선수 0xb5695(상대 팀, 탭, 칸)가 나리 선수(0xb6389)면
    // [165] 알림 (1, 1, 1) 뒤 0xe5 에 남는다. 명전 검사(0xb6349 → [166])는 0xe6 키 0x727c 에만 있다 — 원본 그대로
    if (!isRequest && entry.refusal === '나리선수') return state.setNotice(REFUSE_CAREER)
    state.setStep({ kind: '보상', teamId: step.teamId, acquired: chosen })
    resetListCursor()
    state.setListTab(nextTab)
    // 0x5b28 — [164] (요청이면 [205]) 알림
    state.setNotice(isRequest ? REQUEST_GIVEN : CHOOSE_GIVEN)
  }

  const chooseGiven = (index: number) => {
    if (step.kind !== '보상') return
    // 0x736e — 요청이면 나리·명전 검사 없이 곧장 0xe7 (요청 굴림이 이미 걸렀다)
    if (forced !== null) return enterStep({ kind: '확인', teamId: step.teamId, acquired: step.acquired, given: forced.myIndex })
    // 0x727c — 보이는 목록이 아니라 트레이드 탭(this+0x154) 배열의 같은 칸이다 (tradeTexts 머리 주석)
    const entry = entries.myEntries[index]
    if (entry === undefined) return
    // 영입해 온 나리·명예 선수는 트레이드 대상이 아니다 (StrMODE[165]/[166])
    if (entry.refusal !== null) return state.setNotice(entry.refusal === '나리선수' ? REFUSE_CAREER : REFUSE_HALL_OF_FAME)
    state.setStep({ kind: '확인', teamId: step.teamId, acquired: step.acquired, given: index })
    resetListCursor()
  }

  const backOneStep = () => {
    if (step.kind === '확인') return enterStep({ kind: '보상', teamId: step.teamId, acquired: step.acquired })
    if (step.kind === '보상') return enterStep({ kind: '영입', teamId: step.teamId })
    // 0x7194 — 요청이면 팀 고르기로 못 간다: [216] 을 묻는다
    if (step.kind === '영입' && isRequest) return state.setQuestion('요청취소')
    if (step.kind === '영입') return state.setStep({ kind: '팀' })
    return onBack()
  }

  return { chooseTeam, chooseAcquired, chooseGiven, backOneStep }
}
