import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { tradeBoostCostOf } from '@/entities/season-mode/model/playerTrade'

const TRADE_QUESTION = ORIGINAL_MODE_TEXT[171] // "!C트레이드를 하시겠습니까?"
const GAME_POINT_SPENT = ORIGINAL_MODE_TEXT[172] // " !cFFFF00G포인트!cFFFFFF가 소모됩니다"(앞 빈칸 원문)

/**
 * 0xe7 확인(−5 · '5') 이 띄우는 [171] 팝업 글 — 0xc6ae~0xc736 (직접 떴다). 버퍼는 "!C"(0xcc210) 로 시작한다:
 * ```
 * 칸 0      "!C" + [171]
 * 칸 1 · 2  "!C" + 비용표 0xcbbed[칸] × 100 (0xbc73c 정수 이어 붙이기) + [172] + "!N"(0xcbbe0) + [171]
 * ```
 * 칸 0 은 [171] 도 "!C" 로 시작해 "!C" 가 둘이다 — 원본 그대로.
 */
export function tradeQuestionTextOf(boost: number): string {
  if (boost === 0) return `!C${TRADE_QUESTION}`
  // [172] 원문은 " !cFFFF00G포인트…" 로 앞에 빈칸이 있다 — 생성 표가 원문 빈칸을 그대로 둔다(r223)
  return `!C${tradeBoostCostOf(boost)}${GAME_POINT_SPENT}!N${TRADE_QUESTION}`
}
