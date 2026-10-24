import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSceneKeyLatch, openSceneKeyLatch, pushSceneKey, resetSceneKeyLatchesForTest, runSceneKeys,
} from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

describe('키 사건 칸 0xbca05 — 틀 T 에 받은 키는 틀 T+1 의 키 0x498d4(52d9e)가 처리한다', () => {
  afterEach(() => resetSceneKeyLatchesForTest())

  it('받은 틱의 틀에는 꺼내지 않고, 다음 틱부터 받은 차례대로 꺼낸다', () => {
    let tick = 10
    const 칸 = createSceneKeyLatch(() => tick)
    const 차례: string[] = []
    칸.push(() => 차례.push('4'))
    칸.push(() => 차례.push('5'))
    runSceneKeys(칸, 10)
    expect(차례).toEqual([])
    tick = 11
    칸.push(() => 차례.push('6'))
    runSceneKeys(칸, 11)
    expect(차례).toEqual(['4', '5'])
    runSceneKeys(칸, 12)
    expect(차례).toEqual(['4', '5', '6'])
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
})
