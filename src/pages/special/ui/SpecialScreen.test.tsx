// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { ROW, SPECIAL_ITEMS, rowLeftOf, rowTopOf } from '@/pages/special/lib/specialLayout'

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

    expect(screen.getByText('등록된 선수가 없습니다')).toBeTruthy()
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
