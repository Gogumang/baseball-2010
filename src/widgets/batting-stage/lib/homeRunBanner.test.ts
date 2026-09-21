import { describe, expect, it } from 'vitest'
import {
  HOME_RUN_FLASH_CYCLE_TICKS,
  HOME_RUN_FLY_IN_END_TICK,
  HOME_RUN_HOLD_START_TICK,
  HOME_RUN_LETTER_IMAGES,
  HOME_RUN_LETTER_WIDTHS,
  homeRunBurstFrameAt,
  homeRunLettersAt,
  homeRunPhaseAt,
  homeRunSlotAt,
} from '@/widgets/batting-stage/lib/homeRunBanner'

/** 화면 240×320 기준 (STAGE_WIDTH · STAGE_HEIGHT) */
const BASE_Y = 320 / 2 - 25

describe('글자 그림 — game_effect 이미지 54~60 (R2 3-2)', () => {
  it('H O M E R U N 일곱 장이고 폭은 27,27,30,24,27,27,27 이다', () => {
    expect(HOME_RUN_LETTER_IMAGES).toEqual([54, 55, 56, 57, 58, 59, 60])
    expect(HOME_RUN_LETTER_WIDTHS).toEqual([27, 27, 30, 24, 27, 27, 27])
  })
})

describe('단계 0 — 날아 들어오기 (2틱마다 칸 −1)', () => {
  it('칸은 5+i 로 시작해 2틱마다 1씩 줄고 0 에서 멈춘다', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => homeRunSlotAt(i, 0))).toEqual([5, 6, 7, 8, 9, 10, 11])
    expect(homeRunSlotAt(0, 1)).toBe(5)
    expect(homeRunSlotAt(0, 2)).toBe(4)
    // 첫 글자 H 는 10틱에, 마지막 N 은 22틱에 칸 0 에 닿는다
    expect(homeRunSlotAt(0, 10)).toBe(0)
    expect(homeRunSlotAt(0, 99)).toBe(0)
    expect(homeRunSlotAt(6, 21)).toBe(1)
    expect(homeRunSlotAt(6, 22)).toBe(0)
    expect(HOME_RUN_FLY_IN_END_TICK).toBe(22)
  })

  it('칸이 5 보다 크면 안 그려서 글자가 2틱 간격으로 하나씩 나온다', () => {
    expect(homeRunLettersAt(0).map((letter) => letter.index)).toEqual([0])
    expect(homeRunLettersAt(1).map((letter) => letter.index)).toEqual([0])
    expect(homeRunLettersAt(2).map((letter) => letter.index)).toEqual([0, 1])
    expect(homeRunLettersAt(12).map((letter) => letter.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('칸 5·4·3 은 2배로 아래에서 올라오고, 칸 1 은 +200 흰 번쩍이다', () => {
    const [head] = homeRunLettersAt(0)
    expect(head).toMatchObject({ index: 0, y: 320, scale: 2, brighten: 0 })
    // 칸 4 (2틱) → 화면 3/4 − 25, 칸 3 (4틱) → 제자리, 칸 2 (6틱) → 원래 크기
    expect(homeRunLettersAt(2)[0]).toMatchObject({ y: 215, scale: 2 })
    expect(homeRunLettersAt(4)[0]).toMatchObject({ y: BASE_Y, scale: 2 })
    expect(homeRunLettersAt(6)[0]).toMatchObject({ y: BASE_Y, scale: 1, brighten: 0 })
    expect(homeRunLettersAt(8)[0]).toMatchObject({ y: BASE_Y, scale: 1, brighten: 200 })
    expect(homeRunLettersAt(10)[0]).toMatchObject({ y: BASE_Y, scale: 1, brighten: 0 })
  })

  it('글자 사이는 w−3 이고 시작 x 는 scrW/2 − 84 다', () => {
    expect(homeRunLettersAt(12).map((letter) => letter.x)).toEqual([36, 60, 84, 111, 132, 156, 180])
  })
})

describe('단계 전이 — 0 → 1·2·3 (2틱씩) → 4 유지', () => {
  it('22틱에 단계 1 로 넘어가고 28틱부터 유지다', () => {
    expect([0, 10, 21].map(homeRunPhaseAt)).toEqual([0, 0, 0])
    expect([22, 23, 24, 25, 26, 27, 28, 200].map(homeRunPhaseAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect(HOME_RUN_HOLD_START_TICK).toBe(28)
  })

  it('단계 1·2·3 만 가운데에 game_effect 프레임 18·19·20 을 겹친다', () => {
    expect([0, 21].map(homeRunBurstFrameAt)).toEqual([null, null])
    expect([22, 24, 26].map(homeRunBurstFrameAt)).toEqual([18, 19, 20])
    expect(homeRunBurstFrameAt(28)).toBeNull()
  })

  it('단계 1 은 앞 셋 x+3 · 뒤 셋 x−3, 가운데 E 는 제자리다', () => {
    const letters = homeRunLettersAt(22)
    expect(letters.map((letter) => letter.x)).toEqual([39, 63, 87, 111, 129, 153, 177])
    expect(letters.every((letter) => letter.y === BASE_Y)).toBe(true)
  })

  it('단계 2·3 은 좌우로 5px 벌리고 y 를 i 만큼 엇갈리게 민다', () => {
    const second = homeRunLettersAt(24)
    expect(second.map((letter) => letter.x)).toEqual([31, 55, 79, 111, 137, 161, 185])
    expect(second.map((letter) => letter.y - BASE_Y)).toEqual([3, 2, 1, 0, 1, 2, 3])
    const third = homeRunLettersAt(26)
    expect(third.map((letter) => letter.x)).toEqual(second.map((letter) => letter.x))
    expect(third.map((letter) => letter.y - BASE_Y)).toEqual([-3, -2, -1, 0, -1, -2, -3])
  })
})

describe('단계 4 — 14틱 주기 반짝임', () => {
  it('글자 사이를 w−1 로 좁혀 다시 가운데 정렬한다', () => {
    expect(homeRunLettersAt(28).map((letter) => letter.x)).toEqual([29, 55, 81, 110, 133, 159, 185])
  })

  it('2틱마다 한 글자씩 왼쪽에서 오른쪽으로 5px 올려 +140 밝힌다', () => {
    const flashingAt = (tick: number) =>
      homeRunLettersAt(tick).findIndex((letter) => letter.brighten > 0)
    expect([28, 29, 30, 32, 34, 36, 38, 40].map(flashingAt)).toEqual([0, 0, 1, 2, 3, 4, 5, 6])
    // 한 바퀴(14틱) 돌면 다시 첫 글자
    expect(flashingAt(28 + HOME_RUN_FLASH_CYCLE_TICKS)).toBe(0)

    const lit = homeRunLettersAt(28).find((letter) => letter.brighten > 0)
    expect(lit).toMatchObject({ index: 0, y: BASE_Y - 5, brighten: 140, scale: 1 })
    expect(homeRunLettersAt(28)[1]).toMatchObject({ y: BASE_Y, brighten: 0 })
  })
})
