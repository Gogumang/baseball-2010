// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import { resetSetupRecord } from '@/pages/general-mode/model/setupRecord'

beforeEach(() => resetSetupRecord())
afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 열림 = { openedAcePitcherIds: [0, 1, 2, 3, 4], openedAceBatterIds: [0, 1, 2, 3, 4] }

const 블록쓰기빠른실행 = () => {
  const random = createSeededRandom(20100901)
  const write = vi.fn()
  return { random, write, ...renderHook(() => useGeneralMode({ random, isQuickStart: true, ...열림, onMatchBlockWrite: write })) }
}

describe('B-30 경기정보 OK 없이도 모드 1 블록을 새 경기로 덮음 (0x30f20 31134 · 0x2a370 2a45a)', () => {
  it('원본: 22 들어옴 · 23 나감마다 블록을 쓴다', () => {
    const { result, write } = 블록쓰기빠른실행()
    expect(write).toHaveBeenCalledTimes(1)
    act(() => result.current.actions.openEntry(false))
    act(() => result.current.actions.pressEntryKey('취소'))
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('고침: OK 전에는 쓰지 않는다 — 옛 이어하기 블록이 남는다. 굴림 차례는 같다', () => {
    const 원본 = 블록쓰기빠른실행()
    const 원본다음 = 원본.random.rand(0, 0x7fffffff)
    resetSetupRecord()
    setBugfixConfigForTests(bugfixConfigWith(['B-30']))
    const { result, write, random } = 블록쓰기빠른실행()
    act(() => result.current.actions.openEntry(false))
    act(() => result.current.actions.pressEntryKey('취소'))
    expect(write).not.toHaveBeenCalled()
    expect(result.current.gameOptions).toEqual(원본.result.current.gameOptions)
    expect(random.rand(0, 0x7fffffff)).toBe(원본다음)
  })
})
