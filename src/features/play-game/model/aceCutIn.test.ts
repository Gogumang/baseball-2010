import { describe, expect, it } from 'vitest'
import {
  ACE_CUT_IN_DRAWS,
  aceCutInDraws,
  aceCutInPortraitOf,
  aceCutInSlotOf,
  linePixels,
  scanlineSpans,
} from '@/features/play-game/model/aceCutIn'
import { SUBSTITUTION_SCENE_DRAWS } from '@/features/play-game/model/substitutionScene'

describe('마선수 등장 컷인 0x473f0 — 단계 기계 (표 0xd0130 · 0xd0148 · 0xd0190)', () => {
  const draws = aceCutInDraws()

  it('그림 0 은 단계 −1(초상 적재), 그림 1~5 는 단계 0 에서 배너가 미끄러져 들어온다 — r = 80 · 119 · 116 · 104 · 56 · −4', () => {
    expect(draws.map((draw) => draw.stage).slice(0, 10)).toEqual([-1, 0, 0, 0, 0, 0, 1, 2, 3, 4])
    // 배너 둘째 점 x = cx + r + 14
    expect(draws.slice(0, 7).map((draw) => draw.banner.points[1].x - 120 - 14)).toEqual([80, 119, 116, 104, 56, -4, 0])
    // 속도선은 단계 −1 에서 안 그리고, 그 뒤 프레임 85 + 단계 mod 5
    expect(draws[0].speedLines).toBeNull()
    expect(draws.slice(1, 10).map((draw) => draw.speedLines?.frame)).toEqual([85, 85, 85, 85, 85, 86, 87, 88, 89])
  })

  it('27 번째 그림이 단계 22 를 보고 메시지 13 을 보낸다 — "CHANGE" 17 그림보다 열 그림 길다', () => {
    expect(ACE_CUT_IN_DRAWS).toBe(27)
    expect(SUBSTITUTION_SCENE_DRAWS).toBe(17)
    expect(draws[26]).toMatchObject({ stage: 22, ends: true })
    expect(draws.slice(0, 26).every((draw) => !draw.ends)).toBe(true)
  })

  it('단계가 4 를 넘은 그림부터 흰 사선 이미지 96 · 95 · 쓸기 · 초상 · 이미지 93 이 선다', () => {
    expect(draws.slice(0, 9).every((draw) => draw.streaks.length === 0 && draw.portrait === null && draw.label === null)).toBe(true)
    expect(draws[9].streaks).toEqual([
      { image: 96, x: 125, y: 121 },
      { image: 95, x: 16, y: 172 },
    ])
    // 쓸기 알파: 단계 5~9 = 단계·10 + 50, 10~13 = 0x8c, 14~18 = 210 − 단계·5, 19~22 없음
    expect(draws.slice(9).map((draw) => draw.sweep?.fill.alpha ?? null)).toEqual([
      100, 110, 120, 130, 140, 140, 140, 140, 140, 140, 135, 130, 125, 120, null, null, null, null,
    ])
    // 초상 x: 단계 6 · 7 은 W − 단계·5 + 25, 그 뒤 W − 폭/2 − 5
    expect(draws[9].portrait).toEqual({ x: 235, y: 173 })
    expect(draws[10].portrait).toEqual({ x: 230, y: 173 })
    expect(draws[11].portrait).toEqual({ x: 'centered', y: 173 })
    // 이미지 93: 0 → 61 → 80(+200 밝게 ×3) → 71
    expect(draws.slice(9, 16).map((draw) => [draw.label?.x, draw.label?.brighten])).toEqual([
      [0, 0], [61, 0], [80, 200], [80, 200], [80, 200], [71, 0], [71, 0],
    ])
  })

  it('배너 아래 검정 선은 윗변 셋 · 아랫변 셋을 y + 1 에 긋는다 (476a4 고리)', () => {
    const lines = draws[6].bannerShadows
    expect(lines).toHaveLength(6)
    expect(lines[0]).toMatchObject({ from: { x: 0, y: 147 }, to: { x: 134, y: 147 } })
    expect(lines[1]).toMatchObject({ from: { x: 0, y: 201 }, to: { x: 80, y: 201 } })
  })

  it('컷인 번호 — 투수 0~4 · 타자 +5, 초상은 표 0xd0108 의 인물 애니 (event_char_1 · _2)', () => {
    expect(aceCutInSlotOf('투수', 1)).toBe(1)
    expect(aceCutInSlotOf('타자', 0)).toBe(5)
    // 레오니 = 인물 11 → event_char_1 애니 7 · 메디카 = 10 → 애니 0 · 싸이커 = 17 → event_char_2 애니 40
    expect(aceCutInPortraitOf(1)).toEqual({ folder: './sprites/event_char_1/frames', animation: 7 })
    expect(aceCutInPortraitOf(5)).toEqual({ folder: './sprites/event_char_1/frames', animation: 0 })
    expect(aceCutInPortraitOf(0)).toEqual({ folder: './sprites/event_char_2/frames', animation: 40 })
  })
})

describe('그리기 바탕 — 0x75c70 스캔라인 · 선', () => {
  it('최소 y 부터 최대 y 앞까지, 둘씩 짝지은 가로선 (양 끝 포함)', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]
    // y = 0 은 (yi < y) 를 만족하는 변이 없어 비고, y = 1 · 2 만 [0, 4]
    expect(scanlineSpans(square)).toEqual([
      { y: 1, x0: 0, x1: 4 },
      { y: 2, x0: 0, x1: 4 },
    ])
  })

  it('가로선은 양 끝을 포함한다', () => {
    expect(linePixels({ x: 2, y: 5 }, { x: 5, y: 5 })).toEqual([
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ])
  })
})
