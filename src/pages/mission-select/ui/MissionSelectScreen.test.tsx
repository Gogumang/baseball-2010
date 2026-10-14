// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MissionSelectScreen } from '@/pages/mission-select/ui/MissionSelectScreen'
import { BATTER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import { GRID, NO_MISSION_TEXT, PANEL, cellPositionOf } from '@/pages/mission-select/lib/missionSelectLayout'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

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
      slides={false}
      {...overrides}
    />,
  )

const 칸 = (name: string) => screen.getByRole('button', { name })

describe('머리띠 0x54d95 (장면 그리기 0x1e9e8)', () => {
  it('제목은 미션모드 + 편 부제 — 머리띠가 미끄러지는 첫 그림은 판을 안 그린다([skin+0x84] ≠ 0 → 상태 그리기 건너뜀)', () => {
    띄우기({ slides: true })
    expect(screen.queryByTestId('미션-고르기-판')).toBeNull()
    expect(screen.getByTestId('머리띠-G')).toBeTruthy()
  })
})

describe('미션 선택 격자', () => {
  it('판은 가운데 192×212 다 (24, 54) — 공용 판 0x55e61(…, 위 띠 0x10)', () => {
    띄우기()
    const panel = screen.getByTestId('미션-고르기-판')

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

  it('잠긴 칸 OK 는 StrMAINMENU[60] 확인 팝업 — 닫으면 목록에 남는다 (0x1db84)', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(칸(BATTER_MISSIONS[1].name))
    expect(screen.getByText('오픈 되지 않은 미션입니다.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(screen.queryByText('오픈 되지 않은 미션입니다.')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('열린 칸 OK 는 StrMAINMENU[61] "[이름] 미션에 도전하시겠습니까?" — 예면 그 미션, 아니오면 목록 (0x1db34 · 하위 1 0x1dbaa)', () => {
    const onSelect = vi.fn()
    띄우기({ onSelect })

    fireEvent.click(칸(BATTER_MISSIONS[0].name))
    expect(screen.getByText('미션에 도전하시겠습니까?', { exact: false })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: '예' }))
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
    fireEvent.click(screen.getByRole('button', { name: '예' }))

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
      // 뒤 어둡게 — 미션 장면 0x1d784 가 [창+0x24f] = 0 · [+0x24c] = 1 → 0x746cc 검정 단계 5 = 6/16
      expect(dialog.style.background).toBe(`rgba(0, 0, 0, ${6 / 16})`)
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

    it('펼치는 동안(6 → … → 100)은 키를 안 받고, 키 0x1dcb0 의 닫힘은 [창+0x215] — 폭 240 → 120 → 닫힘', () => {
      vi.useFakeTimers()
      띄우기()
      칸14로()
      fireEvent.keyDown(window, { key: 'Enter' })
      const 틀 = (n: number) => act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * n) })
      // 펼치는 동안 → 는 뒤집지 않는다 (0x75556)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      틀(5)
      expect(screen.getByRole('button', { name: '미션실행' }).dataset.selected).toBe('true')
      fireEvent.keyDown(window, { key: 'Escape' })
      const 판 = () => screen.getByRole('dialog', { name: '이벤트 미션' }).firstElementChild as HTMLElement
      expect(판().style.width).toBe('240px')
      틀(1)
      expect(판().style.width).toBe('120px')
      expect(판().style.left).toBe('60px')
      // 줄이는 동안도 키를 안 받는다 (0x7558a)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(screen.getByRole('button', { name: '미션실행' }).dataset.selected).toBe('true')
      틀(1)
      expect(screen.queryByRole('dialog', { name: '이벤트 미션' })).toBeNull()
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
