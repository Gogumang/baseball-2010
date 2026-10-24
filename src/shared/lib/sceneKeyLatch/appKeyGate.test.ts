// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { installAppKeyGate } from '@/shared/lib/sceneKeyLatch/appKeyGate'
import type { AppKeyGate } from '@/shared/lib/sceneKeyLatch/appKeyGate'
import { markCommonWindowShown, markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

describe('앱 키 문 — 장면 밖 · 공용 창의 받은 칸 0xbca05 (틀 T 의 키는 틀 T+1 에, 칸 하나)', () => {
  let gate: AppKeyGate
  let 받은키: string[]
  const 듣기 = (event: KeyboardEvent) => 받은키.push(`${event.type === 'keyup' ? '뗌 ' : ''}${event.key}${event.repeat ? '(되풀이)' : ''}`)

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'clearTimeout', 'Date'] })
    resetCommonWindowShownForTest()
    받은키 = []
    gate = installAppKeyGate(window)
    window.addEventListener('keydown', 듣기)
    window.addEventListener('keyup', 듣기)
  })
  afterEach(() => {
    window.removeEventListener('keydown', 듣기)
    window.removeEventListener('keyup', 듣기)
    gate.uninstall()
    resetCommonWindowShownForTest()
    vi.useRealTimers()
  })

  const 한틱 = () => vi.advanceTimersByTime(millisecondsPerFrame())

  it('받은 틱에는 화면에 안 가고 다음 앱 틱 머리에 간다', () => {
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(받은키).toEqual([])
    한틱()
    expect(받은키).toEqual(['ArrowDown'])
  })

  it('한 틀에 누름이 둘이면 뒤 키만 · 뗌도 마지막 하나 · 누름 먼저 (0x39f4c · 0x39f68 덮어쓰기)', () => {
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyUp(window, { key: '2' })
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyUp(window, { key: '8' })
    한틱()
    expect(받은키).toEqual(['8', '뗌 8'])
  })

  it('틱이 다른 키는 틱마다 하나씩', () => {
    fireEvent.keyDown(window, { key: '4' })
    한틱()
    fireEvent.keyDown(window, { key: '6' })
    expect(받은키).toEqual(['4'])
    한틱()
    expect(받은키).toEqual(['4', '6'])
  })

  it('브라우저 자동 되풀이는 버린다 — 장면 밖 · 창은 누름 [+0x40] 만 본다(되풀이 [+0x38] 은 0x498d4 만)', () => {
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    한틱()
    fireEvent.keyDown(window, { key: 'ArrowDown', repeat: true })
    한틱()
    fireEvent.keyDown(window, { key: 'ArrowDown', repeat: true })
    한틱()
    expect(받은키).toEqual(['ArrowDown'])
  })

  it('경기 장면이 서 있고 창이 없으면 장면 칸 몫이라 그냥 지나 보낸다 · 창이 서면 문이 다음 틱에 넘긴다(52cc6)', () => {
    const 장면 = markGameSceneUp()
    fireEvent.keyDown(window, { key: '*' })
    expect(받은키).toEqual(['*'])
    const 창 = markCommonWindowShown()
    fireEvent.keyDown(window, { key: '*' })
    expect(받은키).toEqual(['*'])
    한틱()
    expect(받은키).toEqual(['*', '*'])
    창()
    장면()
  })

  it('폰에 없는 키 · 수식 키 · 글 입력칸은 곧바로', () => {
    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    const 칸 = document.createElement('input')
    document.body.appendChild(칸)
    fireEvent.keyDown(칸, { key: 'Backspace' })
    expect(받은키).toEqual(['a', '1', 'Backspace'])
    칸.remove()
  })

  it('다시 쏜 사건은 원래 받을 곳(초점 요소)으로 간다', () => {
    const 단추 = document.createElement('button')
    document.body.appendChild(단추)
    const 단추키 = vi.fn()
    단추.addEventListener('keydown', 단추키)
    fireEvent.keyDown(단추, { key: 'Enter' })
    expect(단추키).not.toHaveBeenCalled()
    한틱()
    expect(단추키).toHaveBeenCalledTimes(1)
    단추.remove()
  })
})
