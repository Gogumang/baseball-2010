// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MATCH_SETTING_KIND, INNING_VALUE } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { MatchSettingsScreen } from '@/pages/match-settings/ui/MatchSettingsWindow'
import { DETAIL_WINDOW, SMALL_WINDOW } from '@/pages/match-settings/lib/matchSettingsLayout'

/**
 * 경기진행 설정 창 (0x5fef4 갱신 · 0x5ffcc 키 · 0x6042c 그리기 — R4 4절 · J-3).
 * jest-dom 이 없어 `toBeDisabled` 대신 속성을 직접 본다.
 */

afterEach(cleanup)

const 빈설정: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.찬스,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

const 띄우기 = (overrides: Partial<Parameters<typeof MatchSettingsScreen>[0]> = {}) => {
  const props = { settings: 빈설정, onConfirm: vi.fn(), onClose: vi.fn(), ...overrides }
  render(<MatchSettingsScreen {...props} />)
  return props
}

const 누르기 = (key: string) => fireEvent.keyDown(window, { key })
const 줄 = (name: string) => screen.getByRole('button', { name })

describe('단계 0 — 종류 고르기', () => {
  it('종류 세 줄이 원본 이름 그대로 나온다', () => {
    띄우기()

    for (const name of ['찬스 플레이', '이닝 플레이', '상세 플레이']) {
      expect(줄(name)).toBeTruthy()
    }
  })

  it('종류 이름은 img_text 399~401 그림이다 (표 0xd1c70)', () => {
    띄우기()

    expect(줄('찬스 플레이').getAttribute('data-frame')).toBe('399')
    expect(줄('상세 플레이').getAttribute('data-frame')).toBe('401')
  })

  it('판은 0x55e60(W/2, H/2, 192, 160, 정렬 0x22) → (24, 80, 192, 160) — 상세만 192×212', () => {
    띄우기()

    const 판 = screen.getByTestId('경기설정-판')
    expect(SMALL_WINDOW).toEqual({ x: 24, y: 80, width: 192, height: 160 })
    expect(DETAIL_WINDOW).toEqual({ x: 24, y: 54, width: 192, height: 212 })
    expect([판.style.left, 판.style.top, 판.style.height]).toEqual(['24px', '80px', '160px'])

    fireEvent.click(줄('상세 플레이'))
    const 상세판 = screen.getByTestId('경기설정-판')
    expect([상세판.style.top, 상세판.style.height]).toEqual(['54px', '212px'])
  })

  it('설명 칸에는 지금 종류의 글(표 0xd1c7c)만 나온다', () => {
    띄우기()

    expect(screen.getByText(/미리 정해진 상황에 맞춰/)).toBeTruthy()
    누르기('ArrowDown')
    expect(screen.queryByText(/미리 정해진 상황에 맞춰/)).toBe(null)
    expect(screen.getByText(/시작 이닝을 선택하여 경기/)).toBeTruthy()
  })

  it('CLR(Esc) 은 저장하지 않고 창을 닫는다', () => {
    const props = 띄우기()

    누르기('Escape')

    expect(props.onClose).toHaveBeenCalled()
    expect(props.onConfirm).not.toHaveBeenCalled()
  })
})

describe('단계 1 — 이닝', () => {
  const 이닝으로 = () => {
    const props = 띄우기()
    fireEvent.click(줄('이닝 플레이'))
    return props
  }

  it('이닝 값 세 줄이 원본 그림 글자 그대로 나온다', () => {
    이닝으로()

    for (const name of ['자동진행 없음', '3이닝 자동진행', '6이닝 자동진행']) {
      expect(줄(name)).toBeTruthy()
    }
  })

  it('값을 고르면 확인창 StrMAINMENU[125] 가 뜨고, 예 를 누르면 그 값이 저장으로 나간다', () => {
    const props = 이닝으로()

    fireEvent.click(줄('6이닝 자동진행'))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(props.onConfirm).toHaveBeenCalledWith({
      ...빈설정,
      kind: MATCH_SETTING_KIND.이닝,
      value: INNING_VALUE.일곱째이닝부터,
    })
  })

  it('아니오 를 누르면 저장하지 않고 창이 그대로 남는다', () => {
    const props = 이닝으로()

    fireEvent.click(줄('3이닝 자동진행'))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(줄('3이닝 자동진행')).toBeTruthy()
  })

  it('⚠️ 원본 버그 그대로 — 저장된 값이 있어도 종류에서 OK 하면 "자동진행 없음"(0)으로 되돌아간다', () => {
    const props = 띄우기({
      settings: { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.일곱째이닝부터 },
    })

    fireEvent.click(줄('이닝 플레이'))
    // 값을 건드리지 않고 그대로 확인해 본다
    누르기('Enter')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(props.onConfirm).toHaveBeenCalledWith({
      ...빈설정,
      kind: MATCH_SETTING_KIND.이닝,
      value: INNING_VALUE.전체,
    })
  })
})

