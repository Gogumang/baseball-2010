import { describe, expect, it } from 'vitest'
import {
  aceRunnerFramesOf,
  baseRunnerDrawsOf,
  createRunnerAnimationClock,
  grayRunPipPixel,
  halfShadeRunnerPixel,
  loopingAnimationStepAt,
  runPipCountOf,
  runPipDrawsOf,
  runnerBoxAnchorOf,
  showsBaseRunners,
  stepRunnerAnimationClock,
} from '@/widgets/batting-stage/lib/baseRunners'
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

describe('상태 0xe 주루 칸 — 0x35b94 의 35f4e~3604c', () => {
  it('상자 잡는 점은 그리는 점과 다르다 — 1·3루는 7 위(y0 + 0x18), 2루는 py − 0x15', () => {
    expect(runnerBoxAnchorOf('first', BATTER_SIDE.좌타)).toEqual({ x: 220, y: 165 })
    expect(runnerBoxAnchorOf('second', BATTER_SIDE.좌타)).toEqual({ x: 83 - 0x1b, y: 167 })
    expect(runnerBoxAnchorOf('second', BATTER_SIDE.우타)).toEqual({ x: 151, y: 167 })
    expect(runnerBoxAnchorOf('third', BATTER_SIDE.좌타)).toEqual({ x: 20, y: 165 })
  })

  it('켜진 칸 n = 주력 / 0x14d + 1 — 0..332 → 1 · 333 → 2 · 999 → 4', () => {
    expect([0, 332, 333, 665, 666, 998, 999].map(runPipCountOf)).toEqual([1, 1, 2, 2, 3, 3, 4])
  })

  it('x0 = 상자x − ((0x16 − 상자w) >> 1), 6px 간격 넷 — n 개는 그대로, 나머지는 효과 0xa', () => {
    const box = { x: 100, y: 50, width: 12, height: 20 }
    expect(runPipDrawsOf('first', box, 400)).toEqual([
      { x: 95, y: 78, isEmpty: false },
      { x: 101, y: 78, isEmpty: false },
      { x: 107, y: 78, isEmpty: true },
      { x: 113, y: 78, isEmpty: true },
    ])
    expect(runPipDrawsOf('third', box, 999).every((pip) => !pip.isEmpty)).toBe(true)
    expect(runPipDrawsOf('third', box, 999)).toHaveLength(4)
  })

  it('2루는 머리 위 — y = 상자y − 2', () => {
    const pips = runPipDrawsOf('second', { x: 60, y: 160, width: 9, height: 20 }, 0)
    expect(pips.map((pip) => [pip.x, pip.y, pip.isEmpty])).toEqual([
      [54, 158, false],
      [60, 158, true],
      [66, 158, true],
      [72, 158, true],
    ])
  })

  it('효과 0xa 회색 0x97f01 — s = R5 + G5 + B5 + 3, g = s/4 + s/16 + s/64', () => {
    // 흰색: s = 31·3 + 3 = 96 → g = 24 + 6 + 1 = 31 → 565 0xffdf (초록 6비트 칸은 g << 1 = 62 라 한 단 어둡다)
    expect(grayRunPipPixel(255, 255, 255)).toEqual({ r: 255, g: 251, b: 255 })
    // 순수 빨강: s = 34 → g = 8 + 2 + 0 = 10 → R5 10 · G6 20
    expect(grayRunPipPixel(255, 0, 0)).toEqual({ r: 82, g: 81, b: 82 })
  })
})


describe('루상 주자 애니 시계 — 장면 +0xf24 애니 0~2 (0x35b94 의 0x93d91 진행 뒤 0x93cfd 켜기)', () => {
  it('첫 부름은 칸 0 을 그리고, 그 뒤 부를 때마다 한 칸씩 — 주자가 없는 루 · 숨긴 루는 안 나아간다', () => {
    const clock = createRunnerAnimationClock()
    const bases = { first: true, second: true, third: false }
    expect(stepRunnerAnimationClock(clock, bases, [], 1)).toEqual([0, 0, null])
    expect(stepRunnerAnimationClock(clock, bases, [2], 3)).toEqual([3, null, null])
    expect(stepRunnerAnimationClock(clock, { first: true, second: true, third: true }, [], 1)).toEqual([4, 1, 0])
  })

  it('타석 화면이 다시 서도(같은 시계) 이어진다 — 되감는 곳이 없다', () => {
    const clock = createRunnerAnimationClock()
    stepRunnerAnimationClock(clock, { first: true, second: false, third: false }, [], 10)
    expect(stepRunnerAnimationClock(clock, { first: true, second: false, third: false }, [], 1)).toEqual([10, null, null])
  })
})

describe('효과 0xc 한 픽셀 0x98351 — ((c & 0xf7de) >> 1) + ((인자 & 0xf7de) >> 1)', () => {
  it('인자 0 이면 565 채널마다 반(내림) — 흰색은 반쯤 어두운 회색, 검정은 검정', () => {
    expect(halfShadeRunnerPixel(255, 255, 255)).toEqual({ r: 123, g: 125, b: 123 })
    expect(halfShadeRunnerPixel(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
    expect(halfShadeRunnerPixel(248, 0, 0)).toEqual({ r: 123, g: 0, b: 0 })
  })

  it('인자 색과 반반 섞는다 — 인자 흰색(0xffff)이면 검정이 반 밝기', () => {
    expect(halfShadeRunnerPixel(0, 0, 0, 0xffff)).toEqual({ r: 123, g: 125, b: 123 })
  })
})

describe('루상 마선수 주자 그림 (0x35c62 · 0x79e3d · 0x79da9)', () => {
  it('마선수 주자면 실린 마선수(+0x1c) 그림, 아니면 null(defender)', () => {
    expect(aceRunnerFramesOf(true, 4)).toBe('./sprites/defender_tiger/frames')
    expect(aceRunnerFramesOf(true, 0)).toBe('./sprites/defender_medica/frames')
    expect(aceRunnerFramesOf(false, 4)).toBeNull()
    expect(aceRunnerFramesOf(true, null)).toBeNull()
  })
})
