// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 저장소 하나를 흉내 낸다 — 무엇이 적혔는지까지 본다 */
function 메모리저장(held: unknown = null): JsonStorePort & { readonly 적힌것: () => unknown } {
  let saved = held
  return {
    load: () => saved,
    save: (value) => {
      saved = value
    },
    적힌것: () => saved,
  }
}

const 주소바꾸기 = (search: string) => {
  window.history.replaceState({}, '', `/${search}`)
}

beforeEach(() => {
  window.localStorage.clear()
  주소바꾸기('')
})
afterEach(() => {
  window.localStorage.clear()
  주소바꾸기('')
})

describe('지갑 한 칸 (mgr[+0x64])', () => {
  it('보상을 쌓고 값을 치른다', () => {
    const store = 메모리저장({ gamePoint: 1000 })
    const rendered = renderHook(() => useGamePointWallet(store))

    act(() => rendered.result.current.gain(500))
    expect(rendered.result.current.balance).toBe(1500)

    act(() => rendered.result.current.spend(1200))
    expect(rendered.result.current.balance).toBe(300)
    expect(store.적힌것()).toEqual({ gamePoint: 300 })
  })

  it('모자라면 한 푼도 안 깎인다 (0xa46e)', () => {
    const store = 메모리저장({ gamePoint: 999 })
    const rendered = renderHook(() => useGamePointWallet(store))

    act(() => rendered.result.current.spend(1000))
    expect(rendered.result.current.balance).toBe(999)
    expect(rendered.result.current.canAfford(999)).toBe(true)
  })
})

describe('⚠️ 옛 세이브 이사 — 모아 둔 G가 사라지면 안 된다', () => {
  it('지갑 칸이 없으면 옛 `career.gamePoint` 를 옮겨 오고 **곧바로 저장한다**', () => {
    const store = 메모리저장(null)
    const rendered = renderHook(() => useGamePointWallet(store, 4500))

    expect(rendered.result.current.balance).toBe(4500)
    // 한 번 옮겨 적어 두어야 다음 실행 때 옛 값(그 사이 달라졌을 수 있다)을 다시 안 본다
    expect(store.적힌것()).toEqual({ gamePoint: 4500 })
  })

  it('이사한 뒤에 쓴 값이 옛 세이브에 되돌아가지 않는다', () => {
    const store = 메모리저장(null)
    const 첫판 = renderHook(() => useGamePointWallet(store, 4500))
    act(() => 첫판.result.current.spend(1500))
    첫판.unmount()

    // 새로고침 — 옛 세이브는 아직 4500 을 들고 있지만 지갑 칸이 이긴다
    const 둘째판 = renderHook(() => useGamePointWallet(store, 4500))
    expect(둘째판.result.current.balance).toBe(3000)
  })
})

describe('`?무한G` 스위치', () => {
  it('보여 주는 값과 판정이 **같은 99999** 를 본다', () => {
    주소바꾸기('?무한G')
    const store = 메모리저장({ gamePoint: 10 })
    const rendered = renderHook(() => useGamePointWallet(store))

    expect(rendered.result.current.balance).toBe(99999)
    expect(rendered.result.current.canAfford(2000)).toBe(true)
  })

  it('저장에는 손대지 않는다 — 스위치를 끄면 원래 값이 그대로다', () => {
    주소바꾸기('?무한G')
    const store = 메모리저장({ gamePoint: 10 })
    const 켠판 = renderHook(() => useGamePointWallet(store))
    act(() => 켠판.result.current.spend(2000))
    expect(켠판.result.current.balance).toBe(99999)
    켠판.unmount()

    주소바꾸기('')
    const 끈판 = renderHook(() => useGamePointWallet(store))
    expect(끈판.result.current.balance).toBe(10)
  })
})
