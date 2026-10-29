import { useEffect, useState } from 'react'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import { REQUEST_ACQUIRED, type TradeProgressStage, type TradeQuestion, type TradeStep } from './tradeTexts'

/**
 * 트레이드 장면 칸 — 원본에서도 **한 장면 객체의 필드**(`this+0x148` 요청 플래그 · `+0x14c` 내 선수 · `+0x150` 상대 선수 ·
 * `+0x154` 탭 · `+0x158` 상대 팀 — CPU 요청 20바이트와 같은 칸)로 이어져 있어 한 화면이 단계만 바꿔 가며 든다.
 * `forced` 는 서 있는 CPU 요청(아니면 null).
 */
export function useTradeState(forced: TradeRequest | null, onEnterAcquired: (() => void) | undefined) {
  const [step, setStep] = useState<TradeStep>(() => (forced === null ? { kind: '팀' } : { kind: '영입', teamId: forced.opponentTeamId }))
  // this+0x154 — 0xe4 진입이 0 으로 지운다(투수). 요청이면 요청 칸의 탭
  const [tradeTab, setTradeTab] = useState<number>(() => forced?.tab ?? TRADE_REQUEST_TAB.투수)
  // ed+0x33f — 목록이 보여 주는 탭. 0xe5·0xe6 진입마다 this+0x154 로 다시 선다
  const [listTab, setListTab] = useState<number>(() => forced?.tab ?? TRADE_REQUEST_TAB.투수)
  const [boost, setBoost] = useState(0)
  /** 0xe4 히든 칸 힌트 팝업 글 */
  const [hiddenHint, setHiddenHint] = useState<string | null>(null)
  const [question, setQuestion] = useState<TradeQuestion | null>(null)
  // SR+0x56(이번 주기에 트레이드를 썼다)은 여기서 막지 않는다 — 구단관리 키 0x4e40 은 켬 표를 안 보고 칸 1 이면 0xe4 로
  // 오고, 0xe4 진입 0x4774 도 그 칸을 안 본다. 막는 것은 구단관리 위·아래 이동 0x6c444 가 꺼진 칸을 건너뛰는 것뿐이다
  // (`SeasonTeamMenuScreen` 의 `disabled`). CPU 요청은 0xc9 → 0xe5 로 바로 가 [204] 부터 띄운다
  const [notice, setNotice] = useState<string | null>(() => (forced !== null ? REQUEST_ACQUIRED : null))
  /** 키 셈 [ed+0x40c] — 0x7104 · 0x727c 가 키마다 편집기 0x55864 를 부른다 (▲▼ 깜빡 · 목록 창) */
  const [keyPresses, setKeyPresses] = useState(0)
  /**
   * 0xe7 단계 this+0x160 — 0 고르기 · 1 진행(게이지, [173]) · 2 성공 [174] · 3 실패 [175].
   * 진행 가드를 지나면 1 이 되고(0xd45e), 게이지가 다 차는 틀(0xcecc)에 굴려 2·3 으로 간다.
   */
  const [progress, setProgress] = useState<TradeProgressStage | null>(null)
  /**
   * 편집기 [ed+0x424](상세 창) — 연 단계(`step` 객체)로 든다. 0xe5 · 0xe6 진입이 편집기를 다시 세워(0x5561c 556d6) 닫으므로
   * 단계가 바뀌면 저절로 닫힌다
   */
  const [detailOpenedAt, setDetailOpenedAt] = useState<TradeStep | null>(null)

  // 0x5cd0 — 0xe5 에 들어올 때마다(팀 고르기 · 요청 예 · 0xe6 취소) 첫머리에서 0xb512c × 열 팀
  useEffect(() => {
    if (step.kind === '영입') onEnterAcquired?.()
  }, [step, onEnterAcquired])

  return {
    step,
    setStep,
    tradeTab,
    setTradeTab,
    listTab,
    setListTab,
    boost,
    setBoost,
    hiddenHint,
    setHiddenHint,
    question,
    setQuestion,
    notice,
    setNotice,
    keyPresses,
    setKeyPresses,
    progress,
    setProgress,
    detailOpenedAt,
    setDetailOpenedAt,
  }
}

export type TradeState = ReturnType<typeof useTradeState>
