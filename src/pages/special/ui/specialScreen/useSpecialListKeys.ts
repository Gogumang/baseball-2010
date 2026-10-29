import { useEffect } from 'react'

/**
 * 스페셜 목록(하위 6) 갱신 0x28b9c 의 키 (격자 없이 날 키를 본다, r197 직접 뜸):
 * ```
 * ↑(−1) · ←(−3) · '2' · '4'  → 28c56  [this+0x100] = −1 (앞 칸)
 * ↓(−2) · →(−4) · '6' · '8'  → 28c60  [this+0x100] = −2 (뒤 칸)
 * OK(−5) · '5'               → 28c02  고른 칸 열기
 * CLR(−16)                   → 28bfa  하위 4
 * ```
 */
const SPECIAL_LIST_STEP: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', -1],
  ['ArrowLeft', -1],
  ['2', -1],
  ['4', -1],
  ['ArrowDown', 1],
  ['ArrowRight', 1],
  ['6', 1],
  ['8', 1],
])
const OPEN_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
const BACK_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

interface SpecialListKeysInput {
  /** 목록이 서 있고 안내가 없다 */
  readonly isActive: boolean
  /**
   * 0x28ba0~0x28bb4 — 바탕 띠가 자라는 동안([메뉴+0xe2] ≠ 0)은 키를 통째로 버린다.
   * 릴이 도는 동안도 — 0x28ba8 이 `[메뉴+0xe1] == 0` 이면 키를 건너뛰고(0x28c8e), 릴 0x2524c 가 돌기 시작에 0(2537a) · 끝에 1(253ca) (r333)
   */
  readonly isIgnoring: boolean
  /** 앞 칸(−1) · 뒤 칸(+1) — 날 키도 넘긴다(까딱임 방향) */
  readonly onStep: (step: number, key: string) => void
  readonly onOpen: () => void
  readonly onBack: () => void
}

/** 목록 키 — effect 는 옛처럼 의존성 없이 그림마다 다시 건다(그 그림의 커서 · 콜백을 본다) */
export function useSpecialListKeys({ isActive, isIgnoring, onStep, onOpen, onBack }: SpecialListKeysInput) {
  useEffect(() => {
    if (!isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (isIgnoring) return
      const step = SPECIAL_LIST_STEP.get(event.key) ?? 0
      if (step !== 0) {
        event.preventDefault()
        return onStep(step, event.key)
      }
      if (OPEN_KEYS.has(event.key)) {
        event.preventDefault()
        return onOpen()
      }
      if (BACK_KEYS.has(event.key)) {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
