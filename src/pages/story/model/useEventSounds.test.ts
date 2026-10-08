// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { StrictMode, createElement, type ReactNode } from 'react'
import { useEventSounds } from '@/pages/story/model/useEventSounds'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import type { EventStep } from '@/entities/story/model/eventScript'

afterEach(() => {
  setActiveSound(null)
  vi.useRealTimers()
})

describe('이벤트 소리 명령을 그 틀에 낸다 (0x8d470)', () => {
  it('지나온 소리를 차례대로 한 번씩 — StrictMode 의 이펙트 재실행에도 한 번', () => {
    vi.useFakeTimers()
    const calls: string[] = []
    setActiveSound({
      ...createSilentSound(),
      play: (id) => { calls.push(`효과 ${id}`) },
      playBgm: (id) => { calls.push(`배경 ${id}`) },
      stopBgm: () => { calls.push('멈춤') },
    })
    const step: EventStep = {
      cursor: { eventId: 1, commandIndex: 2 },
      command: null,
      passed: [{ op: 'sound', id: 41 }, { op: 'sound', id: 35 }],
    }
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
    renderHook(() => useEventSounds(step), { wrapper })
    vi.advanceTimersByTime(1000)
    expect(calls).toEqual(['배경 40', '멈춤', '효과 34'])
  })
})
