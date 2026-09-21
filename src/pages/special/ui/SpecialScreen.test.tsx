// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import {
  HALL_OF_FAME_BUBBLE, HALL_OF_FAME_GRID, HALL_OF_FAME_PITCHER_SLOTS, HALL_OF_FAME_SLOTS,
  ROW, SPECIAL_ITEMS, hallOfFameBubblePositionOf, hallOfFameCellOf, rowLeftOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'

/**
 * 스페셜 목록 (메인 메뉴 상태 6, 하위 목록 0x2524c — P6 2d).
 * 여덟 칸(main_ui 프레임 15~21·28)을 오른쪽 세로 목록으로 20px 간격에 세운다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof SpecialScreen>[0]> = {}) =>
  render(<SpecialScreen collection={EMPTY_COLLECTION} onBack={vi.fn()} {...overrides} />)

const 칸 = (name: string) => screen.getByRole('button', { name })

describe('스페셜 목록 배치', () => {
  it('원본 여덟 칸을 모두 보여 준다 — 통신 기능도 지우지 않았다', () => {
    띄우기()

    for (const name of [
      'G포인트 충전', 'G포인트 선물', '친구추천', '명예의전당',
      '마선수선택', '에디트', '기록연감', '선물받기',
    ]) {
      expect(칸(name)).toBeTruthy()
    }
  })

  it('줄 간격은 20px 이고 오른쪽 끝이 x = 201 에 맞는다', () => {
    띄우기()

    expect(칸('G포인트 충전').style.top).toBe(`${rowTopOf(0)}px`)
    expect(칸('G포인트 선물').style.top).toBe(`${rowTopOf(0) + ROW.step}px`)
    for (const item of SPECIAL_ITEMS) {
      const 줄 = 칸(item.id)
      expect(줄.style.left).toBe(`${rowLeftOf(item)}px`)
      expect(Number.parseInt(줄.style.left, 10) + item.labelWidth).toBe(ROW.rightEdge)
    }
  })

  it('칸 그림은 main_ui 프레임 15~21·28 이다 (표 0xceb2f)', () => {
    const { container } = 띄우기()
    const 그림 = [...container.querySelectorAll('img')].map((image) => image.getAttribute('src'))

    for (const item of SPECIAL_ITEMS) {
      expect(그림).toContain(`./sprites/main_ui/frames/${String(item.labelFrame).padStart(3, '0')}.png`)
    }
  })

  it('고른 칸 설명 판은 main_ui 이미지 3 이고 설명은 StrMAINMENU 원문이다', () => {
    const { container } = 띄우기()

    expect(container.querySelector('img[src="./sprites/main_ui/003.png"]')).toBeTruthy()
    expect(screen.getByText('G포인트를 충전')).toBeTruthy()

    fireEvent.mouseEnter(칸('기록연감'))

    expect(screen.getByText('각종 기록과 게임 통계를')).toBeTruthy()
  })
})

describe('스페셜 칸 고르기', () => {
  it('통신 기능 칸은 안내만 띄운다 — 충전·선물·친구추천·선물받기', () => {
    띄우기()

    fireEvent.click(칸('G포인트 충전'))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/통신이 필요합니다/)).toBeTruthy()
  })

  it('아직 안 만든 칸도 안내를 띄운다 — 마선수선택·에디트', () => {
    띄우기()

    fireEvent.click(칸('에디트'))

    expect(screen.getByText(/아직 만들지 않았습니다/)).toBeTruthy()
  })

  it('기록연감 칸은 기록연감 화면으로 간다', () => {
    띄우기()

    fireEvent.click(칸('기록연감'))

    expect(screen.getByRole('button', { name: '닉네임' })).toBeTruthy()
  })

  it('명예의전당 칸은 명예의 전당 화면으로 간다', () => {
    띄우기()

    fireEvent.click(칸('명예의전당'))

    expect(screen.getByAltText('PLAYER')).toBeTruthy()
  })

  it('↑↓ 로 커서를 옮기고 Enter 로 연다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowUp' })  // 위로 한 칸 = 마지막 칸 선물받기
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.getByText(/통신이 필요합니다/)).toBeTruthy()
  })

  it('바닥띠 되돌아가기를 누르면 메인 메뉴로 나간다 (바닥 비트 0x4)', () => {
    const onBack = vi.fn()
    띄우기({ onBack })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onBack).toHaveBeenCalled()
  })
})

/**
 * 명예의 전당 (공용 목록 페이지 k = 8 — P6 2a-3 · S9 3~4절).
 * 격자 식은 확정값이고, 칸 너비·틈과 슬롯 상태 표만 근사다.
 */
