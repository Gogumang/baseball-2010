// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import {
  addSkinStepCounter,
  resetSkinStepCounter,
  skinStepCounterValue,
  useMirrorSkinStepCounter,
  useSkinStepCounterValue,
  useSkinStepDrawCounter,
} from '@/shared/lib/skinStepCounter/skinStepCounter'

afterEach(cleanup)

function GameSettingsWindow({ tick }: { readonly tick: number }) {
  return <span data-counter={useSkinStepDrawCounter(tick)} />
}
function EntryEditor({ keyPresses }: { readonly keyPresses: number }) {
  useMirrorSkinStepCounter(keyPresses)
  return null
}
function RankBoard() {
  return <span data-counter={useSkinStepCounterValue()} />
}
const counterOf = (container: HTMLElement) => Number(container.querySelector('span')?.dataset.counter)

describe('키·그림 셈 [skin+0x40c] — 앱에 하나 (r166)', () => {
  it('경기설정 창 0x6042c 는 그릴 때마다 +1 하고 올린 뒤 값을 본다 — 앞 화면이 남긴 값에서 잇는다', () => {
    resetSkinStepCounter()
    addSkinStepCounter(6)
    const 창 = render(<GameSettingsWindow tick={0} />)
    expect(counterOf(창.container)).toBe(7)
    창.rerender(<GameSettingsWindow tick={3} />)
    expect(counterOf(창.container)).toBe(10)
    창.rerender(<GameSettingsWindow tick={3} />)
    expect(skinStepCounterValue()).toBe(10)
  })

  it('엔트리 편집기 0x5561c 는 열 때 0 으로 — 편집기 키 수가 그대로 다음 화면으로 넘어간다', () => {
    resetSkinStepCounter()
    addSkinStepCounter(9)
    const 화면 = render(<EntryEditor keyPresses={0} />)
    expect(skinStepCounterValue()).toBe(0)
    화면.rerender(<EntryEditor keyPresses={3} />)
    cleanup()
    const 창 = render(<GameSettingsWindow tick={0} />)
    expect(counterOf(창.container)).toBe(4)
  })

  it('순위 판 키 0x5787c 는 +1 — 읽기만 하는 판이 다시 그린다', () => {
    resetSkinStepCounter()
    const 판 = render(<RankBoard />)
    expect(counterOf(판.container)).toBe(0)
    act(() => addSkinStepCounter())
    expect(counterOf(판.container)).toBe(1)
  })
})
