import { stampInputTime } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'

/**
 * 터치 버튼이 쏘는 키 — 원본 피처폰 키를 **웹 키보드 키 이름**으로 옮긴 것.
 * 게임은 키보드(`window` 의 keydown · keyup)만 듣는다. 버튼도 같은 이름의 키 사건을 쏴서 같은 길(앱 키 문 `appKeyGate` →
 * 화면 · 장면 키 칸 `sceneKeyLatch`)로 들어간다.
 */
export interface TouchKey {
  /** `KeyboardEvent.key` */
  readonly key: string
  /** `KeyboardEvent.code` (키보드에서 같은 키를 눌렀을 때) */
  readonly code: string
}

const CODE_OF: Readonly<Record<string, string>> = {
  '*': 'NumpadMultiply',
  '#': 'Digit3',
  Enter: 'Enter',
  Escape: 'Escape',
}

/** 상황 버튼의 키 이름 → 키 */
export function touchKeyOf(key: string): TouchKey {
  const code = CODE_OF[key] ?? (key.length === 1 && key >= '0' && key <= '9' ? `Digit${key}` : key)
  return { key, code }
}

/**
 * 키 사건을 받을 곳 — 진짜 키보드처럼 **초점이 있는 요소**(이름 입력칸 따위), 없으면 `body`.
 * 사건은 거품으로 `window` 까지 올라가 화면들의 `window.addEventListener('keydown' …)` 가 받는다(잡기 단계 듣는 곳 포함).
 */
function keyTargetOf(doc: Document): EventTarget {
  const active = doc.activeElement
  return active instanceof HTMLElement ? active : doc.body
}

/**
 * 키 사건 하나를 쏜다 — 키보드에서 그 키를 누른/뗀 것과 같은 이름(`key` · `code`)이다. `inputTime` 은 손가락이 닿은(뗀) pointer 사건의
 * 시각 — 대신 쏜 사건의 시각은 손잡이가 돈 때라, 진짜 누른 때를 붙여 둔다(`stampInputTime` — 타석 키는 그때 보이던 그림의 틱으로 센다)
 */
export function dispatchTouchKey(type: 'keydown' | 'keyup', touchKey: TouchKey, doc: Document = document, inputTime?: number): void {
  const event = new KeyboardEvent(type, {
    key: touchKey.key,
    code: touchKey.code,
    bubbles: true,
    cancelable: true,
    composed: true,
  })
  if (inputTime !== undefined) stampInputTime(event, inputTime)
  keyTargetOf(doc).dispatchEvent(event)
}

export interface KeyPressHandle {
  /** 손을 뗐다 (또는 누름이 취소됐다) — keyup 을 한 번 쏜다. 두 번 불러도 한 번만. `inputTime` 은 뗀 pointer 사건의 시각 */
  readonly release: (inputTime?: number) => void
}

/**
 * 버튼을 **누르기 시작** — 곧바로 keydown(손가락이 닿는 순간 — 떼는 순간이 아니다), `release` 에서 keyup.
 * 번트('8' 누르고 있는 동안만)처럼 떼는 순간이 뜻을 갖는 조작이 키보드와 같게 된다.
 * 자동 되풀이는 쏘지 않는다 — 원본 장면 밖 · 창에는 되풀이가 없고(`appKeyGate`), 타석 · 투구 키도 되풀이를 안 읽는다.
 */
export function startTouchKeyPress(touchKey: TouchKey, doc: Document = document, inputTime?: number): KeyPressHandle {
  dispatchTouchKey('keydown', touchKey, doc, inputTime)
  let isReleased = false
  return {
    release: (releaseTime) => {
      if (isReleased) return
      isReleased = true
      dispatchTouchKey('keyup', touchKey, doc, releaseTime)
    },
  }
}
