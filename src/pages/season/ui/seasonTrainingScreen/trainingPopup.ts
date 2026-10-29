import { HELL_TRAINING_INDEX, TRAINING_GUARD_CEILING } from '@/widgets/season/lib/seasonTraining'
import type { checkSeasonTraining } from '@/widgets/season/lib/seasonTraining'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { fillModeText } from '@/widgets/season/lib/seasonText'

/** StrMODE 번호 (가드 0x9108 이 0x702b4 로 꺼내는 글 — 직접 떴다) */
const TEXT = {
  /** "!C사기가 0일 때는!N훈련을 할 수 없습니다" — 팝업 (1,1) */
  사기없음: 193,
  /** "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?" — 팝업 (2,2) 예/아니오 */
  G부족: 65,
  /** "[%s] 능력치가 최대입니다" — %s = StrMODE[44 + 칸] */
  능력치최대: 192,
  /** "[지옥훈련]을 하시겠습니까? … 500 G포인트가 소모됩니다" — 팝업 (2, 0x12) */
  지옥훈련확인: 141,
  /** "[%s훈련]을 하시겠습니까?" — %s = StrMODE[44 + 칸], 팝업 (2, 0x11) */
  훈련확인: 85,
  /** StrMODE[44..47] 투구·타격·집중·근성 */
  능력치이름: 44,
} as const

/** StrMODE[192] 를 칸 이름으로 채운 한 줄 (sprintf(buf, [192], [44 + 칸])) */
const maxedLineOf = (index: number): string =>
  fillModeText(ORIGINAL_MODE_TEXT[TEXT.능력치최대] ?? '', ORIGINAL_MODE_TEXT[TEXT.능력치이름 + index] ?? '')

/** 팝업 한 장 — 글과 단추 */
export interface TrainingPopup {
  readonly text: string
  /** 예/아니오(2) 인가, 확인 하나(1)인가 */
  readonly asks: boolean
  /** 예를 누르면 훈련할 칸. 없으면 예도 닫기만 한다 */
  readonly trainIndex: number | null
}

/**
 * 가드 0x9108 (9128~9310, 직접 떴다) 이 띄우는 팝업:
 * ```
 * 팀 사기 == 0                     → [193]                        (1,1)
 * 칸 4 지옥훈련: G < 500           → [65]                         (2,2) — 예는 G 충전 페이지 0xfa (이식 대상 아님)
 *               능력치 > 998 인 칸마다 sprintf([192], [44+i]) + "!N" 을 이어 붙인다
 *               넷 다 최대          → 그 글                         (1,1)
 *               하나 이상 최대     → 그 글 + "!N" + [141]          (2,0x12) — 922e 가 "!N" 을 한 번 더 붙인다
 *               최대 없음          → [141]                        (2,0x12)
 * 칸 0~3: 그 칸 > 998              → sprintf([192], [44+칸])       (1,1)
 *         그 밖                    → sprintf([85], [44+칸])        (2,0x11)
 * ```
 */
type TrainingCheck = ReturnType<typeof checkSeasonTraining>

const modeTextOf = (index: number): string => ORIGINAL_MODE_TEXT[index] ?? ''
/** 확인 하나(1,1)뿐인 알림 */
const noticeOf = (text: string): TrainingPopup => ({ text, asks: false, trainIndex: null })

/** 칸 4 지옥훈련 — G 부족 · 최대 칸 목록 · 질문 [141] */
function hellTrainingPopupOf(checked: TrainingCheck, abilities: readonly number[]): TrainingPopup {
  if (!checked.ok && checked.reason === 'G부족') return { text: modeTextOf(TEXT.G부족), asks: true, trainIndex: null }
  const maxed = abilities.map((value, slot) => (value > TRAINING_GUARD_CEILING ? `${maxedLineOf(slot)}!N` : '')).join('')
  if (!checked.ok) return noticeOf(maxed)
  // 일부만 최대면 목록 뒤에 "!N" 을 한 번 더 붙이고 [141] 을 잇는다 (922e strcat(buf, "!N") → 9248 strcat(buf, [141]))
  // — 목록과 질문 사이에 빈 줄 하나. 최대가 없으면 [141] 만 (9256)
  const gap = maxed === '' ? '' : '!N'
  return { text: maxed + gap + modeTextOf(TEXT.지옥훈련확인), asks: true, trainIndex: HELL_TRAINING_INDEX }
}

export function trainingPopupOf(checked: TrainingCheck, index: number, abilities: readonly number[]): TrainingPopup {
  if (!checked.ok && checked.reason === '사기없음') return noticeOf(modeTextOf(TEXT.사기없음))
  if (index === HELL_TRAINING_INDEX) return hellTrainingPopupOf(checked, abilities)
  if (!checked.ok) return noticeOf(maxedLineOf(index))
  return { text: fillModeText(modeTextOf(TEXT.훈련확인), modeTextOf(TEXT.능력치이름 + index)), asks: true, trainIndex: index }
}