describe('단계 1 — 찬스', () => {
  it('두 칸은 popup 그림 19(공격) · 20(수비) 이고, 설명 칸에는 고른 값의 글(표 0xd1c88)만 나온다', () => {
    띄우기()
    fireEvent.click(줄('찬스 플레이'))

    expect(줄('공격').getAttribute('data-frame')).toBe('19')
    expect(줄('수비').getAttribute('data-frame')).toBe('20')
    expect(screen.getByText(/공격 중 2, 3루에 주자가 있을/)).toBeTruthy()
    expect(screen.queryByText(/수비 중 3루에 주자가 있을 때/)).toBe(null)

    누르기('ArrowRight')
    expect(screen.getByText(/수비 중 3루에 주자가 있을 때/)).toBeTruthy()
  })
})

describe('단계 1 — 상세', () => {
  const 상세로 = () => {
    const props = 띄우기()
    fireEvent.click(줄('상세 플레이'))
    return props
  }

  it('네 줄과 칸 수가 원본대로다 — 타자조작·투수조작 9칸, 주자 둘 3칸', () => {
    상세로()

    expect(screen.getByLabelText('타자조작 1번')).toBeTruthy()
    expect(screen.getByLabelText('타자조작 9번')).toBeTruthy()
    expect(screen.queryByLabelText('타자조작 10번')).toBe(null)
    expect(screen.getByLabelText('공격주자 3루')).toBeTruthy()
    expect(screen.queryByLabelText('공격주자 4루')).toBe(null)
    expect(screen.getByLabelText('수비주자 1루')).toBeTruthy()
  })

  it('투수조작 마지막 칸은 9회가 아니라 "9회~" 다 — 연장까지 덮는다', () => {
    상세로()

    expect(screen.getByLabelText('투수조작 8회')).toBeTruthy()
    expect(screen.getByLabelText('투수조작 9회~')).toBeTruthy()
  })

  it('칸을 누르면 켜지고 한 번 더 누르면 꺼진다', () => {
    상세로()

    const 칸 = screen.getByLabelText('타자조작 3번')
    expect(칸.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(칸)
    expect(screen.getByLabelText('타자조작 3번').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByLabelText('타자조작 3번'))
    expect(screen.getByLabelText('타자조작 3번').getAttribute('aria-pressed')).toBe('false')
  })

  it('켜진 칸은 프레임 49(타순·이닝) · 51(주자) 이고, 지금 줄의 설명은 StrMAINMENU[121 + 줄] 이다', () => {
    상세로()

    fireEvent.click(screen.getByLabelText('공격주자 2루'))

    expect(screen.getByLabelText('공격주자 2루').getAttribute('data-frame')).toBe('51')
    expect(screen.getByLabelText('타자조작 1번').getAttribute('data-frame')).toBe('48')
    expect(screen.getByText(/공격 시 해당 베이스/)).toBeTruthy()
  })

  it('한 항목도 없이 확인하면 StrMAINMENU[126] 알림만 뜨고 저장되지 않는다', () => {
    const props = 상세로()

    fireEvent.click(줄('확인'))

    expect(screen.getByText(/최소 한가지/)).toBeTruthy()
    expect(props.onConfirm).not.toHaveBeenCalled()
  })

  it('고른 칸은 저장 칸 비트 그대로 나간다 — 타순 3번은 비트 2, 9회~ 는 비트 8', () => {
    const props = 상세로()

    fireEvent.click(screen.getByLabelText('타자조작 3번'))
    fireEvent.click(screen.getByLabelText('투수조작 9회~'))
    fireEvent.click(줄('확인'))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(props.onConfirm).toHaveBeenCalledWith({
      ...빈설정,
      kind: MATCH_SETTING_KIND.상세,
      value: 0,
      battingOrderBits: 1 << 2,
      pitchingInningBits: 1 << 8,
    })
  })
})
