import { describe, expect, it } from 'vitest'
import {
  SEASON_CARD_BADGE, SEASON_CARD_BOARD, SEASON_CARD_FIGURE, SEASON_CARD_LOGO, initialSeasonCardFigure, seasonCardLogoPlaceOf,
  seasonCardLookOf, stepSeasonCardFigure, steppedBoardLeftEnd, steppedBoardLeftRow565, steppedBoardPointsOf,
} from '@/pages/season/lib/seasonPlayerCard'
import type { SeasonCardFigureState } from '@/pages/season/lib/seasonPlayerCard'

const run = (isBatter: boolean, form: number, lastTick: number) => {
  const states: SeasonCardFigureState[] = []
  let state = initialSeasonCardFigure(isBatter, form)
  for (let tick = 0; tick <= lastTick; tick += 1) {
    state = stepSeasonCardFigure(state, tick, isBatter)
    states.push(state)
  }
  return states
}

describe('시즌 선수 카드 0x7ba44 · 그림 0xae98', () => {
  it('계단형 판 0x7650c — 관리 화면 값(35, 190, 30)과 카드 값(0x67, 0x38, 0)', () => {
    expect(steppedBoardPointsOf(35, 190, 30).map(({ x, y }) => `${x},${y}`).join(' '))
      .toBe('0,54 141,54 160,35 240,35 240,206 160,206 141,225 0,225')
    expect(steppedBoardPointsOf(0x67, 0x38, 0).map(({ x, y }) => `${x},${y}`).join(' '))
      .toBe('0,122 111,122 130,103 240,103 240,140 130,140 111,159 0,159')
  })

  it('로고 (20, 72) 무게 12/16 · 타자 발 (57, 160) · 투수 이미지 (11, 18) 두 배', () => {
    expect([SEASON_CARD_LOGO.x, SEASON_CARD_LOGO.y, SEASON_CARD_LOGO.opacity]).toEqual([20, 72, 0.75])
    expect(SEASON_CARD_FIGURE.batter).toEqual({ x: 57, y: 160 })
    expect(SEASON_CARD_FIGURE.pitcherImage).toEqual({ x: 11, y: 18, scale: 2 })
  })

  it('그림 값 — 폼 +0xb >> 4 · 피부 bit2-3 · 니블 네 칸', () => {
    expect(seasonCardLookOf({ profile: 0x3c, equipment: [1, 2, 0, 3] }, 4))
      .toEqual({ form: 3, skin: 3, team: 4, equipment: [1, 2, 0, 3] })
  })

  it('0x45e8 타자 — 틱 30 에 준비(2) → 스윙(3) → 대기(5)', () => {
    const states = run(true, 0, 140)
    expect(states[29]?.animation.state).toBe(5)
    expect(states[30]?.animation.state).toBe(2)
    const swing = states.findIndex((state) => state.animation.state === 3)
    expect(swing).toBeGreaterThan(30)
    const back = states.findIndex((state, tick) => tick > swing && state.animation.state === 5)
    expect(back).toBeGreaterThan(swing)
    // 틱 140 (0x8c 의 배수) 에 다시 건다
    expect(states[140]?.animation.state).toBe(2)
  })

  it('0x45e8 투수 — 틱 30 에 투구(1), 단계 > 11 에서 다섯 번 머문 뒤 0', () => {
    const states = run(false, 0, 139)
    expect(states[29]?.animation.state).toBe(0)
    expect(states[30]?.animation.state).toBe(1)
    const rest = states.findIndex((state, tick) => tick > 30 && state.animation.state === 0)
    expect(rest).toBeGreaterThan(30)
    expect(states[rest]?.hold).toBe(0)
  })

  it('딱지 [gfx+0x168] — 판 A slt_frame 9 는 로고 아래 (17, 150), 판 B slt_frame 116 은 로고 위 (30, 57) (0x7bbe8~0x7bd8a)', () => {
    expect(SEASON_CARD_BADGE.name.board).toMatchObject({ image: 9, x: 17, y: 150, width: 82, height: 15 })
    expect(SEASON_CARD_BADGE.title.board).toMatchObject({ image: 116, x: 30, y: 57, width: 57, height: 15 })
    // 로고 (W/2 − 38 − 0x3e, H/2 − 38 − 0x32) = (20, 72) 77×76 의 바로 위 · 아래 (판 B 아래 끝 72 · 판 A 위 끝 150)
    expect(SEASON_CARD_BADGE.title.board.y + SEASON_CARD_BADGE.title.board.height).toBe(SEASON_CARD_LOGO.y)
    expect(SEASON_CARD_BADGE.name.board.y).toBe(SEASON_CARD_LOGO.y + SEASON_CARD_LOGO.height + 2)
    expect([SEASON_CARD_BADGE.name.ox, SEASON_CARD_BADGE.name.oy, SEASON_CARD_BADGE.name.palette]).toEqual([1, -1, 0])
    expect([SEASON_CARD_BADGE.title.frame, SEASON_CARD_BADGE.title.ox, SEASON_CARD_BADGE.title.oy, SEASON_CARD_BADGE.title.palette])
      .toEqual([157, 0, -1, 4])
  })
})

describe('카드 로고 합성의 아래 줄 (Q-03 r301)', () => {
  const colors = { edge: 1, highlight: 2, fill: 3 }
  const { top, height, offset } = SEASON_CARD_BOARD

  it('판 왼쪽 평평한 몫 — 위 테두리 T+19 · 밝은 줄 T+20 · 채움, 판 위는 null, 아래 테두리부터는 다룰 수 없다(undefined)', () => {
    expect(steppedBoardLeftRow565(top + 18, top, height, colors)).toBeNull()
    expect(steppedBoardLeftRow565(122, top, height, colors)).toBe(1)
    expect(steppedBoardLeftRow565(123, top, height, colors)).toBe(2)
    expect(steppedBoardLeftRow565(124, top, height, colors)).toBe(3)
    expect(steppedBoardLeftRow565(top + height - 1, top, height, colors)).toBe(3)
    expect(steppedBoardLeftRow565(top + height, top, height, colors)).toBeUndefined()
    expect(steppedBoardLeftEnd(offset)).toBe(110)
  })

  it('0x7ba9c 로고 자리는 실제 그림 크기로 가운데를 잡는다 — 77×76 은 (20, 72), 76×77 도 (20, 72), 73×33 은 (22, 94)', () => {
    expect(seasonCardLogoPlaceOf(77, 76)).toEqual({ x: SEASON_CARD_LOGO.x, y: SEASON_CARD_LOGO.y })
    expect(seasonCardLogoPlaceOf(76, 77)).toEqual({ x: 20, y: 72 })
    expect(seasonCardLogoPlaceOf(73, 33)).toEqual({ x: 22, y: 94 })
  })
})

