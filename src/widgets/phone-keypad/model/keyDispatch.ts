import { KEY_REPEAT_DELAY, KEY_REPEAT_INTERVAL } from '@/widgets/phone-keypad/lib/phoneKeys'
import type { PhoneKey } from '@/widgets/phone-keypad/lib/phoneKeys'

/**
 * 키 사건을 받을 곳 — 진짜 키보드처럼 **초점이 있는 요소**(입력칸 따위), 없으면 `body`.
 * 사건은 거품으로 `window` 까지 올라가 화면들의 `window.addEventListener('keydown' …)` 가 받는다(잡기 단계 듣는 곳 포함).
 */
function keyTargetOf(doc: Document): EventTarget {
  const active = doc.activeElement
  return active instanceof HTMLElement ? active : doc.body
}

/** 키 사건 하나를 쏜다 — 키보드에서 그 키를 누른/뗀 것과 같은 이름(`key` · `code`)이다 */
export function dispatchPhoneKey(type: 'keydown' | 'keyup', phoneKey: PhoneKey, repeat = false, doc: Document = document): void {
  const event = new KeyboardEvent(type, {
    key: phoneKey.key,
    code: phoneKey.code,
    repeat,
    bubbles: true,
    cancelable: true,
    composed: true,
  })
  keyTargetOf(doc).dispatchEvent(event)
}

export interface KeyPressHandle {
  /** 손을 뗐다 (또는 누름이 취소됐다) — keyup 을 한 번 쏜다. 두 번 불러도 한 번만 */
  readonly release: () => void
}

/**
 * 키패드 칸을 **누르기 시작** — 곧바로 keydown, 길게 누르고 있으면 키보드 자동 되풀이처럼 `repeat: true` keydown 을 잇고,
 * `release` 에서 keyup. 번트('7'~'9' 누르고 있는 동안만)처럼 떼는 순간이 뜻을 갖는 조작이 키보드와 같게 된다.
 */
export function startPhoneKeyPress(phoneKey: PhoneKey, doc: Document = document): KeyPressHandle {
  const view = doc.defaultView ?? window
  dispatchPhoneKey('keydown', phoneKey, false, doc)
  let interval: number | null = null
  let timeout: number | null = view.setTimeout(() => {
    timeout = null
    interval = view.setInterval(() => dispatchPhoneKey('keydown', phoneKey, true, doc), KEY_REPEAT_INTERVAL)
  }, KEY_REPEAT_DELAY)
  let isReleased = false
  return {
    release: () => {
      if (isReleased) return
      isReleased = true
      if (timeout !== null) view.clearTimeout(timeout)
      if (interval !== null) view.clearInterval(interval)
      dispatchPhoneKey('keyup', phoneKey, false, doc)
    },
  }
}
