// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MissionSelectScreen } from '@/pages/mission-select/ui/MissionSelectScreen'
import { BATTER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import { GRID, NO_MISSION_TEXT, PANEL, cellPositionOf } from '@/pages/mission-select/lib/missionSelectLayout'

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

  it('좌우 키로 칸을 옮긴다 — 꼴 0x330 이라 15칸을 감는다 (칸 0 ← → 칸 14, 칸 14 → → 칸 0)', () => {
    const key = missionKeyOf(BATTER_MISSIONS[0])
    띄우기({ clearedKeys: [key] })

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(BATTER_MISSIONS[1].name)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.queryByText(BATTER_MISSIONS[0].name)).toBeNull()
    expect(screen.getByText(NO_MISSION_TEXT)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(BATTER_MISSIONS[0].name)).toBeTruthy()
  })

  it('줄 끝에서 → 는 다음 줄 첫 칸, 맨 아래 줄에서 ↓ 는 맨 윗줄 다음 칸이다 (0x100 · 0x200)', () => {
    띄우기()

    for (let step = 0; step < 5; step += 1) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText(BATTER_MISSIONS[5].name)).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByText(BATTER_MISSIONS[1].name)).toBeTruthy()
  })

  it('숫자 2 · 4 · 6 · 8 은 ↑ ← → ↓, 5 는 OK 다 (숫자키 꼴 1)', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect, clearedKeys: [missionKeyOf(BATTER_MISSIONS[0])] })

    fireEvent.keyDown(window, { key: '6' })
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '6' })
    fireEvent.keyDown(window, { key: '5' })

    expect(onSelect).toHaveBeenCalledWith(BATTER_MISSIONS[1])
  })

  describe('칸 14 = 이벤트 미션 (0x1db06)', () => {
    afterEach(() => { vi.useRealTimers() })

    const 칸14로 = () => fireEvent.keyDown(window, { key: 'ArrowLeft' })
    /** 열림 · 닫힘 애니를 끝까지 돌린다 */
    const 애니끝내기 = () => act(() => { vi.advanceTimersByTime(1000) })

    it('OK 를 누르면 StrMAINMENU[56] 창을 띄우고 처음 고름은 미션실행이다', () => {
      vi.useFakeTimers()
      띄우기()
      칸14로()
      fireEvent.keyDown(window, { key: 'Enter' })
      애니끝내기()

      const dialog = screen.getByRole('dialog', { name: '이벤트 미션' })
      expect(dialog.textContent).toContain('어떤 메뉴를 실행하시')
      expect(screen.getByRole('button', { name: '미션실행' }).dataset.selected).toBe('true')
      expect(screen.getByRole('button', { name: '미션다운' }).dataset.selected).toBe('false')
    })

    it('← → 로 고름을 뒤집고, 미션실행을 고르면 받은 미션이 없어 "이벤트 미션을 다운로드하세요" 알림이다', () => {
      vi.useFakeTimers()
      const onSelect = vi.fn()
      띄우기({ onSelect })
      칸14로()
      fireEvent.keyDown(window, { key: 'Enter' })
      애니끝내기()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(screen.getByRole('button', { name: '미션다운' }).dataset.selected).toBe('true')
      fireEvent.keyDown(window, { key: '4' })
      expect(screen.getByRole('button', { name: '미션실행' }).dataset.selected).toBe('true')

      fireEvent.keyDown(window, { key: 'Enter' })
      애니끝내기()

      expect(screen.queryByRole('dialog', { name: '이벤트 미션' })).toBeNull()
      expect(screen.getByText('이벤트 미션을 다운로드하세요')).toBeTruthy()
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('CLR 은 창만 닫고 목록에 남는다 — 고름은 다시 열어도 그대로다 ([this+0xa0])', () => {
      vi.useFakeTimers()
      const onBack = vi.fn()
      띄우기({ onBack })
      칸14로()
      fireEvent.keyDown(window, { key: 'Enter' })
      애니끝내기()
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: 'Escape' })
      애니끝내기()

      expect(screen.queryByRole('dialog', { name: '이벤트 미션' })).toBeNull()
      expect(onBack).not.toHaveBeenCalled()

      fireEvent.keyDown(window, { key: 'Enter' })
      애니끝내기()
      expect(screen.getByRole('button', { name: '미션다운' }).dataset.selected).toBe('true')
    })
  })

  it('편을 바꾸면 커서가 처음으로 돌아간다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '투수편' }))

    expect(screen.getByRole('button', { name: '타자편' })).toBeTruthy()
  })
})