describe('명예의 전당 격자 5×3', () => {
  const 열기 = () => {
    띄우기()
    fireEvent.click(칸('명예의전당'))
  }

  it('슬롯 15칸이고 왼쪽 x 20 에서 40 씩, 줄은 179 에서 40 씩이다', () => {
    열기()

    expect(screen.getAllByRole('button', { name: /번 슬롯$/ }).length).toBe(HALL_OF_FAME_SLOTS)
    expect(hallOfFameCellOf(0).x).toBe(20)
    expect(hallOfFameCellOf(4).x).toBe(180)
    expect(HALL_OF_FAME_GRID.firstRowY).toBe(179)
  })

  it('종류 6 의 열별 y 보정 [3,3,3,13,13] 이 그대로 붙는다 — 4·5열만 10px 위다', () => {
    expect(hallOfFameCellOf(0).y).toBe(179 - 3)
    expect(hallOfFameCellOf(3).y).toBe(179 - 13)
    expect(hallOfFameCellOf(4).y).toBe(179 - 13)
    expect(hallOfFameCellOf(10).y).toBe(179 + 80 - 3)
  })

  it('칸 바탕은 (x−3, y−3, 칸+3) 둥근 네모다 (0x7a844)', () => {
    열기()
    const cell = hallOfFameCellOf(0)
    const 칸0 = screen.getByRole('button', { name: '1번 슬롯' })

    expect(칸0.style.left).toBe(`${cell.x - 3}px`)
    expect(칸0.style.top).toBe(`${cell.y - 3}px`)
    expect(칸0.style.width).toBe(`${cell.width + 3}px`)
  })

  it('슬롯 0~4 는 투수 칸, 5~14 는 타자 칸이다 — 등록된 선수는 타자 칸부터 찬다', () => {
    const famer = {
      name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 },
      endingIndex: 6, season: 13, titleIds: [],
    }
    render(<SpecialScreen collection={{ ...EMPTY_COLLECTION, hallOfFame: [famer] }} onBack={vi.fn()} />)
    fireEvent.click(칸('명예의전당'))

    const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })
    expect(슬롯(HALL_OF_FAME_PITCHER_SLOTS).dataset.kind).toBe('찬칸')
    expect(슬롯(0).dataset.kind).toBe('빈칸')
    // 첫 커서가 타자 첫 칸이라 이름 막대에 그 선수가 뜬다
    expect(screen.getByText('전설')).toBeTruthy()
  })

  it('칸을 누르면 말풍선이 칸 오른쪽 26px 에 뜨고, 오른쪽 두 열에서는 왼쪽으로 뒤집는다', () => {
    열기()

    fireEvent.click(screen.getByRole('button', { name: '1번 슬롯' }))
    const 말풍선 = screen.getByRole('menu', { name: '명예의 전당 슬롯' })
    expect(말풍선.style.left).toBe(`${hallOfFameCellOf(0).x + 26}px`)
    expect(말풍선.style.width).toBe(`${HALL_OF_FAME_BUBBLE.width}px`)
    expect(screen.getByRole('menuitem', { name: '친구에게 선물' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '슬롯에서 삭제' })).toBeTruthy()

    // 4번째 열(열 3)은 칸 왼쪽으로 뒤집힌다
    const 오른쪽 = hallOfFameCellOf(3)
    expect(hallOfFameBubblePositionOf(오른쪽).x).toBe(오른쪽.x + 13 - HALL_OF_FAME_BUBBLE.width)
  })

  it('말풍선 두 칸은 아직 웹에서 못 하는 일이라 안내를 띄운다', () => {
    열기()

    fireEvent.click(screen.getByRole('button', { name: '1번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '친구에게 선물' }))

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('통신')
  })
})
