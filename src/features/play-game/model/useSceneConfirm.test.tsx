// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SCENE_CONFIRM_LOCK_FRAMES, useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { chainSceneConfirm, enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function 잠금풀기() {
  act(() => {
    vi.advanceTimersByTime(SCENE_CONFIRM_LOCK_FRAMES * millisecondsPerFrame())
  })
}

function 키(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
}

describe('상태 0xe 의 OK 대기 (0x532b0 · 0x49a26)', () => {
  it('대기 객체가 없으면 기다리지 않는다', () => {
    const { result } = renderHook(() => useSceneConfirm(null, true))
    expect(result.current.isAwaiting).toBe(false)
  })

  it('들어선 뒤 세 갱신 안의 OK 는 먹지 않고, 그 뒤 OK·5·Enter·스페이스 하나로 끝난다', () => {
    const wait = enterSceneConfirm()
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    expect(result.current.isAwaiting).toBe(true)
    키('5')
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    // 0x532b0 은 OK·'5' 말고는 아무 일도 안 한다
    키('4')
    expect(result.current.isAwaiting).toBe(true)
    키('5')
    expect(result.current.isAwaiting).toBe(false)
  })

  it('시간이 아무리 흘러도 스스로 넘어가지 않는다 (0x39bd4)', () => {
    const wait = enterSceneConfirm()
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.isAwaiting).toBe(true)
  })

  it('메뉴가 떠 있으면(canAccept 거짓) OK 를 안 받는다', () => {
    const wait = enterSceneConfirm()
    const { result, rerender } = renderHook(({ canAccept }) => useSceneConfirm(wait, canAccept), {
      initialProps: { canAccept: false },
    })
    잠금풀기()
    키('Enter')
    expect(result.current.isAwaiting).toBe(true)
    expect(result.current.acceptsConfirm).toBe(false)
    rerender({ canAccept: true })
    // 덮개가 걷힌 뒤로 다시 세 갱신을 잠근다
    키('Enter')
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    키('Enter')
    expect(result.current.isAwaiting).toBe(false)
  })

  it('같은 걸음에 0xe 를 두 번 지났으면 OK 를 두 번 받아야 하고, 두 번째도 잠금이 다시 걸린다', () => {
    const wait = chainSceneConfirm(enterSceneConfirm())
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    잠금풀기()
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(true)
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(false)
  })

  it('받은 OK 는 대기 객체에 남는다 — 화면이 다시 서도 다시 기다리지 않고, 새 객체면 다시 기다린다', () => {
    const wait: SceneConfirmWait = enterSceneConfirm()
    const first = renderHook(() => useSceneConfirm(wait, true))
    잠금풀기()
    act(() => first.result.current.confirm())
    first.unmount()
    const again = renderHook(() => useSceneConfirm(wait, true))
    expect(again.result.current.isAwaiting).toBe(false)
    const next = renderHook(() => useSceneConfirm(enterSceneConfirm(), true))
    expect(next.result.current.isAwaiting).toBe(true)
  })
})
