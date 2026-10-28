// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { COMMAND_SLOTS, commandSlotYAt } from '@/pages/management/lib/managementLayout'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

afterEach(cleanup)

const SETTLED = 1_000

/** 0x7e6f8~0x7e710 — 꺼진 칸은 0xc37a8(칸.x, 칸.y + 미끄럼, 32, 32) 로 이미 그린 화면을 흑백으로 바꾼다 */
describe('커맨드 줄 흑백 칸 (0xc37a8)', () => {
  const 띄우기 = (grayedIds: ReadonlySet<string>) =>
    render(
      <>
        <SkinBackdrop kind="공무늬" />
        <CommandBar
          slots={COMMAND_SLOTS}
          cursor={0}
          bounce={0}
          slideUpdates={SETTLED}
          disabledIds={new Set()}
          grayedIds={grayedIds}
          labelWidths={{}}
          parent={null}
          onHover={vi.fn()}
          onSelect={vi.fn()}
        />
      </>,
    )

  it('꺼진 칸에만 회색 겹을 얹는다 (CSS 거르개는 쓰지 않는다)', () => {
    띄우기(new Set([COMMAND_SLOTS[2].id]))
    expect(screen.queryByTestId(`흑백-${COMMAND_SLOTS[2].id}`)).toBeTruthy()
    expect(screen.queryByTestId(`흑백-${COMMAND_SLOTS[0].id}`)).toBeNull()
    const button = screen.getByRole('button', { name: COMMAND_SLOTS[2].id })
    expect(button.querySelector('img')?.style.filter ?? '').toBe('')
  })

  it('그 칸 사각형 아래 공 무늬 바탕도 회색 사본을 잘라 얹는다', () => {
    const slot = COMMAND_SLOTS[2]
    띄우기(new Set([slot.id]))
    const rects = screen.getAllByTestId('바탕-공무늬-흑백')
    expect(rects).toHaveLength(1)
    expect(rects[0].style.left).toBe(`${slot.x}px`)
    expect(rects[0].style.top).toBe(`${commandSlotYAt(slot.y, SETTLED)}px`)
    expect([rects[0].style.width, rects[0].style.height]).toEqual(['32px', '32px'])
  })

  it('꺼진 칸이 없으면 바탕 사본도 없다', () => {
    띄우기(new Set())
    expect(screen.queryAllByTestId('바탕-공무늬-흑백')).toHaveLength(0)
  })
})
