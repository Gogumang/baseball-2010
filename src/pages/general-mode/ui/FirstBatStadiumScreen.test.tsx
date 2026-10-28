// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FIRST_BAT_PHASE, STADIUM_COUNT } from '@/pages/general-mode/lib/generalModeSetup'
import { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'

// 머리띠가 미끄러지는 다섯 그림 동안의 키 막음(`useFrameSlideKeyLock`)은 따로 시험한다 — 여기서는 다 내려온 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useFrameSlideKeyLock', () => ({ useFrameSlideKeyLock: () => ({ current: false }) }))

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
  const 구장단계 = (overrides: Partial<Props> = {}) => 띄우기({ phase: FIRST_BAT_PHASE.구장, ...overrides })

  it('좌·우 화살이 구장 커서를 옮긴다', () => {
    const onMoveStadium = vi.fn()
    구장단계({ stadiumId: 3, onMoveStadium })

    fireEvent.click(screen.getByRole('button', { name: '다음 구장' }))

    expect(onMoveStadium).toHaveBeenCalledWith(4)
  })

  it('커서는 끝에서 감는다 — 목록 꼴 0x10 (0x6bead)', () => {
    const onMoveStadium = vi.fn()
    구장단계({ stadiumId: STADIUM_COUNT - 1, onMoveStadium })

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onMoveStadium).toHaveBeenLastCalledWith(0)

    cleanup()
    구장단계({ stadiumId: 0, onMoveStadium })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onMoveStadium).toHaveBeenLastCalledWith(STADIUM_COUNT - 1)
  })

  it('⚠️ 빠른실행 뒤 남은 히든 구장 번호(12)에서 시작하면 오른쪽은 (12 + 11) mod 10 = 3 으로 튄다 (원본 그대로)', () => {
    const onMoveStadium = vi.fn()
    구장단계({ stadiumId: 12, onMoveStadium })

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onMoveStadium).toHaveBeenCalledWith(3)
  })

  it('OK 면 rec+0xc 에 적고 다음 단계로 간다', () => {
    const onChooseStadium = vi.fn()
    구장단계({ stadiumId: 7, onChooseStadium })

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onChooseStadium).toHaveBeenCalledWith(7)
  })

  it('연고지·좌석 두 줄은 원본 표 0xd1e0c · 0xd1e34 를 쓴다', () => {
    구장단계({ stadiumId: 1 })
    expect(screen.getByTestId('구장-연고지').textContent).toBe('서울')
    expect(screen.getByTestId('구장-좌석').textContent).toBe('30000석')

    cleanup()
    구장단계({ stadiumId: 9 })
    expect(screen.getByTestId('구장-연고지').textContent).toBe('독도')
    expect(screen.getByTestId('구장-좌석').textContent).toBe('15000석')
  })

  it('⚠️ 원본 그대로 — 히든 번호(12)는 좌석 줄이 스택 옆 연고지 포인터 값(0xd2440)을 찍는다', () => {
    구장단계({ stadiumId: 12 })

    expect(screen.getByTestId('구장-연고지').textContent).toBe('')
    expect(screen.getByTestId('구장-좌석').textContent).toBe('861248석')
  })
})

describe('숫자키 — 키 0x2896c (단계 0 날 키 · 단계 1 구장 격자 숫자키 꼴 1, Q-14)', () => {
  it("단계 0: '4' '6' 은 커서를 뒤집고 ↓ '8' '5' 는 OK 다 · ↑ 는 아무 일 없다", () => {
    const onMoveFirstBat = vi.fn()
    const onChooseFirstBat = vi.fn()
    const onCancel = vi.fn()
    띄우기({ playerSide: PLAYER_SIDE_LAST_BAT, onMoveFirstBat, onChooseFirstBat, onCancel })

    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '6' })
    expect(onMoveFirstBat).toHaveBeenCalledTimes(2)
    expect(onMoveFirstBat).toHaveBeenLastCalledWith(PLAYER_SIDE_FIRST_BAT)

    for (const key of ['ArrowDown', '8', '5']) fireEvent.keyDown(window, { key })
    expect(onChooseFirstBat).toHaveBeenCalledTimes(3)
    expect(onChooseFirstBat).toHaveBeenLastCalledWith(PLAYER_SIDE_LAST_BAT)

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: '2' })
    expect(onMoveFirstBat).toHaveBeenCalledTimes(2)
    expect(onChooseFirstBat).toHaveBeenCalledTimes(3)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it("단계 1: '4' '6' 은 구장을 넘기고 '5' 는 OK · ↑ '2' 는 CLR 처럼 단계 0 으로 · ↓ '8' 은 아무 일 없다", () => {
    const onMoveStadium = vi.fn()
    const onChooseStadium = vi.fn()
    const onCancel = vi.fn()
    띄우기({ phase: FIRST_BAT_PHASE.구장, stadiumId: 0, onMoveStadium, onChooseStadium, onCancel })

    fireEvent.keyDown(window, { key: '6' })
    expect(onMoveStadium).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(window, { key: '4' })
    expect(onMoveStadium).toHaveBeenLastCalledWith(STADIUM_COUNT - 1)

    fireEvent.keyDown(window, { key: '5' })
    expect(onChooseStadium).toHaveBeenCalledWith(0)

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: '8' })
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: '2' })
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onMoveStadium).toHaveBeenCalledTimes(2)
    expect(onChooseStadium).toHaveBeenCalledTimes(1)
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
