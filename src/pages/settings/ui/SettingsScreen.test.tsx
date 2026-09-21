// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { DEFAULT_SETTINGS } from '@/entities/settings/model/gameSettings'
import { MENU_ROW, PANEL, SOUND_BARS, SPEED_MARKS, VALUE_ROW, bottomAlignOffset, rowTopOf } from '@/pages/settings/lib/settingsLayout'

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

/**
 * 예전에는 `alignSelf:'end'` 로 아래 맞춤을 흉내 냈는데, 그 그림들은 `position:absolute` 라
 * 아무 효과가 없어 막대가 **천장에 붙은 내림 계단**으로 나왔다 (최대 9px 어긋남).
 * P6 5절 확정 식 `y = Y + 35 + (h최대 − h)` · `y = Y + 37 아래 맞춤` 을 직접 더하도록 바꿨다.
 */
describe('소리 막대·속도 꺾쇠는 아래 맞춤이다 (P6 5절 확정)', () => {
  it('소리 막대 넷(12×2·5·8·11)의 밑변이 모두 Y + 46 에 모인다', () => {
    const 밑변 = SOUND_BARS.sizes.map(
      (size, k) => SOUND_BARS.dy + bottomAlignOffset(SOUND_BARS.sizes, k) + size.height,
    )

    expect(밑변).toEqual([46, 46, 46, 46])
  })

  it('속도 꺾쇠 넷(11×7·11×7·12×9·12×9)의 밑변도 모두 Y + 46 에 모인다', () => {
    const 밑변 = SPEED_MARKS.sizes.map(
      (size, k) => SPEED_MARKS.dy + bottomAlignOffset(SPEED_MARKS.sizes, k) + size.height,
    )

    expect(밑변).toEqual([46, 46, 46, 46])
  })

  it('가장 낮은 막대는 9px 내려 앉는다 — 예전 값(0)과 다른 곳이다', () => {
    expect(bottomAlignOffset(SOUND_BARS.sizes, 0)).toBe(9)
    expect(bottomAlignOffset(SOUND_BARS.sizes, 3)).toBe(0)
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
