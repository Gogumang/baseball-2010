// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
