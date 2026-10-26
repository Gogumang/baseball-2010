// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useRef, useState, type ReactNode } from 'react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { useDefenseUnderBurstWindow } from '@/pages/defense/model/useDefenseUnderBurstWindow'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { runWalkPlay } from '@/features/defense-play/model/walkPlay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **돌발 결과 창 0x1c 는 수비 화면 위에 선다** — 0x17 끝 0x528b0 의 0x8f414(52a8e)가 참이면 0x1c(52aa2), 그리기 0x46ee0 이 0x46c88(46ee6)을
 * 그린 뒤 창 0x8f3c0 을 얹는다. 판이 끝난 뒤(0x35108 · onDone)에도 판을 내리지 않고 같은 그림 위에 창을 얹는다.
 */

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 단타: AtBatOutcome = { kind: '안타', bases: 1 }

function 타구(outcome: AtBatOutcome): DefensePlayInput {
  return {
    outcome,
    trajectory: battedBallTrajectory(representativePatternOf(outcome)),
    bases: { first: true, second: false, third: false },
    outs: 0,
  }
}

function 흘리기(frames: number): void {
  for (let i = 0; i < frames; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
}

describe('DefensePlayback.burstWindow — 0x1c', () => {
  it('실시간 판이 끝난 뒤 창을 받으면 판 그림을 그대로 두고 창을 얹는다 — onDone 은 판마다 한 번', () => {
    vi.useFakeTimers()
    const input = 타구(단타)
    const onDone = vi.fn()
    const { container, rerender, queryByTestId } = render(<DefensePlayback input={input} onDone={onDone} />)
    for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) 흘리기(1)
    expect(onDone).toHaveBeenCalledTimes(1)
    const 다른끝 = vi.fn()
    rerender(<DefensePlayback input={input} onDone={다른끝} burstWindow={<div data-testid="돌발창" />} />)
    흘리기(30)
    expect(queryByTestId('돌발창')).not.toBeNull()
    expect(container.firstChild).not.toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(다른끝).not.toHaveBeenCalled()
  })

  it('재생 판도 같다 — 끝난 뒤 창을 받으면 그 판 위에 창', () => {
    vi.useFakeTimers()
    const 밀어내기 = runWalkPlay({ bases: { first: true, second: false, third: false }, outs: 0, pitchJudgement: 3 })
    const onDone = vi.fn()
    const { rerender, queryByTestId } = render(<DefensePlayback ticks={밀어내기.ticks} onDone={onDone} freePassPlay />)
    for (let i = 0; i < 400 && onDone.mock.calls.length === 0; i += 1) 흘리기(1)
    expect(onDone).toHaveBeenCalledTimes(1)
    rerender(
      <DefensePlayback ticks={밀어내기.ticks} onDone={() => onDone()} freePassPlay burstWindow={<div data-testid="돌발창" />} />,
    )
    흘리기(10)
    expect(queryByTestId('돌발창')).not.toBeNull()
    // 0x1c 동안은 키가 창 몫 — 밀어내기 판의 넘기기 누름 칸이 없다
    expect(document.querySelector('[aria-label="넘기기"]')).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe('useDefenseUnderBurstWindow — 판 끝 판정만 판 위 창', () => {
  /** 판 요소 — 몇 번 새로 섰는지 센다 */
  const 섰다 = vi.fn()
  function 판({ window }: { readonly window?: ReactNode }) {
    const mounted = useRef(false)
    if (!mounted.current) {
      mounted.current = true
      섰다()
    }
    return (
      <div data-testid="판">
        {window}
      </div>
    )
  }
  type 단계 = { readonly playing: boolean; readonly resolution: object | null }
  let 바꾸기: (next: 단계) => void = () => {}
  function 화면() {
    const [단계, set단계] = useState<단계>({ playing: true, resolution: null })
    바꾸기 = set단계
    const under = useDefenseUnderBurstWindow(단계.resolution)
    if (단계.playing) return under.show((window) => <판 window={window} />)
    const held = under.held(<div data-testid="창" />)
    if (held !== null) return held
    return <div data-testid="타석">{단계.resolution !== null && <div data-testid="창" />}</div>
  }

  it('판이 끝나며 판정이 서면 같은 판 위에 창 — 창을 닫으면 타석', () => {
    섰다.mockClear()
    const { queryByTestId } = render(<화면 />)
    expect(queryByTestId('판')).not.toBeNull()
    act(() => 바꾸기({ playing: false, resolution: {} }))
    expect(queryByTestId('판')).not.toBeNull()
    expect(queryByTestId('창')).not.toBeNull()
    expect(섰다).toHaveBeenCalledTimes(1)
    act(() => 바꾸기({ playing: false, resolution: null }))
    expect(queryByTestId('판')).toBeNull()
    expect(queryByTestId('타석')).not.toBeNull()
  })

  it('판 밖에서 먼저 본 판정(0x12 끝 — 밀어내기 판 앞 대기)은 판이 끝나도 판 위 창이 아니다', () => {
    const 판정 = {}
    const { queryByTestId } = render(<화면 />)
    act(() => 바꾸기({ playing: false, resolution: 판정 }))
    // 위 갈래 — 판이 막 끝나 판정이 섰다. 창을 닫지 않고 판 밖 그림(타석 대기)이 본 것으로 둔다
    act(() => 바꾸기({ playing: false, resolution: null }))
    act(() => 바꾸기({ playing: false, resolution: 판정 }))
    expect(queryByTestId('타석')).not.toBeNull()
    act(() => 바꾸기({ playing: true, resolution: 판정 }))
    act(() => 바꾸기({ playing: false, resolution: 판정 }))
    expect(queryByTestId('판')).toBeNull()
    expect(queryByTestId('타석')).not.toBeNull()
  })
})
