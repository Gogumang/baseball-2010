// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import {
  BAND_WINDOW, BATTER_EDITION_MODE, ENDING_IMAGE, IRIS, IRIS_STAGES, WALK_IN,
  endingImageXOf, endingWalkInAnimationOf, endingWalkInPaletteOf, irisDrawValueOf, irisRadiusOf,
} from '@/pages/ending/lib/endingLayout'

/**
 * 나만의리그 엔딩 (0x882b4 — P6 4b, 움직임 두 식은 S9 8절).
 * 띠 창 + ending.pzx 그림 두 조각(1px/틱) + 원형 전환 + 제작진 흐름.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof EndingScreen>[0]> = {}) =>
  render(
    <EndingScreen
      playerName="홍길동"
      endingIndex={9}
      bonusGamePoint={3000}
      isContinuable={false}
      onRegister={vi.fn(() => '등록' as const)}
      onContinue={vi.fn(() => true)}
      onFinish={vi.fn()}
      {...overrides}
    />,
  )

describe('엔딩 연출 배치', () => {
  it('띠 창은 mode_ui 프레임 10 박스 0 = (0, 65, 240, 72) 다', () => {
    const { container } = 띄우기()
    const 띠 = [...container.querySelectorAll('rect')]
      .find((rect) => rect.getAttribute('height') === String(BAND_WINDOW.height))

    expect(띠?.getAttribute('y')).toBe(String(BAND_WINDOW.y))
    expect(띠?.getAttribute('width')).toBe(String(BAND_WINDOW.width))
  })

  it('띠 안에 mode_back 배경을 (1, 66) 에 70 높이로 자른다 (0x7b9ad)', () => {
    const { container } = 띄우기()
    const 배경 = container.querySelector('img[src="./sprites/mode_back/frames/000.png"]')

    expect((배경?.parentElement as HTMLElement).style.top).toBe('66px')
    expect((배경?.parentElement as HTMLElement).style.height).toBe('70px')
  })

  it('엔딩 그림 두 조각은 ending 이미지 0 이고 가운데 47 · 위 64 를 목표로 미끄러진다', () => {
    const { container } = 띄우기()
    const 조각 = [...container.querySelectorAll('img[src="./sprites/ending/frames/000.png"]')]

    expect(조각).toHaveLength(2)
    expect(ENDING_IMAGE.x).toBe(47)
    expect(ENDING_IMAGE.y).toBe(64)
    for (const 그림 of 조각) {
      expect((그림 as HTMLElement).style.top).toBe(`${ENDING_IMAGE.y}px`)
    }
  })

  it('그림은 한 틱에 1px 씩 올라오고 0 에서 멈춘다 (S9 8-1)', () => {
    expect(endingImageXOf(0, 0)).toBe(ENDING_IMAGE.x + ENDING_IMAGE.startOffset)
    expect(endingImageXOf(1, 0)).toBe(ENDING_IMAGE.x + ENDING_IMAGE.startOffset + 1)
    expect(endingImageXOf(1000, 0)).toBe(ENDING_IMAGE.x)
    // [this+0x2f0] == 0 검사 — 두 번째 조각은 첫 조각이 0 에 닿은 뒤에 움직인다
    expect(endingImageXOf(1, 1)).toBe(ENDING_IMAGE.x + ENDING_IMAGE.startOffset)
  })
})

describe('원형 전환(아이리스) 반지름 — S9 8-2', () => {
  it('r = (D − D·k/100) + D·p/100 · k = t?110:90 · p = min(16t, 110)', () => {
    const D = IRIS.diameter

    expect(irisRadiusOf(0)).toBe(D - Math.trunc((D * 90) / 100))
    expect(irisRadiusOf(2)).toBe(D - Math.trunc((D * 110) / 100) + Math.trunc((D * 32) / 100))
  })

  it('D 는 240 − [this+0x2fc] 다 — 첫 단계 140(중심 −58·−55) · 뒤 단계 240 (S12 6절)', () => {
    expect(IRIS_STAGES.open).toEqual({ diameter: 140, dx: -58, dy: -55 })
    expect(IRIS_STAGES.reveal).toEqual({ diameter: 240, dx: 0, dy: 0 })
    expect(IRIS.diameter).toBe(140)
  })

  it('t = 0 은 0.10·D, t = 1 은 0.06·D 로 오히려 줄어든다 (원본 그대로)', () => {
    expect(irisRadiusOf(0)).toBe(14)
    expect(irisRadiusOf(1)).toBe(8)
    expect(irisRadiusOf(2)).toBe(30)
  })

  it('t ≥ 7 이면 p 가 110 에 걸려 r = D 가 된다', () => {
    expect(irisRadiusOf(IRIS.fullTick)).toBe(IRIS.diameter)
    expect(irisRadiusOf(100)).toBe(IRIS.diameter)
    // 뒤 단계 D = 240 이면 가운데에서 대각선 절반(200)을 넘어 화면을 다 덮는다
    expect(irisRadiusOf(IRIS.fullTick, IRIS_STAGES.reveal.diameter)).toBe(240)
  })

  it('원 그리기에 쓰는 값은 화면폭 − r 이다 ([this+0x2f8])', () => {
    expect(irisDrawValueOf(0)).toBe(240 - 14)
  })

  it('검정 판에 원을 뚫어 덮는다 (evenodd)', () => {
    const { container } = 띄우기()
    const 판 = container.querySelector('path[fill-rule="evenodd"]')

    expect(판?.getAttribute('fill')).toBe(IRIS.cover)
    expect(판?.getAttribute('d')).toContain(`M0,0H240V320H0Z`)
  })
})

describe('걸어 들어오는 그림 — S12 7절', () => {
  it('3틱에 1px 왼쪽으로 오고 8틱에 한 번 1px 튄다', () => {
    // 애니 x = 240 − n/3 − 20 · 아이콘 x = 240 − n/3 − 62
    expect(WALK_IN.xOf(0, WALK_IN.characterDx)).toBe(220)
    expect(WALK_IN.xOf(3, WALK_IN.characterDx)).toBe(219)
    expect(WALK_IN.xOf(0, WALK_IN.iconDx)).toBe(178)
    // y = (n & 7) ? 137 : 136 · 아이콘은 (n & 7) ? 61 : 60
    expect(WALK_IN.characterYOf(8)).toBe(136)
    expect(WALK_IN.characterYOf(9)).toBe(137)
    expect(WALK_IN.iconYOf(8)).toBe(60)
    expect(WALK_IN.iconYOf(9)).toBe(61)
  })

  it('애니 번호는 레코드 +0xb 가 고른다 — 타자 장타형만 8+2, 그 밖은 0+2 (0x63a5c)', () => {
    const 기본 = { mode: BATTER_EDITION_MODE, typeIndex: 0, handIndex: 0, skinIndex: 0 }

    expect(endingWalkInAnimationOf(기본)).toBe(2)
    // p[0xb]>>4 = 타입<<1 | 손 이라 우타든 좌타든 타입 1 이면 8 이다
    expect(endingWalkInAnimationOf({ ...기본, typeIndex: 1 })).toBe(10)
    expect(endingWalkInAnimationOf({ ...기본, typeIndex: 1, handIndex: 1 })).toBe(10)
    // 손만 좌면 >>4 값이 1 이라 조건(>1)에 못 미친다
    expect(endingWalkInAnimationOf({ ...기본, handIndex: 1 })).toBe(2)
    // 투수편(모드 3)은 조건에서 빠져 늘 2 다
    expect(endingWalkInAnimationOf({ ...기본, mode: 3, typeIndex: 2 })).toBe(2)
  })

  it('⚠️ 원본 그대로 — 엔딩 팔레트는 피부 1→0 · 2→1 · 그 밖(0 황인)→2 다 (0x63a92)', () => {
    const 기본 = { mode: BATTER_EDITION_MODE, typeIndex: 0, handIndex: 0, skinIndex: 0 }

    expect(endingWalkInPaletteOf({ ...기본, skinIndex: 1 })).toBe(0)
    expect(endingWalkInPaletteOf({ ...기본, skinIndex: 2 })).toBe(1)
    // 이벤트 초상화(0x63a50)는 피부 0 이면 mpl 을 안 쓰는데 엔딩만 팔레트 2 로 간다
    expect(endingWalkInPaletteOf(기본)).toBe(2)
  })

  it('고른 애니·팔레트 번호를 걸어 들어오는 그림에 얹는다', () => {
    const { container } = 띄우기({
      walkInLook: { mode: BATTER_EDITION_MODE, typeIndex: 1, handIndex: 0, skinIndex: 1 },
    })
    const walkIn = container.querySelector('div[data-animation]') as HTMLElement

    expect(walkIn.dataset.animation).toBe('10')
    expect(walkIn.dataset.palette).toBe('0')
  })

  it('그림은 event_char_0 애니와 mode_ui 프레임 87 이다', () => {
    expect(WALK_IN.characterFolder).toBe('./sprites/event_char_0/frames')
    expect(WALK_IN.characterAnimation).toBe(2)
    expect(WALK_IN.iconFolder).toBe('./sprites/mode_ui/frames')
    expect(WALK_IN.iconFrame).toBe(87)
  })
})

describe('엔딩 흐름', () => {
  it('엔딩 글은 StrENDING[결과] 이고 %s 에 선수 이름이 들어간다', () => {
    띄우기({ endingIndex: 9 })

    expect(screen.getByText(/홍길동/)).toBeTruthy()
  })

  it('확인하면 제작진 [21] 이 아래에서 위로 흐른다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(screen.getByText('-총괄/PM-')).toBeTruthy()
  })

  it('제작진 뒤에 엔딩 보너스 → 명예의 전당 등록을 묻는다', () => {
    const onRegister = vi.fn(() => '등록' as const)
    띄우기({ onRegister })

    fireEvent.click(screen.getByRole('button', { name: '확인' })) // 엔딩 글 → 제작진
    fireEvent.click(screen.getByRole('button', { name: '확인' })) // 제작진 → 보너스

    expect(screen.getByText(/3000 G포인트/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onRegister).toHaveBeenCalled()
    expect(screen.getByText(/등록이 완료되었습니다/)).toBeTruthy()
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
