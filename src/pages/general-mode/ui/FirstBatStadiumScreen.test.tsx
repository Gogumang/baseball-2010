// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FIRST_BAT_PHASE, STADIUM_COUNT } from '@/pages/general-mode/lib/generalModeSetup'
import { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'

/** 선공/구장 (하위 상태 20, 목록 k = 3) — 한 화면에서 두 단계를 돈다 */

afterEach(cleanup)

type Props = Parameters<typeof FirstBatStadiumScreen>[0]

const 띄우기 = (overrides: Partial<Props> = {}) =>
  render(
    <FirstBatStadiumScreen
      userTeamId={0}
      aiTeamId={1}
      phase={FIRST_BAT_PHASE.선공}
      playerSide={PLAYER_SIDE_FIRST_BAT}
      stadiumId={0}
      onMoveFirstBat={vi.fn()}
      onChooseFirstBat={vi.fn()}
      onMoveStadium={vi.fn()}
      onChooseStadium={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )

describe('단계 0 — 선공 고르기', () => {
  it('두 쪽 중 하나를 눌러 rec+8 에 적는다', () => {
    const onChooseFirstBat = vi.fn()
    띄우기({ onChooseFirstBat })

    fireEvent.click(screen.getByRole('button', { name: 'CPU 선공' }))

    expect(onChooseFirstBat).toHaveBeenCalledWith(PLAYER_SIDE_LAST_BAT)
  })

  it('좌·우 키는 커서만 뒤집는다 (skin+0x74)', () => {
    const onMoveFirstBat = vi.fn()
    const onChooseFirstBat = vi.fn()
    띄우기({ onMoveFirstBat, onChooseFirstBat })

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onMoveFirstBat).toHaveBeenCalledWith(PLAYER_SIDE_LAST_BAT)
    expect(onChooseFirstBat).not.toHaveBeenCalled()
  })

  it('구장 화살은 아직 나오지 않는다', () => {
    띄우기()

    expect(screen.queryByRole('button', { name: '다음 구장' })).toBeNull()
  })
})

describe('단계 1 — 구장 고르기', () => {
  const 구장단계 = (overrides: Partial<Props> = {}) =>
    띄우기({ phase: FIRST_BAT_PHASE.구장, ...overrides })

  it('좌·우 화살이 구장 커서를 옮긴다', () => {
    const onMoveStadium = vi.fn()
    구장단계({ stadiumId: 3, onMoveStadium })

    fireEvent.click(screen.getByRole('button', { name: '다음 구장' }))

    expect(onMoveStadium).toHaveBeenCalledWith(4)
  })

  it('커서는 끝에서 멈춘다 — 감싸지 않는다', () => {
    const onMoveStadium = vi.fn()
    구장단계({ stadiumId: STADIUM_COUNT - 1, onMoveStadium })

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onMoveStadium).toHaveBeenCalledWith(STADIUM_COUNT - 1)
  })

  it('OK 면 rec+0xc 에 적고 다음 단계로 간다', () => {
    const onChooseStadium = vi.fn()
    구장단계({ stadiumId: 7, onChooseStadium })

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onChooseStadium).toHaveBeenCalledWith(7)
  })

  it('구장 표를 받으면 연고지·좌석 두 줄을 채운다', () => {
    구장단계({ stadiumId: 1, stadiums: [{ city: '서울', capacity: 30000 }, { city: '인천', capacity: 25000 }] })

    expect(screen.getByTestId('구장-연고지').textContent).toBe('인천')
    expect(screen.getByTestId('구장-좌석').textContent).toBe('25000석')
  })

  it('⚠️ 구장 표가 없으면 두 줄을 비워 둔다 — 도시명 0xd1df8·좌석 0xd1e34 가 웹판에 없다', () => {
    구장단계()

    expect(screen.getByTestId('구장-연고지').textContent).toBe('')
    expect(screen.getByTestId('구장-좌석').textContent).toBe('')
  })
})

describe('CLR', () => {
  it('되돌아가기를 부른다', () => {
    const onCancel = vi.fn()
    띄우기({ onCancel })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
  })
})

describe('머리띠·바닥띠 (ScreenFrame)', () => {
  it('머리띠에 제목 4 "선공/구장" 그림이 뜬다 (P6 1-1)', () => {
    const { container } = 띄우기()

    expect(container.querySelector('img[src$="game_frame/004.png"]')).toBeTruthy()
  })

  it('바닥띠 되돌아가기가 여전히 눌린다 — 원본 소프트키 자리다', () => {
    const onCancel = vi.fn()
    띄우기({ onCancel })

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it("구장 단계의 '이 구장으로' 는 그대로 남는다", () => {
    const onChooseStadium = vi.fn()
    띄우기({ phase: FIRST_BAT_PHASE.구장, stadiumId: 2, onChooseStadium })

    fireEvent.click(screen.getByRole('button', { name: '이 구장으로' }))

    expect(onChooseStadium).toHaveBeenCalledWith(2)
  })
})
