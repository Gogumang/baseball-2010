import { describe, expect, it } from 'vitest'
import { baseRunnerDrawsOf, loopingAnimationStepAt, showsBaseRunners } from '@/widgets/batting-stage/lib/baseRunners'
import { BATTER_SIDE } from '@/widgets/batting-stage/lib/stageLayout'

describe('타석 화면 루상 주자 0x35b94', () => {
  const 만루 = { first: true, second: true, third: true }

  it('만루 좌타 — 1루 창 (203,148) · 주자 (220,172) · 2루 실루엣 (px − 0x1b, 170) · 3루 뒤집은 창 (3,148) · 주자 (20,172)', () => {
    expect(baseRunnerDrawsOf(만루, BATTER_SIDE.좌타)).toEqual([
      { kind: 'window', x: 203, y: 148, isMirrored: false },
      { kind: 'runner', animation: 0, x: 220, y: 172, isSilhouette: false },
      { kind: 'runner', animation: 1, x: 83 - 0x1b, y: 170, isSilhouette: true },
      { kind: 'window', x: 3, y: 148, isMirrored: true },
      { kind: 'runner', animation: 2, x: 20, y: 172, isSilhouette: false },
    ])
  })

  it('우타면 2루 주자만 px − 5 (투수 앵커 156)', () => {
    expect(baseRunnerDrawsOf({ first: false, second: true, third: false }, BATTER_SIDE.우타)).toEqual([
      { kind: 'runner', animation: 1, x: 151, y: 170, isSilhouette: true },
    ])
  })

  it('빈 루는 아무것도 안 그린다 · 0x13(타격)에선 안 그린다', () => {
    expect(baseRunnerDrawsOf({ first: false, second: false, third: false }, 0)).toEqual([])
    expect(showsBaseRunners({ kind: '타격', tick: 0, isPaused: false })).toBe(false)
    expect(showsBaseRunners({ kind: '대기', tick: 0, isPaused: true })).toBe(true)
    expect(showsBaseRunners(undefined)).toBe(true)
  })

  it('애니는 칸 길이 max(1, 지연) 로 돌고 끝나면 처음으로 — (dx, dy) 를 같이 낸다', () => {
    const entries = [{ frame: 0, delay: 3, dx: 1, dy: 0 }, { frame: 1, delay: 0, dx: 2, dy: -1 }]
    expect(loopingAnimationStepAt(entries, 0)).toEqual({ frame: 0, dx: 1, dy: 0 })
    expect(loopingAnimationStepAt(entries, 2)).toEqual({ frame: 0, dx: 1, dy: 0 })
    expect(loopingAnimationStepAt(entries, 3)).toEqual({ frame: 1, dx: 2, dy: -1 })
    expect(loopingAnimationStepAt(entries, 4)).toEqual({ frame: 0, dx: 1, dy: 0 })
    expect(loopingAnimationStepAt([], 4)).toBeNull()
  })
})
