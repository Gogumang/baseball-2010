// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MissionSelectScreen } from '@/pages/mission-select/ui/MissionSelectScreen'
import { BATTER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import { GRID, PANEL, cellPositionOf } from '@/pages/mission-select/lib/missionSelectLayout'

/**
 * 미션 선택 (0x1df08 — P6 2b).
 * 글자 목록이 아니라 192 판 + 5×3 격자(28px)다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof MissionSelectScreen>[0]> = {}) =>
  render(
    <MissionSelectScreen
      clearedKeys={[]}
      initialSide="타자"
      onSelect={vi.fn()}
      onBack={vi.fn()}
      {...overrides}
    />,
  )

const 칸 = (name: string) => screen.getByRole('button', { name })

describe('미션 선택 격자', () => {
  it('판은 가운데 192×212 다 (24, 54)', () => {
    const { container } = 띄우기()
    const panel = container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${PANEL.x}px`)
    expect(panel.style.top).toBe(`${PANEL.y}px`)
  })

  it('칸은 28px 이고 5열로 놓인다 — 둘째 칸이 한 칸 오른쪽이다', () => {
    띄우기()
    const first = 칸(BATTER_MISSIONS[0].name)
    const second = 칸(BATTER_MISSIONS[1].name)

    expect(first.style.width).toBe(`${GRID.cell}px`)
    expect(first.style.left).toBe(`${cellPositionOf(0).x}px`)
    expect(second.style.left).toBe(`${cellPositionOf(1).x}px`)
    expect(second.style.top).toBe(first.style.top)
  })

  it('여섯째 칸은 다음 줄이다', () => {
    띄우기()
    const sixth = 칸(BATTER_MISSIONS[GRID.columns].name)

    expect(sixth.style.left).toBe(`${cellPositionOf(0).x}px`)
    expect(sixth.style.top).toBe(`${cellPositionOf(GRID.columns).y}px`)
  })

  it('잠긴 칸은 고를 수 없다 — 바로 앞 미션을 깨야 열린다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(칸(BATTER_MISSIONS[1].name))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('열린 칸을 고르면 그 미션으로 넘어간다', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(칸(BATTER_MISSIONS[0].name))

    expect(onSelect).toHaveBeenCalledWith(BATTER_MISSIONS[0])
  })

  it('고른 미션의 이름·설명과 보상 G·성공 횟수를 보여 준다', () => {
    const key = missionKeyOf(BATTER_MISSIONS[0])
    띄우기({ clearedKeys: [key], clearCounts: { [key]: 3 } })

    expect(screen.getByText(BATTER_MISSIONS[0].name)).toBeTruthy()
    expect(screen.getByText('3회')).toBeTruthy()
  })

  it('좌우 키로 칸을 옮긴다 — 목록 끝을 넘지 않는다', () => {
    const key = missionKeyOf(BATTER_MISSIONS[0])
    띄우기({ clearedKeys: [key] })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(BATTER_MISSIONS[0].name)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(BATTER_MISSIONS[1].name)).toBeTruthy()
  })

  it('편을 바꾸면 커서가 처음으로 돌아간다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '투수편' }))

    expect(screen.getByRole('button', { name: '타자편' })).toBeTruthy()
  })
})
