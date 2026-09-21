// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

// jsdom 에는 캔버스가 없다 — 타석 그리기는 컨텍스트가 없으면 스스로 멈춘다
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 띄우기 = () =>
  render(
    <HomeRunDerbyScreen
      ability={ROOKIE_BATTER_ABILITY}
      random={createSeededRandom(1)}
      bestDistance={320}
      gamePoint={1_000}
      onExit={vi.fn()}
    />,
  )

describe('홈런더비 화면', () => {
  it('제목과 남은 공 표시가 뜬다 — 첫 공은 1 / 10구', () => {
    띄우기()
    expect(screen.getByText('홈런더비')).toBeTruthy()
    expect(screen.getByText('1 / 10구')).toBeTruthy()
  })

  it('저장된 최고 비거리를 HUD 에 함께 보여 준다', () => {
    const { container } = 띄우기()
    // BEST 줄 딱지 — 숫자는 num.pzx 그림이라 글자로는 안 잡힌다
    expect(screen.getByText('BEST')).toBeTruthy()
    expect(container.querySelectorAll('img[data-state]')).toHaveLength(10)
  })
})

describe('경기 중 메뉴 (표 0xcfcfc 행 1 — 자동진행 자리에 다시하기)', () => {
  // 메뉴 칸은 `MenuList` 가 `role="option"` 으로 그리고, **고른 칸에는 커서 `▶` 가 붙는다**
  // (소프트키만 role="button")
  it('메뉴 소프트키로 열고 닫는다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    expect(screen.getByRole('option', { name: /계속/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('option', { name: /계속/ })).toBeNull()
  })

  it('**다시하기** 칸이 있다 — 자동진행이 아니다 (홈런더비는 행 1)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(screen.getByRole('option', { name: '다시하기' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /자동진행/ })).toBeNull()
  })

  it('설정을 안 넘기면 그 칸이 잠긴다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect((screen.getByRole('option', { name: '설정' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('다시하기를 고르면 StrGAME[7] 로 되묻고, 예를 눌러야 처음부터 다시 선다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByRole('option', { name: '다시하기' }))

    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()

    const 예 = screen.getAllByRole('option').find((option) => option.textContent?.endsWith('예'))
    fireEvent.click(예!)
    // 처음부터 다시 — 첫 공으로 돌아온다
    expect(screen.getByText('1 / 10구')).toBeTruthy()
  })
})
