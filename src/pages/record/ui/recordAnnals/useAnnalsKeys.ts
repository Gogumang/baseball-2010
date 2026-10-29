import { useEffect } from 'react'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
import { annalsDirectionOf } from '@/pages/record/ui/recordAnnals/annalsAssets'

const DIGIT_KEY = /^[0-9]$/
const CLEAR_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])
/** 탭 막대 초점의 날 키 (격자 키 처리를 안 거친다): ← '4' · → '6' 은 탭, OK · '5' · ↓ 는 본문으로. '2' · '8' · ↑ 은 아무것도 안 한다 */
const TAB_STEP_BY_KEY: ReadonlyMap<string, number> = new Map([
  ['ArrowLeft', -1],
  ['4', -1],
  ['ArrowRight', 1],
  ['6', 1],
])
const ENTER_BODY_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5', 'ArrowDown'])

interface AnnalsKeysInput {
  readonly isTabFocused: boolean
  /** 판이 다 열렸다 — 여는 중이고 끝났고 높이 212 (0x2b87c~0x2b8b6) */
  readonly isPanelOpen: boolean
  /** 숫자 키 — 비밀 번호 버퍼 (0x2b7b4~0x2b838, 탭·초점 · 판 열림과 상관없다) */
  readonly onDigit: (key: string) => void
  readonly onClear: () => void
  readonly onTabStep: (step: number) => void
  readonly onEnterBody: () => void
  /** 본문 날 키 — 스크롤 객체에도 넘긴다 (0x2b876 → 0x61ce4) */
  readonly onBodyKey: (key: string) => void
  readonly onBodyDirection: (direction: AnnalsDirection) => void
}

/** 탭 막대 초점 갈래 */
function handleTabKey(event: KeyboardEvent, { onTabStep, onEnterBody }: AnnalsKeysInput): void {
  const step = TAB_STEP_BY_KEY.get(event.key) ?? 0
  if (step !== 0) {
    event.preventDefault()
    return onTabStep(step)
  }
  if (ENTER_BODY_KEYS.has(event.key)) {
    event.preventDefault()
    onEnterBody()
  }
}

/** 본문 갈래 — 격자가 숫자 2·4·6·8 을 방향으로 바꾼다 (표 0xd2e7c) */
function handleBodyKey(event: KeyboardEvent, { onBodyKey, onBodyDirection }: AnnalsKeysInput): void {
  onBodyKey(event.key)
  const direction = annalsDirectionOf(event.key)
  if (direction === null) return
  event.preventDefault()
  onBodyDirection(direction)
}

/** 기록연감 키 — 갱신 0x2b7a0. effect 는 옛처럼 의존성 없이 그림마다 다시 건다 */
export function useAnnalsKeys(input: AnnalsKeysInput) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event
      if (DIGIT_KEY.test(key)) input.onDigit(key)
      // 본문 초점이면([skin+0xf6] == 0, 2b846) 격자가 바꾼 키를 0x5550d 에 넘긴다(2b85c) — [skin+0x8c] 에 남는다(Q-10). 판 열림 앞이다
      const notedDirection = input.isTabFocused ? null : annalsDirectionOf(key)
      if (notedDirection !== null) noteSkinShakeDirection(notedDirection)
      // 판이 다 열리기 전·닫는 중에는 키를 안 받는다 (0x2b87c — 비밀 번호 버퍼 0x2b7b4 는 그 앞이라 받는다)
      if (!input.isPanelOpen) return
      if (CLEAR_KEYS.has(key)) {
        event.preventDefault()
        return input.onClear()
      }
      if (input.isTabFocused) return handleTabKey(event, input)
      handleBodyKey(event, input)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
