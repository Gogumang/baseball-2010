// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import {
  BAND_BACKGROUND, BAND_WINDOW, BATTER_EDITION_MODE, ENDING_IMAGE, SHORT_ENDING_TEXT_TOP, WALK_IN,
  creditsTopOf, creditsWalkersOf, endingImageOffsetOf, endingWalkInAnimationOf, endingWalkInPaletteOf,
  irisCircleOf, irisStartTickOf, risingTextTopOf,
} from '@/pages/ending/lib/endingLayout'

/**
 * 나만의리그 엔딩 (상태 141 — 0x87c7c · 0x168fc → 0x882b4 / 0x88bb4).
 * 부상·방출은 띠 창 + 걸어 들어오는 선수, 은퇴 엔딩은 그림 + 원형 전환 + 올라오는 글, 그 뒤 제작진.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof EndingScreen>[0]> = {}) =>
  render(
    <EndingScreen
      playerName="홍길동"
      endingIndex={9}
      bonusGamePoint={3000}
      isContinuable={false}
      hallOfFame={{
        collection: EMPTY_COLLECTION,
        edition: '타자',
        nari: { 투수: null, 타자: { name: '홍길동', equippedAbility: [500, 500, 500, 500] } },
        onRegister: vi.fn(() => '등록' as const),
      }}
      onContinue={vi.fn(() => true)}
      onFinish={vi.fn()}
      {...overrides}
    />,
  )

describe('부상·방출 엔딩 (0x883b6 갈래)', () => {
  it('띠 창은 mode_ui 프레임 10 박스 0 을 화면 세로 가운데로 옮긴 (0, 124, 240, 72) 다', () => {
    expect(BAND_WINDOW.y).toBe(124)
    const { container } = 띄우기({ endingIndex: 0, isContinuable: true })
    expect(container.querySelector('rect[data-part="box"]')?.getAttribute('y')).toBe('124')
  })

  it('위·아래 11px 띠는 박스 바깥이다 (113~124 · 196~207)', () => {
    const { container } = 띄우기({ endingIndex: 1, isContinuable: true })
    expect(container.querySelector('rect[data-part="top"]')?.getAttribute('y')).toBe('113')
    expect(container.querySelector('rect[data-part="bottom"]')?.getAttribute('y')).toBe('196')
  })

  it('띠 안에 mode_back 배경을 (1, 125) 에 70 높이로 자른다', () => {
    expect(BAND_BACKGROUND).toMatchObject({ left: 1, top: 125, height: 70 })
  })

  it('엔딩 그림·원형 전환은 없고, 글은 띠 아래 칸 가운데 줄(263)이다', () => {
    const { container } = 띄우기({ endingIndex: 0, isContinuable: true })
    expect(container.querySelector('img[data-part="ending-image"]')).toBeNull()
    expect(screen.queryByLabelText('원형 전환')).toBeNull()
    expect(SHORT_ENDING_TEXT_TOP).toBe(263)
  })

  it('걸어 들어오는 선수는 3틱에 1px 왼쪽으로 오고 8틱에 한 번 1px 튄다 — 발 196 · 아이콘 120', () => {
    expect(WALK_IN.xOf(0, WALK_IN.characterDx)).toBe(220)
    expect(WALK_IN.xOf(3, WALK_IN.characterDx)).toBe(219)
    expect(WALK_IN.xOf(0, WALK_IN.iconDx)).toBe(178)
    expect(WALK_IN.characterYOf(8)).toBe(195)
    expect(WALK_IN.characterYOf(9)).toBe(196)
    expect(WALK_IN.iconYOf(8)).toBe(119)
    expect(WALK_IN.iconYOf(9)).toBe(120)
  })

  it('애니 번호는 레코드 +0xb 가 고른다 — 타자 장타형만 8+2, 그 밖은 0+2 (0x63a5c)', () => {
    const 기본 = { mode: BATTER_EDITION_MODE, typeIndex: 0, handIndex: 0, skinIndex: 0 }
    expect(endingWalkInAnimationOf(기본)).toBe(2)
    expect(endingWalkInAnimationOf({ ...기본, typeIndex: 1 })).toBe(10)
    expect(endingWalkInAnimationOf({ ...기본, handIndex: 1 })).toBe(2)
    expect(endingWalkInAnimationOf({ ...기본, mode: 3, typeIndex: 2 })).toBe(2)
  })

  it('⚠️ 원본 그대로 — 엔딩 팔레트는 피부 1→0 · 2→1 · 그 밖(0 황인)→2 다 (0x63a92)', () => {
    const 기본 = { mode: BATTER_EDITION_MODE, typeIndex: 0, handIndex: 0, skinIndex: 0 }
    expect(endingWalkInPaletteOf({ ...기본, skinIndex: 1 })).toBe(0)
    expect(endingWalkInPaletteOf({ ...기본, skinIndex: 2 })).toBe(1)
    expect(endingWalkInPaletteOf(기본)).toBe(2)
  })

  it('고른 애니·팔레트 번호를 걸어 들어오는 그림에 얹는다', () => {
    const { container } = 띄우기({
      endingIndex: 1,
      isContinuable: true,
      walkInLook: { mode: BATTER_EDITION_MODE, typeIndex: 1, handIndex: 0, skinIndex: 1 },
    })
    const walkIn = container.querySelector('div[data-animation]') as HTMLElement

    expect(walkIn.dataset.animation).toBe('10')
    expect(walkIn.dataset.palette).toBe('0')
  })
})

describe('은퇴 엔딩 2~9 (0x886ca 갈래)', () => {
  it('띠 창·걸어 들어오는 선수 없이 그림을 그린다', () => {
    const { container } = 띄우기({ endingIndex: 5 })
    expect(container.querySelector('img[data-part="ending-image"]')).not.toBeNull()
    expect(container.querySelector('rect[data-part="box"]')).toBeNull()
    expect(container.querySelector('div[data-animation]')).toBeNull()
  })

  it('그림은 −52 에서 1px/틱으로 서고, e 4~9 는 다시 목표(−37·−52)까지 1px/틱 옮긴다', () => {
    expect(ENDING_IMAGE.startOffset).toBe(-52)
    expect(endingImageOffsetOf(0, 2)).toBe(-52)
    expect(endingImageOffsetOf(52, 2)).toBe(0)
    expect(endingImageOffsetOf(200, 3)).toBe(0)
    expect(endingImageOffsetOf(52, 4)).toBe(0)
    expect(endingImageOffsetOf(60, 4)).toBe(-8)
    expect(endingImageOffsetOf(500, 4)).toBe(-37)
    expect(endingImageOffsetOf(500, 7)).toBe(-52)
  })

  it('원형 전환은 그림이 선 틀에 켜진다 — e 2·3 은 51, e 4 는 88, e 7 은 103', () => {
    expect(irisStartTickOf(2)).toBe(51)
    expect(irisStartTickOf(4)).toBe(88)
    expect(irisStartTickOf(7)).toBe(103)
  })

  it('원은 화면 전체(240)에서 사인 감속으로 줄어 e 의 크기에 선다 — 가운데는 그대로다', () => {
    const 처음 = irisCircleOf(0, 3)
    const 끝 = irisCircleOf(7, 3)
    expect(처음?.diameter).toBe(240)
    expect(끝?.diameter).toBe(90)
    // 가운데 (W/2 + dx + s/2, H/2 + dy + s/2) = (57, 211)
    expect((처음?.x ?? 0) + (처음?.diameter ?? 0) / 2).toBe(57)
    expect((끝?.x ?? 0) + (끝?.diameter ?? 0) / 2).toBe(57)
    expect((끝?.y ?? 0) + (끝?.diameter ?? 0) / 2).toBe(211)
    // t = 6 은 sin(96°)=99 라 조금 더 작아졌다가 7 에 선다 (원본 그대로)
    expect(irisCircleOf(6, 3)?.diameter).toBeLessThan(90)
    expect(irisCircleOf(0, 1)).toBeNull()
  })

  it('글은 StrENDING[20] 머리말 + 본 엔딩이고 1px/틱으로 아래에서 올라온다', () => {
    띄우기({ endingIndex: 9 })
    expect(screen.getByText(/위대한 선수/)).toBeTruthy()
    expect(screen.getByText(/홍길동/)).toBeTruthy()
    expect(risingTextTopOf(0)).toBe(320)
    expect(risingTextTopOf(10)).toBe(310)
  })
})

describe('제작진 (0x88bb4)', () => {
  it('연애 엔딩 9 + c 를 제작진 앞에 붙이고 2틱에 1px 올라온다', () => {
    띄우기({ endingIndex: 9, seenEventIds: ['300'] })
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.getByText(/가장 소중한 한 사람과/)).toBeTruthy()
    expect(screen.getByText('-총괄/PM-')).toBeTruthy()
    expect(creditsTopOf(0)).toBe(320)
    expect(creditsTopOf(3)).toBe(319)
  })

  it('선수와 본 연애 상대가 c 에 따라 자리·뒤집기·애니를 받는다 (0x87fda~0x88266)', () => {
    const 기본 = { mode: BATTER_EDITION_MODE, typeIndex: 1, handIndex: 0, skinIndex: 0 }
    expect(creditsWalkersOf(기본, [])).toEqual([
      expect.objectContaining({ x: 120, animation: 8 + 6, isPlayer: true, isFlipped: false }),
    ])
    const 둘 = creditsWalkersOf(기본, [301])
    expect(둘.map((walker) => walker.x)).toEqual([160, 80])
    expect(둘[1]).toMatchObject({ folder: './sprites/event_char_1/frames', animation: 7 + 5, isFlipped: true })
    const 셋 = creditsWalkersOf(기본, [300, 303])
    expect(셋[0].turnsEvery20).toBe(true)
    expect(셋.map((walker) => walker.x)).toEqual([120, 40, 200])
    expect(creditsWalkersOf(기본, [300, 301, 302]).map((walker) => walker.x)).toEqual([205, 20, 70, 120])
    expect(creditsWalkersOf(기본, [300, 301, 302, 303]).map((walker) => walker.animation)).toEqual([8 + 1, 0 + 1, 7 + 1, 15 + 1, 23 + 1])
  })
})

describe('엔딩 흐름', () => {
  it('엔딩 글은 StrENDING[결과] 이고 %s 에 선수 이름이 들어간다', () => {
    띄우기({ endingIndex: 9 })

    expect(screen.getByText(/홍길동/)).toBeTruthy()
  })

  it('은퇴 엔딩은 확인하면 제작진 [21] 이 아래에서 위로 흐른다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByText('-총괄/PM-')).toBeTruthy()
  })

  it('제작진 뒤에 엔딩 보너스 → 명예의 전당 등록 목록(상태 145)에서 칸을 골라 등록한다', () => {
    const onRegister = vi.fn(() => '등록' as const)
    const onFinish = vi.fn()
    띄우기({
      onFinish,
      hallOfFame: {
        collection: EMPTY_COLLECTION,
        edition: '타자',
        nari: { 투수: null, 타자: { name: '홍길동', equippedAbility: [500, 500, 500, 500] } },
        onRegister,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: '확인' })) // 엔딩 글 → 제작진
    fireEvent.click(screen.getByRole('button', { name: '확인' })) // 제작진 → 보너스

    expect(screen.getByText(/3000 G포인트/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    fireEvent.click(screen.getByRole('button', { name: '예' })) // StrMODE[215] → 등록 목록

    // 칸 5(나리 타자, 코드 2) → 첫 빈 칸으로 [50] 확인
    fireEvent.click(screen.getByRole('button', { name: '6번 슬롯' }))
    expect(screen.getByText(/20000 G포인트 소모/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onRegister).toHaveBeenCalledWith(null)
    expect(screen.getByText(/등록이 완료되었습니다/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onFinish).toHaveBeenCalled()
  })

  it('등록을 묻는 팝업에 아니오면 곧장 끝낸다 — StrMODE[219] 는 목록의 취소다 (0x1bbc4)', () => {
    const onFinish = vi.fn()
    띄우기({ onFinish, bonusGamePoint: 0 })

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onFinish).toHaveBeenCalled()
  })

  it('부상·방출 엔딩은 제작진 없이 이어하기를 묻는다', () => {
    const onContinue = vi.fn(() => true)
    띄우기({ endingIndex: 0, bonusGamePoint: 0, isContinuable: true, onContinue })

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByText(/이어하시겠습니까/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onContinue).toHaveBeenCalled()
  })

  it('G포인트가 모자라면 StrCOMMON[41] 을 띄우고 끝낸다', () => {
    const onFinish = vi.fn()
    띄우기({ endingIndex: 0, isContinuable: true, onContinue: () => false, onFinish })

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(screen.getByText(/부족합니다/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(onFinish).toHaveBeenCalled()
  })
})

describe('명예의 전당 등록 목록(상태 145) 머리띠 — 0x15d54 → 0x7f4ec, 칸은 0x16928 기본 갈래가 세운다', () => {
  const 그림들 = (container: HTMLElement) => [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
  const 등록목록까지 = () => {
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
  }
  const 명전 = (edition: '타자' | '투수', gamePoint?: number) => ({
    collection: EMPTY_COLLECTION,
    edition,
    nari: { 투수: null, 타자: { name: '홍길동', equippedAbility: [500, 500, 500, 500] as const } },
    onRegister: vi.fn(() => '등록' as const),
    ...(gamePoint === undefined ? {} : { gamePoint }),
  })

  it('타자편([this+0xcc] == 4)은 제목 8 "나만의리그"(game_frame 9) + "타자편"(10) + G포인트', () => {
    const { container } = 띄우기({ bonusGamePoint: 0, hallOfFame: 명전('타자', 42) })
    등록목록까지()

    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/009.png')
    expect(srcs).toContain('./sprites/game_frame/010.png')
    expect(srcs).not.toContain('./sprites/game_frame/003.png')
    expect(srcs).toContain('./sprites/gpoint/004.png')
    expect(srcs).toContain('./sprites/gpoint/002.png')
  })

  it('투수편(모드 3)은 제목 9 — 부제가 "투수편"(game_frame 11)', () => {
    const { container } = 띄우기({ bonusGamePoint: 0, hallOfFame: 명전('투수', 0) })
    등록목록까지()

    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/009.png')
    expect(srcs).toContain('./sprites/game_frame/011.png')
  })

  it('G 를 안 넘기면 예전 띠(제목 0, G 없음)', () => {
    const { container } = 띄우기({ bonusGamePoint: 0, hallOfFame: 명전('타자') })
    등록목록까지()
    expect(그림들(container).filter((src) => src.startsWith('./sprites/gpoint/'))).toHaveLength(0)
  })
})
