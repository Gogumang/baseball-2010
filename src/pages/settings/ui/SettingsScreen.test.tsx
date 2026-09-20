// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { DEFAULT_SETTINGS } from '@/entities/settings/model/gameSettings'
import { MENU_ROW, PANEL, VALUE_ROW, rowTopOf } from '@/pages/settings/lib/settingsLayout'

/**
 * 환경설정 창 (공용 페이지 0x593c8 종류 8 — P6 5절).
 * 줄 여섯이 25px 간격이고, 앞 셋은 값 줄(77px 막대) 뒤 셋은 메뉴 줄(142px 막대)이다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) =>
  render(
    <SettingsScreen
      settings={DEFAULT_SETTINGS}
      hasSavedCareer
      onChange={vi.fn()}
      onResetCareer={vi.fn()}
      onBack={vi.fn()}
      {...overrides}
    />,
  )

const 줄 = (name: string) => screen.getByRole('button', { name })

describe('환경설정 창 배치', () => {
  it('원본 여섯 줄을 모두 보여 준다 — 사운드·진동도 뺐다가 되돌렸다', () => {
    띄우기()

    for (const name of ['사운드', '속도', '진동', '상세 설정', '모드 초기화', '게임 데이터 관리']) {
      expect(줄(name)).toBeTruthy()
    }
  })

  it('줄 간격은 25px 이고 Y = 49 + 25i 다', () => {
    띄우기()

    expect(줄('사운드').style.top).toBe(`${rowTopOf(0) + VALUE_ROW.bar.dy}px`)
    expect(줄('속도').style.top).toBe(`${rowTopOf(1) + VALUE_ROW.bar.dy}px`)
    expect(줄('상세 설정').style.top).toBe(`${rowTopOf(3) + MENU_ROW.bar.dy}px`)
  })

  it('값 줄 막대는 77px, 메뉴 줄 막대는 142px 다 (프레임 35 · 37)', () => {
    띄우기()

    expect(줄('속도').style.width).toBe(`${VALUE_ROW.bar.width}px`)
    expect(줄('모드 초기화').style.width).toBe(`${MENU_ROW.bar.width}px`)
  })

  it('판은 가운데 192×212 다 (24, 54)', () => {
    const { container } = 띄우기()
    const panel = container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${PANEL.x}px`)
    expect(panel.style.top).toBe(`${PANEL.y}px`)
    expect(panel.style.width).toBe(`${PANEL.width}px`)
    expect(panel.style.height).toBe(`${PANEL.height}px`)
  })
})

describe('환경설정 값 바꾸기', () => {
  it('값 줄에서 좌우 키가 값을 돌린다 — 속도는 0~4 를 순환한다', () => {
    const onChange = vi.fn()
    띄우기({ onChange })

    fireEvent.keyDown(window, { key: 'ArrowDown' })  // 속도 줄로
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, speedLevel: DEFAULT_SETTINGS.speedLevel + 1 })
  })

  it('진동 줄은 좌우 어느 쪽이든 ON/OFF 를 뒤집는다', () => {
    const onChange = vi.fn()
    띄우기({ onChange })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, isVibrationOn: false })
  })

  it('게임 데이터 관리는 통신이 필요해 안내만 띄운다 (🌐)', () => {
    띄우기()

    fireEvent.click(줄('게임 데이터 관리'))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('저장이 없으면 모드 초기화가 확인 창을 띄우지 않는다', () => {
    띄우기({ hasSavedCareer: false })

    fireEvent.click(줄('모드 초기화'))

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
