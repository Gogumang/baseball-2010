import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import '@/app/styles/global.css'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import { PITCH_TRAINING_CELL_BOXES } from '@/pages/pitcher-league/lib/pitchTrainingWindow'

/**
 * **브라우저 시험 — 상자 단추가 화면 누름 칸 아래 깔리지 않는가** (r203 · 실제 CSS · z-index).
 *
 * 투수편 구질훈련 창은 '???' 칸(96~149 × 172~187)의 누름 칸(`PressArea`, `SCREEN_LAYERS.PRESS_AREA`)을 남긴 채
 * "배우시겠습니까?" 예 · 아니오 상자(`MessageBox`)를 띄운다. 상자 덮개가 칸보다 아래 겹(예전 5 < 7)이면 '예' 끝을 누를 때 칸이
 * 눌렸다. jsdom 시험(`screenLayers.test.ts`)은 `.css.ts` 원문만 읽었다 — 여기서는 실제로 실린 CSS 로 맨 위 요소를 본다.
 */

afterEach(cleanup)

interface Box {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

const boxOf = (element: Element): Box => element.getBoundingClientRect()
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
/** 두 사각형이 겹친 자리의 가운데 — 칸이 단추를 덮었다면 여기가 덮인다 */
const overlapCenterOf = (a: Box, b: Box) => ({
  x: (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2,
  y: (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2,
})

/** 상자가 다 열려 단추 크기가 선 뒤 */
async function openedButton(name: string): Promise<HTMLElement> {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button.getBoundingClientRect().width).toBeGreaterThan(10), { timeout: 3000 })
  // 여는 연출(커지기)이 끝나 크기가 멈출 때까지
  let last = ''
  await waitFor(
    () => {
      const now = JSON.stringify(button.getBoundingClientRect())
      const isStill = now === last
      last = now
      expect(isStill).toBe(true)
    },
    { timeout: 3000, interval: 50 },
  )
  return button
}

describe("구질훈련 창 — '???' 칸 위에 뜬 예 · 아니오 상자 (r203)", () => {
  const 띄우기 = () => {
    const onCell = vi.fn()
    const onAnswer = vi.fn()
    render(
      <RawScreen>
        <PressArea label="???" rect={PITCH_TRAINING_CELL_BOXES[4]} onPress={onCell} testId="물음칸" />
        <MessageBox text="배우시겠습니까?" buttons={['예', '아니오']} onAnswer={onAnswer} />
      </RawScreen>,
    )
    return { onCell, onAnswer, cell: screen.getByTestId('물음칸') }
  }

  it('누름 칸이 실제 CSS 로 PRESS_AREA 겹에 서고, 상자 덮개는 그보다 위다', async () => {
    const { cell } = 띄우기()
    const dialog = screen.getByRole('dialog', { name: '알림' })
    expect(getComputedStyle(cell).zIndex).toBe(String(SCREEN_LAYERS.PRESS_AREA))
    expect(Number(getComputedStyle(dialog).zIndex)).toBeGreaterThan(SCREEN_LAYERS.PRESS_AREA)
  })

  it.each(['예', '아니오'])("'%s' 단추는 칸과 겹치지만 겹친 자리의 맨 위 요소는 그 단추다", async (name) => {
    const { cell } = 띄우기()
    const button = await openedButton(name)
    const box = boxOf(button)
    // 겹치지 않으면 이 시험은 아무것도 재지 않는다 — 원본 좌표가 바뀌면 칸을 다시 골라라
    expect(overlaps(box, boxOf(cell))).toBe(true)
    const point = overlapCenterOf(box, boxOf(cell))
    const top = document.elementFromPoint(point.x, point.y)
    expect(top !== null && button.contains(top)).toBe(true)
  })

  /** 이 시험이 r203 을 잡는다는 확인 — 덮개를 예전 겹 5 로 되돌리면 단추 가운데의 맨 위 요소가 '???' 칸이 된다 */
  it("예전 겹(덮개 z 5)이면 '???' 칸이 '예' 단추를 덮는다 — r203 재현", async () => {
    const old = document.createElement('style')
    old.textContent = '[role="dialog"][aria-label="알림"] { z-index: 5 !important; }'
    document.head.append(old)
    try {
      const { cell } = 띄우기()
      const point = overlapCenterOf(boxOf(await openedButton('예')), boxOf(cell))
      expect(document.elementFromPoint(point.x, point.y)).toBe(cell)
    } finally {
      old.remove()
    }
  })

  it('실제 클릭(Playwright 마우스)이 칸이 아니라 단추에 간다', async () => {
    const { onCell, onAnswer } = 띄우기()
    const button = await openedButton('예')
    // 칸과 겹친 '예' 끝을 누른다 — 단추 안 좌표(단추 왼쪽 위 기준)
    const box = boxOf(button)
    const point = overlapCenterOf(box, boxOf(screen.getByTestId('물음칸')))
    await userEvent.click(button, { position: { x: point.x - box.left, y: point.y - box.top } })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1))
    expect(onAnswer.mock.calls[0]?.[0]).toBe(0)
    expect(onCell).not.toHaveBeenCalled()
  })
})
