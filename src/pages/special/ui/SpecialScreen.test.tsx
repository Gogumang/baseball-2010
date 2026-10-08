// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HallOfFameScreen, SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import {
  HALL_OF_FAME_BUBBLE, HALL_OF_FAME_GRID, HALL_OF_FAME_SLOTS,
  ROW, SPECIAL_ITEMS, hallOfFameBubblePositionOf, hallOfFameCellOf, hallOfFameChartVerticesOf, rowLeftOf, rowTopOf,
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

  it('에디트 칸은 앱이 꽂은 상태 29 화면으로 가고, 그 화면의 CLR 은 목록으로 온다 (0x2b432)', () => {
    const renderEdit = vi.fn((onBack: () => void) => (
      <button type="button" onClick={onBack}>에디트-화면</button>
    ))
    띄우기({ renderEdit })

    fireEvent.click(칸('에디트'))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '에디트-화면' }))

    expect(칸('에디트')).toBeTruthy()
  })

  it('마선수선택 칸은 앱이 꽂은 상태 28 화면으로 가고, 그 화면의 되돌아가기는 목록으로 온다', () => {
    const renderAceSelect = vi.fn((onBack: () => void) => (
      <button type="button" onClick={onBack}>마선수-화면</button>
    ))
    띄우기({ renderAceSelect })

    fireEvent.click(칸('마선수선택'))
    fireEvent.click(screen.getByRole('button', { name: '마선수-화면' }))

    expect(칸('마선수선택')).toBeTruthy()
  })

  it('기록연감 칸은 기록연감 화면으로 간다', () => {
    띄우기()

    fireEvent.click(칸('기록연감'))

    expect(screen.getByRole('button', { name: '닉네임' })).toBeTruthy()
  })

  it('명예의전당 칸은 명예의 전당 화면으로 간다', () => {
    띄우기()

    fireEvent.click(칸('명예의전당'))

    // 화면 표식으로 B 딱지(ABILITY)를 본다 — A 딱지(PLAYER)는 원본이 k 8 에서 안 그려
    // 이제 웹판도 안 그린다 (0x63da0~0x63da6 이 `[sp+0xb4]` 를 0 으로 끈다)
    expect(screen.getByAltText('ABILITY')).toBeTruthy()
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
  /** 명예 투수 0번(칸 1)이 찬 스페셜 명예의 전당 — 말풍선은 결과 3·4(찬 칸)에서만 뜬다 (0x2ac00) */
  const 찬투수 = {
    name: '철완', ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
    equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 }, endingIndex: 5, season: 10, titleIds: [], slot: 0,
    look: { typeIndex: 0, handIndex: 0, skinIndex: 0, teamId: 1 },
  }
  const 찬칸열기 = (deletion?: HallOfFameDeletion) => {
    render(
      <HallOfFameScreen
        collection={{ ...EMPTY_COLLECTION, hallOfFamePitchers: [찬투수] }}
        mode={deletion === undefined ? { kind: '보기' } : { kind: '보기', deletion }}
        onBack={vi.fn()}
      />,
    )
  }

  it('바탕은 메뉴 바탕 0x58371 — main_title 프레임 13 · 이미지 7 (하위 27 0x2dcd8)', () => {
    찬칸열기()
    expect(screen.getByTestId('바탕-메뉴')).toBeTruthy()
    const srcs = Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(srcs).toContain('./sprites/main_title/frames/013.png')
    expect(srcs).toContain('./sprites/main_title/007.png')
  })

  it('하위 27 격자: 첫 열(칸 0·5·10)이 막혀 ← 는 건너뛰어 같은 줄 끝으로 감고, ↓ 는 끝에서 멈춘다 (0x25fa6~0x25fe8)', () => {
    찬칸열기()
    const 커서 = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-current')
    expect(커서('2번 슬롯')).toBe('true')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(커서('5번 슬롯')).toBe('true')
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: '8' })
    expect(커서('15번 슬롯')).toBe('true')
    fireEvent.keyDown(window, { key: '6' })
    expect(커서('12번 슬롯')).toBe('true')
  })

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

  it('칸 배치 0x5eb8c — 0·5·10 은 빈 자물쇠(상태 0), 투수 1~2·타자 6~9 가 열리고 나머지는 LOCK', () => {
    const famer = {
      name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 },
      endingIndex: 6, season: 13, titleIds: [], slot: 1,
    }
    render(<SpecialScreen collection={{ ...EMPTY_COLLECTION, hallOfFame: [famer] }} onBack={vi.fn()} />)
    fireEvent.click(칸('명예의전당'))

    const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })
    expect([0, 5, 10].map((index) => 슬롯(index).dataset.state)).toEqual(['0', '0', '0'])
    expect([1, 2, 3, 4].map((index) => 슬롯(index).dataset.state)).toEqual(['4', '4', '5', '5'])
    // 명예 타자 1번(칸 7)에 등록된 선수
    expect(슬롯(7).dataset.kind).toBe('찬칸')
    expect([6, 8, 9].map((index) => 슬롯(index).dataset.state)).toEqual(['4', '4', '4'])
    expect([11, 12, 13, 14].map((index) => 슬롯(index).dataset.state)).toEqual(['5', '5', '5', '5'])
    fireEvent.mouseEnter(슬롯(7))
    expect(screen.getByText('전설')).toBeTruthy()
    // 찬 칸은 능력치 도형에 값 마름모를 얹는다 (축 최대 800)
    expect(screen.getByLabelText('능력치 도형').querySelector('polygon[data-part="values"]')).not.toBeNull()
  })

  it('칸을 누르면 말풍선이 칸 오른쪽 26px 에 뜨고, 오른쪽 두 열에서는 왼쪽으로 뒤집는다', () => {
    찬칸열기()

    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    const 말풍선 = screen.getByRole('menu', { name: '명예의 전당 슬롯' })
    expect(말풍선.style.left).toBe(`${hallOfFameCellOf(1).x + 26}px`)
    expect(말풍선.style.width).toBe(`${HALL_OF_FAME_BUBBLE.width}px`)
    expect(screen.getByRole('menuitem', { name: '친구에게 선물' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '슬롯에서 삭제' })).toBeTruthy()

    // 4번째 열(열 3)은 칸 왼쪽으로 뒤집힌다
    const 오른쪽 = hallOfFameCellOf(3)
    expect(hallOfFameBubblePositionOf(오른쪽).x).toBe(오른쪽.x + 13 - HALL_OF_FAME_BUBBLE.width)
  })

  it('선물은 통신(🌐)이라 안내만 띄운다', () => {
    찬칸열기()

    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '친구에게 선물' }))

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('통신')
  })

  it('빈 칸은 말풍선 대신 StrCOMMON[39], 잠긴 칸은 [45] 슬롯 구매 — 목록 종류 2 도 0x627d4 갈래다', () => {
    찬칸열기()

    fireEvent.click(screen.getByRole('button', { name: '3번 슬롯' }))
    expect(screen.queryByRole('menu', { name: '명예의 전당 슬롯' })).toBeNull()
    expect(screen.getByText(/명예의전당 선수를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    fireEvent.click(screen.getByRole('button', { name: '4번 슬롯' }))
    expect(screen.getByText(/투수 슬롯 2개가 오픈됩니다/)).toBeTruthy()
  })

  it('슬롯에서 삭제 — [128] 확인 "예" 면 그 칸을 지우고 StrCOMMON[46] (0x62994)', () => {
    const onDelete = vi.fn()
    찬칸열기({ isBlocked: () => false, onDelete })

    fireEvent.click(screen.getByRole('button', { name: '3번 슬롯' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '슬롯에서 삭제' }))

    // 통과하면 말풍선이 닫히고(하위 0) 확인 창이 뜬다
    expect(screen.queryByRole('menu', { name: '명예의 전당 슬롯' })).toBeNull()
    expect(screen.getByText(/현재 명예선수를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onDelete).toHaveBeenCalledWith('투수', 0)
    expect(screen.getByText(/선수를 삭제하였습니다/)).toBeTruthy()
  })

  it('"아니오" 면 아무것도 지우지 않는다 (0x62e54)', () => {
    const onDelete = vi.fn()
    찬칸열기({ isBlocked: () => false, onDelete })

    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '슬롯에서 삭제' }))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onDelete).not.toHaveBeenCalled()
  })

  it('[128] 확인 창의 처음 커서는 [아니오] 다 — 0x2ae42 0x749d5(popup, 1)', () => {
    const onDelete = vi.fn()
    찬칸열기({ isBlocked: () => false, onDelete })

    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '슬롯에서 삭제' }))
    expect(screen.getByRole('button', { name: '아니오' }).querySelector('img')?.getAttribute('src'))
      .toContain('popup/frames/007.png')
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByText(/현재 명예선수를/)).toBeNull()
  })

  it('시즌 팀에 있고 시즌모드 경기 진행 중이면 StrMAINMENU[213] 으로 막고 말풍선은 남는다', () => {
    const onDelete = vi.fn()
    찬칸열기({ isBlocked: () => true, onDelete })

    fireEvent.click(screen.getByRole('button', { name: '2번 슬롯' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '슬롯에서 삭제' }))

    expect(screen.getByText(/삭제 하실 수 없습니다/)).toBeTruthy()
    expect(screen.getByRole('menu', { name: '명예의 전당 슬롯' })).toBeTruthy()
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('명예의 전당 등록 목록 — 나리 상태 145 (0x62568 목록 종류 3)', () => {
  const 나리 = { name: '홍길동', equippedAbility: [999, 800, 400, 0] }
  const 열기등록 = (overrides: Partial<{ onRegister: () => '등록' | 'G부족' | '빈칸없음' | '엔딩전'; edition: '투수' | '타자' }> = {}) => {
    const onRegister = vi.fn(overrides.onRegister ?? (() => '등록' as const))
    const onDone = vi.fn()
    const onLater = vi.fn()
    render(
      <HallOfFameScreen
        collection={EMPTY_COLLECTION}
        mode={{ kind: '등록', edition: overrides.edition ?? '타자', nari: { 투수: null, 타자: 나리 }, onRegister, onDone, onLater }}
        onBack={vi.fn()}
      />,
    )
    const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })
    return { onRegister, onDone, onLater, 슬롯 }
  }

  it('나리 칸 0·5 는 저장이 있으면 상태 1, 없으면 2', () => {
    const { 슬롯 } = 열기등록()
    expect(슬롯(5).dataset.state).toBe('1')
    expect(슬롯(0).dataset.state).toBe('2')
  })

  it('열린 빈 칸을 고르면 그 칸 번호로 [50] 확인 뒤 등록한다 (코드 6 — 칸 8 → 타자 2번)', () => {
    const { onRegister, onDone, 슬롯 } = 열기등록()
    fireEvent.click(슬롯(8))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onRegister).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('G 가 모자라면 0xcc214 "구매 페이지로 이동하시겠습니까?" — 어느 답이든 목록으로 돌아온다', () => {
    const { onDone, 슬롯 } = 열기등록({ onRegister: () => 'G부족' })
    fireEvent.click(슬롯(5))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(screen.getByText(/구매/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('남의 편 칸·잠긴 칸은 자기 편만 받는다 — 투수편이면 칸 0 의 나리 투수 없음은 StrCOMMON[38]', () => {
    const { 슬롯 } = 열기등록({ edition: '투수' })
    fireEvent.click(슬롯(8))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(슬롯(0))
    expect(screen.getByText(/먼저 등록해야합니다/)).toBeTruthy()
  })

  it('잠긴 자기 편 칸은 슬롯 현금 구매 [54] (🌐)', () => {
    const { 슬롯 } = 열기등록()
    fireEvent.click(슬롯(12))
    expect(screen.getByText(/타자 슬롯 4개가 오픈됩니다/)).toBeTruthy()
  })

  it('되돌아가기는 StrMODE[219] "나중에 등록" — 예면 나간다', () => {
    const { onLater } = 열기등록()
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(screen.getByText(/나중에 등록/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onLater).toHaveBeenCalled()
  })
})

describe('미션 선수 고르기 — 메인 메뉴 하위 17 (0x2613c 목록 종류 0 · 키 0x627d4)', () => {
  const 나리 = { name: '홍길동', equippedAbility: [999, 800, 400, 0] }
  const 명예투수 = {
    name: '철완', ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
    equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 }, endingIndex: 5, season: 10, titleIds: [], slot: 1,
    look: { typeIndex: 0, handIndex: 0, skinIndex: 0, teamId: 1 },
  }
  const 명예타자 = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [], slot: 2 }
  const 열기 = (nari: { 투수: typeof 나리 | null; 타자: typeof 나리 | null } = { 투수: null, 타자: 나리 }) => {
    const onPick = vi.fn()
    const onCancel = vi.fn()
    render(
      <HallOfFameScreen
        collection={{ ...EMPTY_COLLECTION, hallOfFame: [명예타자], hallOfFamePitchers: [명예투수] }}
        mode={{ kind: '선수고르기', nari, onPick, onCancel }}
        onBack={vi.fn()}
      />,
    )
    const 슬롯 = (index: number) => screen.getByRole('button', { name: `${index + 1}번 슬롯` })
    return { onPick, onCancel, 슬롯 }
  }

  it('종류 0 은 나리 칸과 명전 칸을 다 채운다 (0x5eb8c) — 처음 커서는 칸 0', () => {
    const { 슬롯 } = 열기()
    expect(슬롯(0).dataset.state).toBe('2')
    expect(슬롯(5).dataset.state).toBe('1')
    expect(슬롯(2).dataset.state).toBe('3')
    expect(슬롯(8).dataset.state).toBe('3')
    expect(슬롯(1).dataset.state).toBe('4')
    expect(슬롯(3).dataset.state).toBe('5')
    expect(슬롯(10).dataset.state).toBe('0')
    expect(슬롯(0).getAttribute('aria-current')).toBe('true')
  })

  it('코드 1·2 는 나리 선수(+0xa5/+0xa6 = −1), 3·4 는 명전 번호 (0x5eae0)', () => {
    const { onPick, 슬롯 } = 열기({ 투수: 나리, 타자: 나리 })
    fireEvent.click(슬롯(0))
    expect(onPick).toHaveBeenLastCalledWith({ side: '투수', hallOfFameIndex: null })
    fireEvent.click(슬롯(5))
    expect(onPick).toHaveBeenLastCalledWith({ side: '타자', hallOfFameIndex: null })
    fireEvent.click(슬롯(2))
    expect(onPick).toHaveBeenLastCalledWith({ side: '투수', hallOfFameIndex: 1 })
    fireEvent.click(슬롯(8))
    expect(onPick).toHaveBeenLastCalledWith({ side: '타자', hallOfFameIndex: 2 })
  })

  it('나리 선수 없음 5 → StrCOMMON[38] · 빈 명전 칸 6 → [39] · 잠긴 칸 7 → [45]/[54] — 고르지 못한다', () => {
    const { onPick, 슬롯 } = 열기()
    fireEvent.click(슬롯(0))
    expect(screen.getByText(/나만의리그 선수를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(슬롯(1))
    expect(screen.getByText(/명예의전당 선수를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(슬롯(3))
    expect(screen.getByText(/투수 슬롯 2개가 오픈됩니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))
    fireEvent.click(슬롯(12))
    expect(screen.getByText(/타자 슬롯 4개가 오픈됩니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.click(슬롯(10))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('말풍선은 뜨지 않고, 되돌아가기는 결과 0 (0x6286e)', () => {
    const { onCancel, 슬롯 } = 열기()
    fireEvent.click(슬롯(2))
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('홈런더비 선수 고르기 — 하위 16 (0x25e6c 목록 종류 1 · 5×2 · 칸 5 부터)', () => {
  const 나리 = { name: '홍길동', equippedAbility: [999, 800, 400, 0] }
  const 명예타자 = { name: '전설', ability: { hit: 1, power: 2, defense: 3, run: 4 }, endingIndex: 6, season: 13, titleIds: [], slot: 0 }
  const 열기 = () => {
    const onPick = vi.fn()
    render(
      <HallOfFameScreen
        collection={{ ...EMPTY_COLLECTION, hallOfFame: [명예타자] }}
        mode={{ kind: '선수고르기', purpose: '홈런더비', nari: { 투수: 나리, 타자: 나리 }, onPick, onCancel: vi.fn() }}
        onBack={vi.fn()}
      />,
    )
    return { onPick }
  }

  it('타자 칸 5~14 열 칸만 격자 첫 두 줄에 그린다 — 처음 커서는 칸 5', () => {
    열기()
    expect(screen.queryByRole('button', { name: '1번 슬롯' })).toBeNull()
    expect(screen.queryByRole('button', { name: '5번 슬롯' })).toBeNull()
    const first = screen.getByRole('button', { name: '6번 슬롯' })
    expect(first.getAttribute('aria-current')).toBe('true')
    expect(first.style.left).toBe(`${hallOfFameCellOf(0).x - HALL_OF_FAME_GRID.backingInset}px`)
    expect(screen.getByRole('button', { name: '15번 슬롯' }).style.top)
      .toBe(`${hallOfFameCellOf(9).y - HALL_OF_FAME_GRID.backingInset}px`)
  })

  it('나리 타자 → 코드 2 · 명예 타자 → 코드 4 (+0xa6 = 명전 번호)', () => {
    const { onPick } = 열기()
    fireEvent.click(screen.getByRole('button', { name: '6번 슬롯' }))
    expect(onPick).toHaveBeenLastCalledWith({ side: '타자', hallOfFameIndex: null })
    fireEvent.click(screen.getByRole('button', { name: '7번 슬롯' }))
    expect(onPick).toHaveBeenLastCalledWith({ side: '타자', hallOfFameIndex: 0 })
  })

  const 커서 = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-current')

  it('방향키는 두 줄 안에서만 움직이고, 막힌 칸 5(슬롯 10)는 건너뛰다 끝에 닿으면 제자리다 (0x25eaa · 0x6c445)', () => {
    열기()
    // 슬롯 5 ↓ → 칸 5 막힘 → 한 걸음 더 ↓ 는 끝이라 처음 칸으로
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(커서('6번 슬롯')).toBe('true')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(커서('12번 슬롯')).toBe('true')
    // 아랫줄 ← : 칸 6 → 칸 5 막힘 → 감아 칸 9 (꼴 0x10)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(커서('15번 슬롯')).toBe('true')
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '2' })
    expect(커서('10번 슬롯')).toBe('true')
  })
})

describe('명예의 전당 능력치 도형 — 축 최대 800 (0x5e864)', () => {
  it('최대길이 = 30 × 800 / 999 = 24, 값 0 이면 가운데', () => {
    const center = { x: 178, y: 104 }
    const [왼위, 오른위] = hallOfFameChartVerticesOf(center, [999, 0, 0, 0])
    expect(오른위).toEqual(center)
    // 225° 축 길이 24 — x 는 178 + (24 · cos225 ×65535) >> 16
    expect(왼위.x).toBeLessThan(center.x)
    expect(Math.round(Math.hypot(왼위.x - center.x, 왼위.y - center.y))).toBe(24)
  })
})

describe('머리띠 0x54d95 — 제목이 있으면 G포인트도 그린다 (0x550d8~0x550de)', () => {
  const 그림들 = (container: HTMLElement) => [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')

  it('스페셜 목록(하위 6)은 제목 0 "2010프로야구"(game_frame 3) + G — G 를 넘기면 숫자 그림이 선다', () => {
    const { container } = 띄우기({ gamePoint: 1234 })
    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/003.png')
    expect(srcs.filter((src) => src.startsWith('./sprites/gpoint/'))).toHaveLength(5)
  })

  it('스페셜 명예의 전당(하위 27, 0x2dcd8)은 제목 16 "명예의전당"(game_frame 29) + G', () => {
    const { container } = 띄우기({ gamePoint: 7 })
    fireEvent.click(칸('명예의전당'))
    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/029.png')
    expect(srcs).not.toContain('./sprites/game_frame/003.png')
    expect(srcs).toContain('./sprites/gpoint/007.png')
  })

  it('G 를 안 넘기면 예전 띠(제목 0, G 없음)', () => {
    const { container } = 띄우기()
    expect(그림들(container).filter((src) => src.startsWith('./sprites/gpoint/'))).toHaveLength(0)
  })
})

describe('A 자리 고른 선수 몸 그림 — 0x63b14 찬 칸 갈래 · 0x669c0 → 0x65e80', () => {
  const 나리타자 = {
    name: '홍길동', equippedAbility: [1, 2, 3, 4],
    figure: { form: 1, skin: 1, team: 4, equipment: [0, 0, 0, 0] as [number, number, number, number] },
  }
  const 명예투수 = {
    name: '철완', ability: { control: 1, velocity: 2, breaking: 3, stamina: 4 },
    equippedAbility: { control: 1, velocity: 2, breaking: 3, stamina: 4 }, endingIndex: 5, season: 10, titleIds: [], slot: 0,
    look: { typeIndex: 0, handIndex: 1, skinIndex: 0, teamId: 1 },
  }
  const 열기 = () => render(
    <HallOfFameScreen
      collection={{ ...EMPTY_COLLECTION, hallOfFamePitchers: [명예투수] }}
      mode={{ kind: '선수고르기', nari: { 투수: null, 타자: 나리타자 }, onPick: vi.fn(), onCancel: vi.fn() }}
      onBack={vi.fn()}
    />,
  )

  it('빈 칸은 원 두 개, 찬 칸은 원 없이 몸 그림 (0x6535a 갈래만 원을 깐다)', () => {
    const { container } = 열기()
    // 처음 커서는 칸 0(나리 투수 없음, 상태 2)
    expect(screen.queryByTestId('명전-타자그림')).toBeNull()
    expect(container.querySelectorAll('[class*="hofCircle"]').length).toBe(2)
    fireEvent.mouseEnter(screen.getByRole('button', { name: '6번 슬롯' }))
    expect(container.querySelectorAll('[class*="hofCircle"]').length).toBe(0)
  })

  it('나리 타자 칸 5 — 그림을 (A.x, A.y + 45) 에 바로, 좌타(폼 1)는 안 뒤집고 팀 로고는 나리 팀', () => {
    열기()
    fireEvent.mouseEnter(screen.getByRole('button', { name: '6번 슬롯' }))
    const 그림 = screen.getByTestId('명전-타자그림')
    expect(그림.style.left).toBe('58px')
    expect(그림.dataset.mirrored).toBeUndefined()
    expect(screen.getByTestId('명전-팀로고').getAttribute('src')).toBe('./sprites/team_logo/004.png')
  })

  it('명전 투수 칸 1 — 54×75 이미지를 (A.x − 0x32, A.y − 0x61) 에 (좌완), 팀 로고는 없다', () => {
    열기()
    fireEvent.mouseEnter(screen.getByRole('button', { name: '2번 슬롯' }))
    const 이미지 = screen.getByTestId('명전-투수그림')
    expect([이미지.style.left, 이미지.style.top, 이미지.style.width, 이미지.style.height]).toEqual(['8px', '13px', '54px', '75px'])
    expect(screen.queryByTestId('명전-팀로고')).toBeNull()
  })
})
