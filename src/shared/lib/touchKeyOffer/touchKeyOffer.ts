import { useEffect, useSyncExternalStore } from 'react'

/**
 * **상황 버튼 알림판** (웹 껍데기 — 원본에 없음). 터치 기기에서는 숫자 키패드도, 늘 있던 확인 · 뒤로 버튼도
 * 없다(`widgets/touch-controls`, r186). 원본 키('0' 필살타 · 마구, '8' 번트, '3'/'2'/'1' 도루, '#' 교체, '*' 메뉴)는
 * **지금 그 키를 받는 화면 부품이 여기에 알리는 동안만** 버튼으로 뜬다.
 *
 * 버튼은 키보드와 같은 키 사건(keydown · keyup)을 쏜다 — 화면은 키보드 · 버튼을 가리지 않고, 받은 키는 화면이 늘 하던 대로
 * 장면 키 칸(`sceneKeyLatch`)에 든다. 이 판은 **무엇을 띄울지**만 든다(게임 상태를 바꾸지 않는다).
 */
export interface TouchKeyOffer {
  /** 쏠 키 — `KeyboardEvent.key` ('0' · '8' · '#' · '*' …) */
  readonly key: string
  /** 버튼 글자 */
  readonly label: string
  /** 누르고 있는 동안만 뜻이 있는 키(번트 '8') — 버튼을 떼면 keyup. 아닌 키도 떼면 keyup 은 간다(키보드와 같다) */
  readonly isHold?: boolean
  /** 버튼 차례를 직접 줄 때(작을수록 앞) — 안 주면 `KEY_ORDER`. 한 화면이 같은 무리의 키를 제 차례로 세울 때(수비 송구 1·2·3루 · 홈) */
  readonly order?: number
}

interface OfferEntry {
  readonly id: number
  readonly offer: TouchKeyOffer
}

/** 버튼 차례 — 앞일수록 앞에 선다. 없는 키는 뒤로 */
const KEY_ORDER: readonly string[] = ['0', '8', '3', '2', '1', '7', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '#', '*']

let entries: OfferEntry[] = []
let snapshot: readonly TouchKeyOffer[] = []
let nextId = 1
const listeners = new Set<() => void>()

const rankOf = (offer: TouchKeyOffer) => {
  if (offer.order !== undefined) return offer.order
  const rank = KEY_ORDER.indexOf(offer.key)
  return rank < 0 ? KEY_ORDER.length : rank
}

function rebuild(): void {
  // 같은 키를 둘이 알리면 나중 것 하나만 — 버튼 하나가 키 하나다
  const byKey = new Map<string, TouchKeyOffer>()
  for (const entry of entries) byKey.set(entry.offer.key, entry.offer)
  snapshot = [...byKey.values()].sort((a, b) => rankOf(a) - rankOf(b))
  for (const listener of listeners) listener()
}

/** 키 하나를 알린다 — 돌려준 함수로 거둔다(두 번 불러도 한 번) */
export function offerTouchKey(offer: TouchKeyOffer): () => void {
  const entry: OfferEntry = { id: nextId++, offer }
  entries = [...entries, entry]
  rebuild()
  let isWithdrawn = false
  return () => {
    if (isWithdrawn) return
    isWithdrawn = true
    entries = entries.filter((candidate) => candidate.id !== entry.id)
    rebuild()
  }
}

/** 지금 뜰 상황 버튼 — 키마다 하나, `KEY_ORDER` 차례 */
export function touchKeyOffersNow(): readonly TouchKeyOffer[] {
  return snapshot
}

export function subscribeTouchKeyOffers(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 부품이 서 있고 `offer` 가 null 이 아닌 동안 그 키를 알린다 */
export function useTouchKeyOffer(offer: TouchKeyOffer | null): void {
  const key = offer?.key
  const label = offer?.label
  const isHold = offer?.isHold === true
  const order = offer?.order
  useEffect(() => {
    if (key === undefined || label === undefined) return undefined
    return offerTouchKey({ key, label, ...(isHold ? { isHold } : {}), ...(order === undefined ? {} : { order }) })
  }, [key, label, isHold, order])
}

/** 목록 · 글 위아래 넘기기 상황 버튼 (↑ · ↓) — 화면 안에 그 칸이 없거나 손가락보다 작을 때 */
export const SCROLL_UP_OFFER: TouchKeyOffer = { key: 'ArrowUp', label: '▲ 위' }
export const SCROLL_DOWN_OFFER: TouchKeyOffer = { key: 'ArrowDown', label: '▼ 아래' }
/** 쪽 · 탭 앞뒤 넘기기 상황 버튼 (← · →) */
export const PAGE_PREVIOUS_OFFER: TouchKeyOffer = { key: 'ArrowLeft', label: '◀ 앞' }
export const PAGE_NEXT_OFFER: TouchKeyOffer = { key: 'ArrowRight', label: '뒤 ▶' }

/** `isActive` 동안 ↑ · ↓ 상황 버튼을 알린다 */
export function useTouchScrollKeys(isActive: boolean): void {
  useTouchKeyOffer(isActive ? SCROLL_UP_OFFER : null)
  useTouchKeyOffer(isActive ? SCROLL_DOWN_OFFER : null)
}

/** `isActive` 동안 ← · → 상황 버튼을 알린다 */
export function useTouchPageKeys(isActive: boolean): void {
  useTouchKeyOffer(isActive ? PAGE_PREVIOUS_OFFER : null)
  useTouchKeyOffer(isActive ? PAGE_NEXT_OFFER : null)
}

/** 상황 버튼 목록을 읽는다 (`widgets/touch-controls`) */
export function useTouchKeyOffers(): readonly TouchKeyOffer[] {
  return useSyncExternalStore(subscribeTouchKeyOffers, touchKeyOffersNow, touchKeyOffersNow)
}

/** 시험용 — 알린 키를 다 거둔다 */
export function resetTouchKeyOffersForTest(): void {
  entries = []
  rebuild()
}

/**
 * 투명 누름 칸(`PressArea`)이 원본 키 한 번을 그대로 내게 한다 — keydown · keyup 을 초점 요소(없으면 body)에 쏘아 `window` 까지 올린다.
 * 화면은 키보드 · 상황 버튼 · 누름 칸을 가리지 않는다(원본 그림 자리 위 칸 — 기록실 ◀ · ▶ 따위).
 */
export function tapKey(key: string, doc: Document = document): void {
  const code = key.length === 1 && key >= '0' && key <= '9' ? `Digit${key}` : key
  const target = doc.activeElement instanceof HTMLElement ? doc.activeElement : doc.body
  for (const type of ['keydown', 'keyup'] as const) {
    target.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, composed: true }))
  }
}
