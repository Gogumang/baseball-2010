import { atom } from 'jotai'
import { type TradeRequest, NO_TRADE_REQUEST } from '@/entities/season-mode/model/tradeRequest'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import { type SeasonMenuCursors, INITIAL_SEASON_MENU_CURSORS } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonSummaryEntry } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonEventPlayback, SeasonIncomeEvaluation } from '@/app/model/seasonSession/types/session'

/** 화면 칸 atom — 창 · 결과 글 · 메뉴 커서처럼 저장하지 않는 장면 객체 칸 */

/** 이벤트 재생 0xd3 — 트는 이벤트와 돌아갈 상태 */
export const eventPlaybackAtom = atom<SeasonEventPlayback | null>(null)
/** this+0x148 — CPU 트레이드 요청 (장면 객체 칸, 저장 안 함) */
export const tradeRequestAtom = atom<TradeRequest>(NO_TRADE_REQUEST)
/** 관리 메뉴 진입의 요청 알림 [203] (팝업 0x27) 이 떠 있는가 */
export const tradeRequestAlertOpenAtom = atom(false)
export const trainingResultAtom = atom<SeasonTrainingResult | null>(null)
export const outingPlaceAtom = atom<number | null>(null)
export const outingResultTextAtom = atom<string | null>(null)
export const incomeEvaluationAtom = atom<SeasonIncomeEvaluation | null>(null)
/** 관리 메뉴·구단관리 메뉴 객체의 커서 — 장면 생성(0x3b14)에서 0, 상태를 오가도 남는다 */
export const menuCursorsAtom = atom<SeasonMenuCursors>(INITIAL_SEASON_MENU_CURSORS)
/** 지금 결산 진입(0x6900) — 0x29 가 새로 열려 진입의 리그 1위 G 검사를 건너뛰었는가 (0x69ce → 0x6ac8) */
export const summaryEntryAtom = atom<SeasonSummaryEntry | null>(null)
/** 전역 해금표 app+0xc0 중 시즌모드가 연 칸 (0x29) — 세션 상태, 앱이 기록연감 해금 목록에 합친다 */
export const openedHiddenIdsAtom = atom<readonly number[]>([])
