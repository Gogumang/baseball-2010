// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MatchInfoStadiumBackdrop, TARGET_CONTEXT_OPTIONS } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('경기정보 화면 바탕', () => {
  it('흐리기가 화소를 다시 읽는 보이는 캔버스도 willReadFrequently 로 연다 — Chrome 다중 읽기 경고가 안 난다', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { getByTestId } = render(
      <MatchInfoStadiumBackdrop stage={{ stadium: 0, fieldPalette: null, skyRow: 0, side0TeamId: 0, side1TeamId: 1, gameMode: 1 }} />,
    )
    const visible = getByTestId('경기정보-구장')
    const visibleCalls = getContext.mock.contexts.flatMap((canvas, index) => (canvas === visible ? [getContext.mock.calls[index]] : []))
    expect(visibleCalls.length).toBeGreaterThan(0)
    for (const call of visibleCalls) expect(call).toEqual(['2d', TARGET_CONTEXT_OPTIONS])
    expect(TARGET_CONTEXT_OPTIONS.willReadFrequently).toBe(true)
  })
})
