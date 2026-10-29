// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { resetSkinNameBars, skinNameBarsValue, useMarkSkinNameBars } from '@/shared/lib/skinNameBars/skinNameBars'

afterEach(cleanup)

function MarkingScreen({ when }: { readonly when?: boolean }) {
  useMarkSkinNameBars(when)
  return null
}

describe('이름 칸 덧그림 표지 [skin+0x333] — 앱에 하나 (r166)', () => {
  it('부팅 뒤엔 0 (스킨 0 채움) — 스페셜 에디트 0x2b2e0 은 안 세운다', () => {
    resetSkinNameBars()
    render(<MarkingScreen when={false} />)
    expect(skinNameBarsValue()).toBe(0)
  })

  it('엔트리 진입 · 교체 창이 1 을 적으면 화면이 닫혀도 남는다 (0 으로 되돌리는 곳 없음)', () => {
    resetSkinNameBars()
    render(<MarkingScreen />)
    cleanup()
    expect(skinNameBarsValue()).toBe(1)
    render(<MarkingScreen when={false} />)
    expect(skinNameBarsValue()).toBe(1)
  })
})
