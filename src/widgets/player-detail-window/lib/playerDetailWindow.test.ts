import { describe, expect, it } from 'vitest'
import {
  ENTRY_DETAIL_ORIGIN,
  SUBSTITUTION_DETAIL_ORIGIN,
  detailRadarCenterOf,
  detailWindowFrameAt,
  playerDetailOf,
} from '@/widgets/player-detail-window/lib/playerDetailWindow'

describe('선수 정보 창 0x5b798 — 창 자리', () => {
  it("엔트리 '0' 0x55920 은 (212, 64) 에서 열려 x = 212 − 0x60 = 116 에 멈춘다 (0x5c8aa)", () => {
    expect(ENTRY_DETAIL_ORIGIN).toEqual({ startX: 212, y: 64 })
    expect(detailWindowFrameAt(0, ENTRY_DETAIL_ORIGIN)).toEqual({ x: 212, width: 7, isOpen: false })
    expect(detailWindowFrameAt(6, ENTRY_DETAIL_ORIGIN)).toEqual({ x: 116, width: 106, isOpen: true })
  })

  it('도형 가운데 = (창 x + 53, 창 y + 101 − 16 · − 6) — unicorn 0x5aefc 인자 (169, 149) · (169, 159) · (159, 144)', () => {
    expect(detailRadarCenterOf(ENTRY_DETAIL_ORIGIN, true)).toEqual({ x: 169, y: 149 })
    expect(detailRadarCenterOf(ENTRY_DETAIL_ORIGIN, false)).toEqual({ x: 169, y: 159 })
    expect(detailRadarCenterOf(SUBSTITUTION_DETAIL_ORIGIN, true)).toEqual({ x: 159, y: 144 })
  })
})

describe('선수 정보 창 값', () => {
  it('타자 — 타입 +0xb >> 5 · 손 비트 4 · 필살 +0x18 · 연봉 +0x1b × 1000', () => {
    const detail = playerDetailOf({
      isPitcher: false,
      abilities: [1, 2, 3, 4],
      aceIndex: -1,
      profile: 0x30,
      skillBits: 0,
      specialNumber: 4,
      grade: 12,
    })
    expect(detail.values.map((value) => value.text)).toEqual(['장타형', '좌타', '-', '메테오 스윙', '1억2000'])
  })

  it('마선수는 등급을 몰라도 XlsACE 행 +0x1b 로 연봉을 낸다 — 싸이커 50 · 크라이져 50 (5c87c 육성 아님 갈래)', () => {
    const salaryOf = (isPitcher: boolean, aceIndex: number) =>
      playerDetailOf({ isPitcher, abilities: [1, 2, 3, 4], aceIndex, profile: 0, skillBits: 0, grade: null }).values.at(-1)?.text
    expect(salaryOf(true, 0)).toBe('5억')
    expect(salaryOf(true, 4)).toBe('1억')
    expect(salaryOf(false, 3)).toBe('5억')
  })
})
