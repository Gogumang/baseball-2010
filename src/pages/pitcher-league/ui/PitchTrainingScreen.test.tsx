// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { DEFAULT_PITCHER_ROOKIE_PROFILE } from '@/entities/pitcher-career/model/pitcherRegistration'

/** 구질 훈련 창 — 나리 108 탭 2, 그리기 0x803d4 · 키 0x17828 → 0x80268 */

afterEach(cleanup)

const 투수 = (overrides: Partial<PitcherCareer> = {}): PitcherCareer => ({
  // 칸 0 TWO-SEAM · 칸 1 H.FAST 단계 1 — 목록에는 한 행에 번호 큰 H.FAST 하나만 든다
  ...createPitcherCareer('테스트', { ...DEFAULT_PITCHER_ROOKIE_PROFILE, breakingPitchSlots: [0, 1] }),
  gamePoint: 5000,
  ...overrides,
})

const 화면 = (career: PitcherCareer, onTrain: (row: number, column: number) => void = () => {}, onClose: () => void = () => {}) =>
  render(<PitchTrainingScreen career={career} onTrain={onTrain} onClose={onClose} />)

const 키 = (key: string) => act(() => { fireEvent.keyDown(window, { key }) })
const 판 = (column: number) => screen.getByTestId(`구질칸-${column}`).dataset.plate

describe('구질 훈련 창 — 칸 그림 (0x80e1c~0x810ac)', () => {
  it('배운 칸은 판 없이(나무의 파란 칸) · 목록에 든 구질은 주황 41 · 못 배운 칸은 흰 42', () => {
    화면(투수())

    expect(판(0)).toBe('없음')
    expect(판(1)).toBe('41')
    expect(판(2)).toBe('42')
    expect(판(3)).toBe('42')
  })

  it('계열이 안 열린 히든 칸은 흰 판에 "????"(slt_pitch 21)', () => {
    화면(투수())

    expect(판(4)).toBe('42')
    expect(screen.getByTestId('구질칸-4').dataset.nameFrame).toBe('21')
  })

  it('6 키로 탭(계열)을 넘기면 그 행 구질 이름을 그린다 — 구질 번호 − 1', () => {
    화면(투수())

    키('6')

    // 행 1 = SHOOT(5) · SINKER(4)
    expect(screen.getByTestId('구질칸-0').dataset.nameFrame).toBe('4')
    expect(screen.getByTestId('구질칸-1').dataset.nameFrame).toBe('3')
  })
})

describe('구질 훈련 창 — 키 (0x17828 · 0x80268)', () => {
  it('탭 줄에서 ↓ 면 칸으로 들어가 비용 · 횟수를 그린다 — 칸 0 은 배운 칸이라 300 G · 2/2', () => {
    화면(투수())
    expect(screen.queryByTestId('구질훈련-비용-횟수')).toBeNull()

    키('ArrowDown')

    const info = screen.getByTestId('구질훈련-비용-횟수')
    expect(info.dataset.cost).toBe('300')
    expect(info.dataset.progress).toBe('2/2')
  })

  it('초점이 탭 줄이면 "배우기"(293), 배운 칸은 글이 없고, 목록에 든 칸은 "사용중"(296)', () => {
    화면(투수())
    expect(screen.getByTestId('구질훈련-글').dataset.label).toBe('293')

    키('ArrowDown')
    expect(screen.queryByTestId('구질훈련-글')).toBeNull()

    키('ArrowRight')
    expect(screen.getByTestId('구질훈련-글').dataset.label).toBe('296')
  })

  it('칸 첫 줄에서 ↑ 면 탭 줄로, 탭 줄에서 취소면 닫는다(107)', () => {
    let closed = false
    화면(투수(), () => {}, () => { closed = true })

    키('ArrowDown')
    키('ArrowUp')
    expect(screen.queryByTestId('구질훈련-비용-횟수')).toBeNull()
    expect(closed).toBe(false)

    키('Escape')
    expect(closed).toBe(true)
  })

  it('선행을 안 채운 칸은 StrMODE[68] 알림이다 — 행 1 열 2 H.SHOOT', () => {
    화면(투수())

    키('6')
    키('ArrowDown')
    키('ArrowDown')
    키('Enter')

    expect(screen.getByText(/선행 구질 훈련 완료/)).toBeTruthy()
  })

  it('확인 [예] 면 그 칸을 한 번 훈련한다 — StrMODE[66] 600 G', () => {
    let chosen: readonly [number, number] | null = null
    화면(투수(), (row, column) => { chosen = [row, column] })

    fireEvent.click(screen.getByRole('option', { name: 'CUT FAST' }))
    expect(screen.getByText(/600 G포인트/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(chosen).toEqual([0, 2])
  })

  it('G 가 모자라면 [65] 예/아니오 — 예는 139 를 거쳐 커서를 처음으로 되돌린다', () => {
    화면(투수({ gamePoint: 0 }))

    fireEvent.click(screen.getByRole('option', { name: 'CUT FAST' }))
    expect(screen.getByText(/G포인트가 부족합니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(screen.queryByTestId('구질훈련-비용-횟수')).toBeNull()
  })

  it('목록에 든 구질은 아무 말 없이 무시한다 (0xa436c)', () => {
    화면(투수())

    fireEvent.click(screen.getByRole('option', { name: 'H.FAST' }))

    expect(screen.queryByText(/소모됩니다/)).toBeNull()
  })
})
