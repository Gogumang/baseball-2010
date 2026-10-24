// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { CommonWindowPushContext } from '@/shared/lib/commonWindow/commonWindow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'
import { burstObjectTicks, resetBurstObjectTicks } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

/**
 * 돌발미션 창 (경기 장면 상태 0x1b — 그리기 0x8f3c0 · 갱신 0x8e5b8).
 * 판이 오르고(5 갱신) 세 번 흔들린 뒤(3 갱신) 9 번째 갱신에서 글이 나오고 키를 받는다.
 */

beforeEach(() => {
  vi.useFakeTimers()
  resetBurstObjectTicks()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 원본 타자 표 첫 행의 대사 4줄 */
const 원본줄 = ORIGINAL_BURST_TABLES.BATTER.lines[0] as readonly OriginalBurstLine[]

/** 첫 그림은 갱신 1 뒤다 — 갱신 9 에 열리므로 8 틀을 더 돌린다 */
const 다열기 = () => act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * 8) })

const 띄우기 = (props: Partial<Parameters<typeof BurstMissionWindow>[0]> = {}) => {
  const onClose = props.onClose ?? vi.fn()
  const push = vi.fn()
  render(
    <CommonWindowPushContext.Provider value={push}>
      <BurstMissionWindow lines={원본줄} judgement={null} {...props} onClose={onClose} />
    </CommonWindowPushContext.Provider>,
  )
  return { onClose, push, dialog: screen.getByRole('dialog', { name: '돌발미션' }) }
}

describe('돌발미션 창 — 오르기 · 흔들기 · 글', () => {
  it('다 열리기 전에는 글이 없고 키도 버려진다 (0x8ea18 · 0x8e60c — c ≠ −1)', () => {
    const { onClose, dialog } = 띄우기()
    expect(dialog.textContent).toBe('')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('열리면 화자 이름 머리와 대사를 함께 찍는다 — StrCOMMON[0x71 + 화자]', () => {
    const { dialog } = 띄우기()
    다열기()
    const 화자 = 원본줄[0].speaker
    expect(화자).toBe(3)
    expect(dialog.textContent).toContain(`[주장] : ${stripGameMarkup(원본줄[0].text)}`)
  })

  it('결과는 판정 줄(성공 1 · 실패 2 · 무효 3)을 찍는다', () => {
    const { dialog } = 띄우기({ judgement: '실패' })
    다열기()
    expect(dialog.textContent).toContain(stripGameMarkup(원본줄[2].text))
  })

  it('넘김 표시는 game_ui 이미지 0x34 를 (225, H − 8 · H − 10) 에 둔다', () => {
    const { dialog } = 띄우기()
    다열기()
    const mark = dialog.querySelector('img[src="./sprites/game_ui/052.png"]') as HTMLImageElement
    expect(mark.style.left).toBe('225px')
    // [+0x224] = 9 → 9 % 8 = 1 ≤ 3 → H − 8
    expect(mark.style.top).toBe('312px')
  })

  it('[+0x224] 는 창마다 0 이 아니라 경기 내내 이어 센다 — 제안 창 9 갱신 뒤 결과 창은 10 부터 (0x8e5b8 · 객체는 0x48658 에서 한 번)', () => {
    띄우기()
    다열기()
    expect(burstObjectTicks.value).toBe(9)
    cleanup()
    const { dialog } = 띄우기({ judgement: '성공' })
    다열기()
    expect(burstObjectTicks.value).toBe(18)
    const mark = dialog.querySelector('img[src="./sprites/game_ui/052.png"]') as HTMLImageElement
    // 18 % 8 = 2 ≤ 3 → H − 8 (창마다 0 이면 9 → 같은 줄이라 한 그림 더 굴려 갈린다)
    act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * 2) })
    // 20 % 8 = 4 > 3 → H − 10 (창마다 0 이면 11 % 8 = 3 → H − 8)
    expect(mark.style.top).toBe('310px')
  })
})

describe('돌발미션 창 닫기', () => {
  it('열린 뒤 아무 키나 누르면 다음으로 간다 (상태 0x1b → 0xf)', () => {
    const { onClose } = 띄우기()
    다열기()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('판 자리 누름 칸으로도 닫힌다', () => {
    const { onClose } = 띄우기()
    다열기()
    fireEvent.click(screen.getByTestId('돌발미션-넘기기'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('성공을 닫으면 보상 글을 공용 창에 띄운다 (0x8e5b8 → 0x74ef5)', () => {
    const row = 행({ successRewards: [{ kind: 2, amount: 5 }, { kind: 4, amount: 3 }] })
    const { push } = 띄우기({ judgement: '성공', row })
    다열기()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith(
      '!C!cffffff[!cffff00돌발미션 성공!!!cffffff]!N!C!cffffff인기도 +5!N!C!cffffff소지금 +300',
    )
  })

  it('제안 · 무효는 공용 창이 없다', () => {
    const { push } = 띄우기({ judgement: '무효', row: 행() })
    다열기()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(push).not.toHaveBeenCalled()
  })
})
