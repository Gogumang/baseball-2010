// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useHitByPitchWait } from '@/pages/defense/model/useHitByPitchWait'
import type { HitByPitchHoldPhase } from '@/features/play-game/model/benchClearingScene'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { resetSceneParticleManagerForTest, sceneParticleScene } from '@/entities/particle/model/sceneParticleManager'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetSceneParticleManagerForTest()
})

type Hold = { readonly phase: HitByPitchHoldPhase } | null

function 세우기(waitTicks: number, random: RandomPort = createSeededRandom(1), 차례: string[] = []) {
  let hold: Hold = { phase: 'wait' }
  let isFrozen = false
  const rendered = renderHook(() =>
    useHitByPitchWait({
      hold,
      waitTicks,
      isFrozen,
      random,
      onJudge: () => {
        차례.push('판정')
        hold = { phase: 'entry' }
        rendered.rerender()
      },
      onEnter: () => {
        차례.push('진입')
        hold = { phase: 'scene' }
        rendered.rerender()
      },
    }),
  )
  return {
    차례,
    틱: (count: number) => act(() => vi.advanceTimersByTime(millisecondsPerFrame() * count)),
    얼림: (value: boolean) => {
      isFrozen = value
      rendered.rerender()
    },
  }
}

describe('사구의 0x12 대기 → 판정 → 진입 (A-22)', () => {
  it('붙든 칸이 보인 그림부터 waitTicks 번째 장면 틱에 판정하고, 다음 틱에 진입한다', () => {
    vi.useFakeTimers()
    const 판 = 세우기(31)
    판.틱(30)
    expect(판.차례).toEqual([])
    판.틱(1)
    expect(판.차례).toEqual(['판정'])
    판.틱(1)
    expect(판.차례).toEqual(['판정', '진입'])
    // 연출 단계는 연출(`BenchClearingScene`)이 맡는다
    판.틱(5)
    expect(판.차례).toEqual(['판정', '진입'])
  })

  it('팝업이 0x12 틱을 세우면(0x52cc6) 대기도 선다', () => {
    vi.useFakeTimers()
    const 판 = 세우기(31)
    판.틱(10)
    판.얼림(true)
    판.틱(40)
    expect(판.차례).toEqual([])
    판.얼림(false)
    판.틱(20)
    expect(판.차례).toEqual([])
    판.틱(1)
    expect(판.차례).toEqual(['판정'])
  })

  it('판정 앞 틀의 관리자 틱이 아직이면 판정보다 먼저 돌린다 — 그 앱 틀은 다시 안 굴린다', () => {
    vi.useFakeTimers()
    const 판: { 차례: string[] } = { 차례: [] }
    const inner = createSeededRandom(3)
    const random: RandomPort = {
      rand: (lo, hi) => {
        판.차례.push('입자')
        return inner.rand(lo, hi)
      },
      rand9d: (n) => {
        if (n > 0) 판.차례.push('입자')
        return inner.rand9d(n)
      },
    }
    emitParticles(
      sceneParticleScene(),
      {
        ang: 0,
        spread: 0,
        spd: 0,
        spdR: 0,
        emit: 1,
        emitR: 0,
        life: 40,
        lifeR: 0,
        a0: 0,
        a0R: 0,
        a1: 0,
        a1R: 0,
        ax: 0,
        ay: 0,
        w: 0,
        h: 0,
        total: 50,
        mode: 2,
      },
      0,
      0,
      0,
    )
    const 세운 = 세우기(3, random, 판.차례)
    세운.틱(2)
    const 앞 = 판.차례.length
    세운.틱(1)
    // 판정 틀의 콜백 — 앞 틀의 관리자 틱(입자 굴림)이 먼저, 판정이 뒤 (renderHook 에는 타석 장면이 없어 이 훅이 대신 굴린다)
    const 이번 = 판.차례.slice(앞)
    expect(이번[이번.length - 1]).toBe('판정')
    expect(이번.slice(0, -1).length).toBeGreaterThan(0)
    expect(이번.slice(0, -1).every((entry) => entry === '입자')).toBe(true)
  })
})
