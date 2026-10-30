import type { InGameMenuAction } from '@/features/play-team-game/model/inGameMenu'

/** 키 처리기가 지난 그림에서 읽는 값 */
export interface PauseWindowKeyTarget {
  readonly actions: readonly InGameMenuAction[]
  readonly onMoveCursor: (cursor: number) => void
  readonly onChoose: (action: InGameMenuAction) => void
  readonly onRequestClose: () => void
}

/** OK(−5) — 웹은 Enter · 스페이스 */
const CHOOSE_KEYS: ReadonlySet<string> = new Set(['Enter', ' '])
/** CLR(−16) — 웹은 Escape · Backspace */
const CLOSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/** ↑↓ — 꼴 0x20 세로 감기 */
function moveByArrow(event: KeyboardEvent, target: PauseWindowKeyTarget, cursorRef: { current: number }): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false
  event.preventDefault()
  const count = target.actions.length
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = (cursorRef.current + step + count) % count
  cursorRef.current = next
  target.onMoveCursor(next)
  return true
}

/** 숫자키 꼴 2(0x6c100~0x6c14e) — 숫자 d 를 칸 d − 1('0' 은 9)로 옮기고 −5(OK). 칸 밖 숫자는 버린다 */
function chooseByDigit(event: KeyboardEvent, target: PauseWindowKeyTarget, cursorRef: { current: number }): boolean {
  if (!/^[0-9]$/.test(event.key)) return false
  const index = event.key === '0' ? 9 : Number(event.key) - 1
  if (index >= target.actions.length) return true
  event.preventDefault()
  cursorRef.current = index
  target.onMoveCursor(index)
  const action = target.actions[index]
  if (action !== undefined) target.onChoose(action)
  return true
}

/** OK — 커서 칸을 고른다 */
function chooseAtCursor(event: KeyboardEvent, target: PauseWindowKeyTarget, cursorRef: { current: number }): boolean {
  if (!CHOOSE_KEYS.has(event.key)) return false
  event.preventDefault()
  const action = target.actions[cursorRef.current]
  if (action !== undefined) target.onChoose(action)
  return true
}

/**
 * 일시정지 창의 키 콜백 0x3c158 — ↑↓ 감기 · 숫자 곧바로 고르기 · OK · CLR 닫기(0x3c1a8). 창이 키를 안 받으면(펼침 · 줄임) 버린다.
 * CLR 은 [장면+0x1084] = 1 · 하위 0 · [창+0x215] = 1 — 여는 곳이 같은 키를 받아도 창이 이미 줄이는 중이라 두 번 닫지 않는다.
 * '*'(0x2a)도 같은 갈래지만 여는 곳의 `toggle` 이 받는다(여기서도 받으면 닫힌 뒤 다시 연다)
 */
export function handlePauseWindowKey(
  event: KeyboardEvent,
  target: PauseWindowKeyTarget,
  cursorRef: { current: number },
  acceptsKeys: () => boolean,
): void {
  if (event.repeat || !acceptsKeys()) return
  if (moveByArrow(event, target, cursorRef) || chooseByDigit(event, target, cursorRef) || chooseAtCursor(event, target, cursorRef)) return
  if (!CLOSE_KEYS.has(event.key)) return
  event.preventDefault()
  target.onRequestClose()
}
