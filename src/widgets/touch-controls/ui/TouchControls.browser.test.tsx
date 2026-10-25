import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { commands, userEvent } from 'vitest/browser'
import '@/app/styles/global.css'
import { ViewportShell } from '@/app/ui/ViewportShell'
import { offerTouchKey, resetTouchKeyOffersForTest } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'

/**
 * **브라우저 시험 — 세로 폰에서 게임 화면 아래 칸의 상황 버튼이 실제로 눌리는가** (아이폰 Safari 의심 · r208).
 *
 * 앱 껍데기를 그대로 세운다: 전역 CSS(`body` 격자 · `#root` · `#keypad-root`), `ViewportShell`(`useViewportFit` 이 `--zoom` ·
 * `--game-height` 를 적고 `TouchControls` 를 `#keypad-root` 에 세운다), 화면 판 `RawScreen`(`zoom: var(--zoom)`)과 그 위 화면 전체
 * 누름 칸(경기 화면의 OK 탭 칸과 같은 꼴). 버튼 가운데의 맨 위 요소가 버튼인지, 누르면 그 키의 keydown 이 오는지 본다.
 * webkit 인스턴스는 iPhone 13 꼴(터치 · 모바일)이다.
 */

const BACK = { key: 'Escape', label: '뒤로' } as const

let restoreMatchMedia: (() => void) | null = null
let withdraw: (() => void) | null = null
const hosts: HTMLElement[] = []

/** 데스크톱 chromium 은 `(pointer: coarse)` 가 거짓이라 버튼을 안 세운다 — 그때만 터치 기기로 속인다 */
function forceCoarsePointer(): void {
  if (window.matchMedia('(pointer: coarse)').matches) return
  const original = window.matchMedia.bind(window)
  window.matchMedia = ((query: string) => {
    const list = original(query)
    if (query !== '(pointer: coarse)') return list
    return {
      matches: true,
      media: query,
      onchange: null,
      addEventListener: list.addEventListener.bind(list),
      removeEventListener: list.removeEventListener.bind(list),
      addListener: list.addListener.bind(list),
      removeListener: list.removeListener.bind(list),
      dispatchEvent: list.dispatchEvent.bind(list),
    } as MediaQueryList
  }) as typeof window.matchMedia
  restoreMatchMedia = () => { window.matchMedia = original }
}

function host(id: string): HTMLElement {
  const element = document.createElement('div')
  element.id = id
  document.body.append(element)
  hosts.push(element)
  return element
}

beforeEach(() => {
  resetTouchKeyOffersForTest()
  forceCoarsePointer()
})

afterEach(() => {
  withdraw?.()
  withdraw = null
  cleanup()
  for (const element of hosts.splice(0)) element.remove()
  delete document.body.dataset.layout
  restoreMatchMedia?.()
  restoreMatchMedia = null
})

/** 앱 껍데기 + '뒤로' 상황 버튼 하나 */
async function 세우기() {
  const root = host('root')
  host('keypad-root')
  const screenPresses: string[] = []
  render(
    <RawScreen>
      <PressArea label="확인" onPress={() => screenPresses.push('확인')} />
    </RawScreen>,
    { container: root },
  )
  render(<ViewportShell />, { container: host('shell') })
  act(() => { withdraw = offerTouchKey(BACK) })
  const button = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>('#keypad-root button[data-touch-key="Escape"]')
    expect(found).not.toBeNull()
    return found as HTMLButtonElement
  })
  const keys: string[] = []
  const onKey = (event: KeyboardEvent) => { keys.push(`${event.type}:${event.key}`) }
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  const stopListening = () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
  }
  const screenElement = root.querySelector('[data-original-screen]') as HTMLElement
  return { button, keys, stopListening, screenPresses, screenElement, root }
}

const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

describe('상황 버튼 — 게임 화면 바깥 칸', () => {
  it('터치 배치가 서고 버튼은 화면 판 바깥(세로면 아래 · 가로면 왼쪽)에 있다', async () => {
    const { button, screenElement, stopListening } = await 세우기()
    stopListening()
    const layout = document.body.dataset.layout
    const buttonBox = button.getBoundingClientRect()
    const screenBox = screenElement.getBoundingClientRect()
    // 아이폰 세로(390×664)는 below, 데스크톱 chromium 창(1000×800)은 가로라 sides
    expect(layout).toBe(window.innerWidth < window.innerHeight ? 'below' : 'sides')
    if (layout === 'below') expect(buttonBox.top).toBeGreaterThanOrEqual(Math.floor(screenBox.bottom))
    else expect(buttonBox.right).toBeLessThanOrEqual(Math.ceil(screenBox.left))
  })

  it('버튼 가운데의 맨 위 요소는 그 버튼이다 (elementFromPoint)', async () => {
    const { button, stopListening } = await 세우기()
    stopListening()
    const center = centerOf(button)
    const top = document.elementFromPoint(center.x, center.y)
    expect(top === null ? null : top.closest('button[data-touch-key]')).toBe(button)
  })

  it('클릭(Playwright 마우스)하면 그 키의 keydown · keyup 이 오고 화면 누름 칸은 안 눌린다', async () => {
    const { button, keys, stopListening, screenPresses } = await 세우기()
    await userEvent.click(button)
    await waitFor(() => expect(keys).toContain('keyup:Escape'))
    stopListening()
    expect(keys.filter((key) => key.endsWith(':Escape'))).toEqual(['keydown:Escape', 'keyup:Escape'])
    expect(screenPresses).toEqual([])
  })

  it('손가락 탭(Playwright touchscreen — 터치 맥락에서)도 keydown 이 온다', async () => {
    const { button, keys, stopListening, screenPresses } = await 세우기()
    const center = centerOf(button)
    const how = await commands.touchTap(center.x, center.y)
    await waitFor(() => expect(keys).toContain('keydown:Escape'))
    stopListening()
    expect(screenPresses).toEqual([])
    // 웹킷 아이폰 인스턴스는 진짜 터치여야 한다(데스크톱 chromium 은 마우스)
    if (navigator.maxTouchPoints > 0) expect(how).toBe('touch')
  })
})
