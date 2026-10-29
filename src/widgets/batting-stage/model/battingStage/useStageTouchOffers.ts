import { canSpecialSwing } from '@/entities/batting/model/specialSwing'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

/** 터치 번트 '7' · '9' 의 버튼 차례 — `touchKeyOffer` 의 '8'(1) 과 '3'(2) 사이 */
const BUNT_7_TOUCH_ORDER = 1.25
const BUNT_9_TOUCH_ORDER = 1.5
/**
 * 터치 스윙 버튼 — 원본 스윙 키 OK · '5' (0x53670 → 메시지 0x6a5 → 0x51db6) 중 '5' 를 쏜다(Enter 는 OK 상황 버튼 · 창이 쓰는 키라 겹치지 않게).
 * 차례는 맨 앞(-1 — 필살타 '0' 의 0 보다 앞): 늘 같은 자리라 손가락이 찾지 않는다 (10-29 사용자 결정 — 아이폰 Safari 에서 화면 탭이 안 먹는다는 신고)
 */
const SWING_TOUCH_OFFER: TouchKeyOffer = { key: '5', label: '스윙', order: -1 }

export interface StageTouchOfferInput {
  /** 이 타석이 키를 받는가 — 공을 안 던지는 동안(결과 연출 `isPaused` · 결과 창 배경 · 공용 창)은 거짓 */
  readonly takesStageKeys: boolean
  readonly canBunt: boolean
  readonly specialSwingNumber: number
  readonly aceBatterIndex: number
  readonly specialSwingRemaining: number | undefined
}

/**
 * 터치 상황 버튼 (웹 껍데기, `touchKeyOffer`) — 이 타석이 그 키를 받는 동안만 띄운다. 버튼은 같은 키 사건을 쏜다(`useStageControls`).
 * 필살타 '0' 은 0x51e14 가드(번호 · 남은 횟수 — `canSpecialSwing`)가 열려 있을 때, 번트 '8' 은 화면이 번트 키를 열었고(`canBunt`)
 * 마타자가 아닐 때(0x51e48 이 마선수면 예약하지 않는다)
 */
export function useStageTouchOffers(input: StageTouchOfferInput): void {
  const { takesStageKeys } = input
  // 스윙 '5' 는 타석이 키를 받는 동안 늘 — 공이 날기 전 · 큰 타구 감상(0x13 건너뛰기)에서도 키보드 '5' 와 같은 길이다
  useTouchKeyOffer(takesStageKeys ? SWING_TOUCH_OFFER : null)
  useTouchKeyOffer(offersSpecialSwingOf(input) ? { key: '0', label: '필살타' } : null)
  // 번트 '7' · '9' 도 같은 0x51e48 로 종류 2 · 3 을 예약한다(0x535a4) — '8' 처럼 누르는 동안만(뗄 때 0x6a8). 버튼은 '8' 바로 뒤에 선다
  const offersBunt = offersBuntOf(input)
  useTouchKeyOffer(offersBunt ? { key: '8', label: '번트', isHold: true } : null)
  useTouchKeyOffer(offersBunt ? { key: '7', label: '번트 7', isHold: true, order: BUNT_7_TOUCH_ORDER } : null)
  useTouchKeyOffer(offersBunt ? { key: '9', label: '번트 9', isHold: true, order: BUNT_9_TOUCH_ORDER } : null)
}

function offersSpecialSwingOf({ takesStageKeys, specialSwingNumber, aceBatterIndex, specialSwingRemaining }: StageTouchOfferInput): boolean {
  return takesStageKeys && canSpecialSwing(specialSwingNumber, aceBatterIndex >= 0, specialSwingRemaining)
}

function offersBuntOf({ takesStageKeys, canBunt, aceBatterIndex }: StageTouchOfferInput): boolean {
  return takesStageKeys && canBunt && aceBatterIndex < 0
}
