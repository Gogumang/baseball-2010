import { describe, expect, it } from 'vitest'
import {
  ballCounterGlyphsOf, bestDistanceGlyphsOf, comboDisplayPlacementOf, totalDistanceGlyphsOf, DISTANCE_BOARD, distanceBoardGlyphsOf } from '@/pages/home-run-derby/lib/derbyHudLayout'

describe('콤보 표시 배치 (0x4585c)', () => {
  it('좌타는 trainning 애니 1(칸 3·4·5·6)을 (0, H/2) 에 그리고, 끝 칸 전에는 숫자가 없다', () => {
    expect(comboDisplayPlacementOf(2, 1, 0)).toEqual({ frame: 3, left: -38, top: 160, digits: [] })
    expect(comboDisplayPlacementOf(2, 1, 1).frame).toBe(4)
    expect(comboDisplayPlacementOf(2, 1, 2)).toMatchObject({ frame: 5, digits: [] })
  })

  it('차례 3 부터 끝 칸 "Combo" 에 머물고 숫자(num 70 + 자리)를 (20, H/2 − 30) 에 붙인다', () => {
    const placed = comboDisplayPlacementOf(3, 1, 3)
    expect(placed).toMatchObject({ frame: 6, left: 0, top: 160 })
    expect(placed.digits).toEqual([{ frame: 73, left: 20, top: 130 }])
    expect(comboDisplayPlacementOf(3, 1, 20).frame).toBe(6)
  })

  it('우타는 애니 2(칸 7·8·9·10)를 (W, H/2) 에, 숫자는 W − 40 부터 그린다', () => {
    expect(comboDisplayPlacementOf(2, 0, 0)).toEqual({ frame: 7, left: 150, top: 160, digits: [] })
    const placed = comboDisplayPlacementOf(12, 0, 5)
    expect(placed).toMatchObject({ frame: 10, left: 177, top: 160 })
    // 1(22×35) 다음 2(29×35) — 전진 = 그림 폭, 높이가 같아 둘 다 y 130
    expect(placed.digits).toEqual([
      { frame: 71, left: 200, top: 130 },
      { frame: 72, left: 222, top: 130 },
    ])
  })

  it('높이가 다른 글자는 가장 큰 글자에 맞춰 아래를 가지런히 한다 (0xba628)', () => {
    // 7(31×34) · 0(32×36)
    expect(comboDisplayPlacementOf(70, 1, 3).digits).toEqual([
      { frame: 77, left: 20, top: 132 },
      { frame: 70, left: 51, top: 130 },
    ])
  })
})

const n = (image: number) => `./sprites/num/${String(image).padStart(3, '0')}.png`

describe('HUD 본문 배치 (0x45a54)', () => {
  it('공 번호는 "/"(x0 + 0x38 = 207, y 10) 왼쪽 1px 에 오른끝, 공 수는 "/" 폭 10 + 1 뒤부터 (0x3608c)', () => {
    expect(ballCounterGlyphsOf(3, 10)).toEqual([
      { src: n(3), left: 198, top: 10 },
      { src: n(101), left: 207, top: 10 },
      { src: n(1), left: 218, top: 10 },
      { src: n(0), left: 223, top: 10 },
    ])
  })

  it('두 자리 공 번호는 폭을 셀 때 간격을 빼먹어 1px 오른쪽으로 밀린다 (0x585ad 원본 그대로)', () => {
    // "11": 셈 폭 4 + 4 = 8 → 시작 206 − 8 = 198, 그리기는 4 + 1 씩 → 198 · 203 (끝 207 = "/" 자리)
    expect(ballCounterGlyphsOf(11, 12).slice(0, 2)).toEqual([
      { src: n(1), left: 198, top: 10 },
      { src: n(1), left: 203, top: 10 },
    ])
  })

  it('최고·현재 칸은 판 상자 (151+32, 6+19 / 6+35, 35×10) 안 오른쪽 맞춤, 자간 0 (0xba51c 정렬 4)', () => {
    // 상자 오른끝 151 + 32 + 35 = 218. "120" = 4 + 8 + 8 = 20 → 198
    expect(bestDistanceGlyphsOf(120, 0)).toEqual([
      { src: n(1), left: 198, top: 25 },
      { src: n(2), left: 202, top: 25 },
      { src: n(0), left: 210, top: 25 },
    ])
    expect(totalDistanceGlyphsOf(0)).toEqual([{ src: n(80), left: 210, top: 41 }])
  })

  it('누적이 최고를 넘을 때만 최고 칸이 노랑이다 (같으면 흰색)', () => {
    expect(bestDistanceGlyphsOf(300, 301)[0].src).toBe(n(83))
    expect(bestDistanceGlyphsOf(300, 300)[0].src).toBe(n(3))
  })
})

describe('비거리 판 0x36cd4 — trainning 프레임 11 을 (W/2 − 20, 10) 에, 숫자는 덮어쓴 상자 (100, 14, 24, 11) 오른쪽 맞춤', () => {
  it('판 자리', () => {
    expect([DISTANCE_BOARD.x, DISTANCE_BOARD.y]).toEqual([100, 10])
  })

  it('흰 숫자(num 0~9)를 상자 오른끝 124 에 맞춘다 — "1" 만 폭 4', () => {
    expect(distanceBoardGlyphsOf(123)).toEqual([
      { src: './sprites/num/001.png', left: 124 - 20, top: 14 },
      { src: './sprites/num/002.png', left: 124 - 16, top: 14 },
      { src: './sprites/num/003.png', left: 124 - 8, top: 14 },
    ])
  })
})
