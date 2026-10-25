// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import {
  createSceneKeyLatch, isRunningSceneKeys, openSceneKeyLatch, pushSceneKey, resetSceneKeyLatchesForTest, runSceneKeys,
} from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

describe('키 사건 칸 0xbca05 — 틀 T 에 받은 키는 틀 T+1 의 키 0x498d4(52d9e)가 처리한다', () => {
  afterEach(() => resetSceneKeyLatchesForTest())

  it('받은 틱의 틀에는 꺼내지 않고, 다음 틱부터 틱 차례로 꺼낸다', () => {
    let tick = 10
    const 칸 = createSceneKeyLatch(() => tick)
    const 차례: string[] = []
    칸.push(() => 차례.push('4'))
    runSceneKeys(칸, 10)
    expect(차례).toEqual([])
    tick = 11
    칸.push(() => 차례.push('6'))
    runSceneKeys(칸, 11)
    expect(차례).toEqual(['4'])
    runSceneKeys(칸, 12)
    expect(차례).toEqual(['4', '6'])
  })

  it('받은 칸은 하나다 — 한 틀에 누름이 둘 오면 뒤 키만, 뗌도 마지막 하나만 남고 누름 먼저 · 뗌 나중 (0x39f4c · 0x39f68)', () => {
    const 칸 = createSceneKeyLatch(() => 10)
    const 차례: string[] = []
    칸.push(() => 차례.push('뗌 8'), 'release')
    칸.push(() => 차례.push('4'))
    칸.push(() => 차례.push('뗌 9'), 'release')
    칸.push(() => 차례.push('5'))
    runSceneKeys(칸, 11)
    expect(차례).toEqual(['5', '뗌 9'])
  })

  it('처리에 상태 틱을 넘긴다 — 안 주면 꺼낸 틱', () => {
    const 칸 = createSceneKeyLatch(() => 3)
    const 받은틱: number[] = []
    칸.push((stateTick) => 받은틱.push(stateTick))
    runSceneKeys(칸, 4, 1)
    칸.push((stateTick) => 받은틱.push(stateTick))
    runSceneKeys(칸, 5)
    expect(받은틱).toEqual([1, 5])
  })

  it('처리하는 동안만 `isRunningSceneKeys` 가 참이다', () => {
    const 칸 = createSceneKeyLatch(() => 0)
    const 본값: boolean[] = []
    칸.push(() => 본값.push(isRunningSceneKeys()))
    runSceneKeys(칸, 1)
    expect(본값).toEqual([true])
    expect(isRunningSceneKeys()).toBe(false)
  })

  it('창이 선 틀(52cc6)에는 버린다', () => {
    const 칸 = createSceneKeyLatch(() => 0)
    const 처리 = vi.fn()
    칸.push(처리)
    칸.clear()
    runSceneKeys(칸, 5)
    expect(처리).not.toHaveBeenCalled()
  })

  it('화면이 받은 키는 올라 있는 장면 부품의 칸에 든다 — 올린 칸이 없으면 바로 처리한다', () => {
    const 바로 = vi.fn()
    pushSceneKey(바로)
    expect(바로).toHaveBeenCalledTimes(1)
    const 칸 = createSceneKeyLatch(() => 3)
    const 내리기 = openSceneKeyLatch(칸)
    const 다음틀 = vi.fn()
    pushSceneKey(다음틀)
    expect(다음틀).not.toHaveBeenCalled()
    runSceneKeys(칸, 4)
    expect(다음틀).toHaveBeenCalledTimes(1)
    내리기()
    pushSceneKey(바로)
    expect(바로).toHaveBeenCalledTimes(2)
  })

  it('누름 칸이 넘긴 사건 시각이 있으면 그때 본 그림의 틱으로 칸에 든다 (r222 — 도루 누름 칸)', () => {
    // 칸의 셈: 시각 100 에 본 그림은 틱 5, 지금은 틱 7
    const 칸 = createSceneKeyLatch(() => 7, (inputTime) => (inputTime <= 100 ? 5 : 7))
    openSceneKeyLatch(칸)
    const 차례: string[] = []
    pushSceneKey(() => 차례.push('지금'))
    pushSceneKey(() => 차례.push('닿은 때'), 'press', 100)
    // 틱 6 머리 — 틱 5 에 받은 누름만 나온다
    runSceneKeys(칸, 6)
    expect(차례).toEqual(['닿은 때'])
    runSceneKeys(칸, 8)
    expect(차례).toEqual(['닿은 때', '지금'])
  })

  it('손잡이가 없는 폰 키도 받은 칸을 덮는다 — 같은 틀에 스윙 뒤 다른 키가 오면 스윙은 사라진다', () => {
    const 칸 = createSceneKeyLatch(() => 7)
    openSceneKeyLatch(칸)
    const 스윙 = vi.fn()
    const 듣기 = (event: KeyboardEvent) => {
      if (event.key === '5') 칸.push(스윙)
    }
    window.addEventListener('keydown', 듣기)
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '1' })
    runSceneKeys(칸, 8)
    expect(스윙).not.toHaveBeenCalled()
    // 폰에 없는 키(글자 키)는 칸을 덮지 않는다
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: 'a' })
    runSceneKeys(칸, 8)
    expect(스윙).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', 듣기)
  })

  it('한 키 사건의 손잡이 여럿은 한 칸에 붙어 함께 처리된다 — 0x498d4 가 \'*\' 가지와 상태 키 함수에 같은 키를 보내듯', () => {
    const 칸 = createSceneKeyLatch(() => 7)
    openSceneKeyLatch(칸)
    const 차례: string[] = []
    const 조준 = () => 칸.push(() => 차례.push('메시지 8'))
    const 화면 = () => pushSceneKey(() => 차례.push('메뉴'))
    window.addEventListener('keydown', 조준)
    window.addEventListener('keydown', 화면)
    fireEvent.keyDown(window, { key: '*' })
    runSceneKeys(칸, 8)
    expect(차례).toEqual(['메시지 8', '메뉴'])
    window.removeEventListener('keydown', 조준)
    window.removeEventListener('keydown', 화면)
  })
})
