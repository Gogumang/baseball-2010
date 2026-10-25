import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import '@/app/styles/global.css'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import type { OriginalBurstLine } from '@/shared/config/original/burstMissions'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { CommonWindowPushContext } from '@/shared/lib/commonWindow/commonWindow'
import { resetBurstObjectTicks } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'

/**
 * **브라우저 시험 — 돌발미션 결과 창이 클릭 · 탭으로 넘어가는가** (r195, 실제 CSS · z-index).
 *
 * 타자편 돌발미션 결과 창이 설 때 다음 타석의 OK 대기(0xe)가 이미 실려 경기 화면 전체 '확인' 누름 칸(`PressArea`, 창 동안 꺼짐)이
 * 선다. 창 겹이 칸보다 아래(예전 5 < 7)면 클릭 · 탭이 꺼진 칸(disabled 단추 — 누름을 삼킨다)에 먹혀 창이 안 닫혔다. 키(Enter)는 됐다.
 */

afterEach(() => {
  cleanup()
  resetBurstObjectTicks()
})

const 원본줄 = ORIGINAL_BURST_TABLES.BATTER.lines[0] as readonly OriginalBurstLine[]

function 띄우기() {
  const onClose = vi.fn()
  const onScreenOk = vi.fn()
  render(
    <CommonWindowPushContext.Provider value={vi.fn()}>
      <RawScreen>
        {/* 다음 타석 OK 대기의 화면 전체 '확인' — 창이 떠 있는 동안 꺼져 있다 */}
        <PressArea label="확인" onPress={onScreenOk} isDisabled testId="경기-확인" />
        <BurstMissionWindow lines={원본줄} judgement="성공" row={행()} onClose={onClose} />
      </RawScreen>
    </CommonWindowPushContext.Provider>,
  )
  return { onClose, onScreenOk }
}

/** 판이 오르고 흔들린 뒤(9 갱신) 글이 나오고 키 · 누름을 받는다 */
async function 다열기() {
  const dialog = screen.getByRole('dialog', { name: '돌발미션' })
  await waitFor(() => expect(dialog.textContent).not.toBe(''), { timeout: 3000 })
  return dialog
}

describe('돌발미션 결과 창 — 꺼진 경기 확인 칸 위', () => {
  it('화면 가운데의 맨 위 요소는 창(넘기기 칸)이지 꺼진 확인 칸이 아니다', async () => {
    띄우기()
    const dialog = await 다열기()
    const stage = document.querySelector('[data-original-screen]') as HTMLElement
    const box = stage.getBoundingClientRect()
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    expect(top).not.toBe(screen.getByTestId('경기-확인'))
    expect(top !== null && dialog.contains(top)).toBe(true)
  })

  it('실제 클릭(Playwright 마우스)으로 창이 닫힌다', async () => {
    const { onClose, onScreenOk } = 띄우기()
    await 다열기()
    await userEvent.click(screen.getByTestId('돌발미션-넘기기'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onScreenOk).not.toHaveBeenCalled()
  })

  /** 이 시험이 r195 를 잡는다는 확인 — 창을 예전 겹 5 로 되돌리면 맨 위가 꺼진 확인 칸이다 */
  it('예전 겹(창 z 5)이면 꺼진 확인 칸이 창을 덮는다 — r195 재현', async () => {
    const old = document.createElement('style')
    old.textContent = '[role="dialog"][aria-label="돌발미션"] { z-index: 5 !important; }'
    document.head.append(old)
    try {
      띄우기()
      await 다열기()
      const box = (document.querySelector('[data-original-screen]') as HTMLElement).getBoundingClientRect()
      expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(screen.getByTestId('경기-확인'))
    } finally {
      old.remove()
    }
  })
})
