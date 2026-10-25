import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import '@/app/styles/global.css'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import { PressArea } from '@/shared/ui/PressArea/PressArea'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { MENU_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'

/**
 * **브라우저 시험 — 경기 중 메뉴가 떠 있어도 '*' 자리 '닫기' 칸이 눌리는가** (r218 누름 칸 검사 `yarn e2e:hits` 가 찾았다).
 *
 * 팀경기(일반모드 · 시즌) · 나리 경기는 소프트키 판(`PressLayer isOnTop`)을 그린 **뒤에** 메뉴 층(`stageScreen.menuLayer`, z 6)을
 * 그린다. 소프트키 판이 6 이면 같은 겹에서 나중 것(메뉴 층, inset 0)이 '닫기' 칸을 통째로 덮어 탭 · 클릭이 메뉴 층에 먹혔다(키 '*' 는 됐다).
 */

afterEach(cleanup)

function 띄우기() {
  const onClose = vi.fn()
  render(
    <RawScreen>
      <PressLayer testId="소프트키 누름 칸" isOnTop>
        <PressArea rect={MENU_PRESS_RECT} label="닫기" onPress={onClose} />
      </PressLayer>
      {/* 메뉴 층 — 안의 메뉴 판은 원본 좌표대로 스스로 자리를 잡는다. 여기서는 빈 층만 */}
      <div className={stageScreen.menuLayer} data-testid="메뉴 층" />
    </RawScreen>,
  )
  return { onClose }
}

describe("경기 중 메뉴 층 위 '*' 닫기 칸", () => {
  it('닫기 칸 가운데의 맨 위 요소는 닫기 칸이다', () => {
    띄우기()
    const close = screen.getByRole('button', { name: '닫기' })
    const box = close.getBoundingClientRect()
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(close)
  })

  it('실제 클릭으로 닫힌다', async () => {
    const { onClose } = 띄우기()
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
