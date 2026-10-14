import { describe, expect, it } from 'vitest'
import {
  changeFrameAt,
  cursorBoxOf,
  detailWindowFrameAt,
  movedListCursor,
  salaryTextOf,
  specialSwingTextOf,
  staminaLinesOf,
} from '@/pages/team-game/lib/substitutionWindow'

describe('교체 창 0x384b8 (에뮬레이션으로 받은 값)', () => {
  it('커서 상자 0x37dd4 — 틱 % 8 ≤ 3 이면 노란 안쪽, 아니면 빨간 바깥', () => {
    expect(cursorBoxOf(154, 0)).toMatchObject({ x: 36, y: 155, width: 169, height: 13, color: '#FFFF00' })
    expect(cursorBoxOf(154, 4)).toMatchObject({ x: 35, y: 154, width: 171, height: 15, color: '#FF0000', opacity: 1 })
  })

  it('목록은 세로로 감기고 보이는 6 줄 안으로 윗줄을 맞춘다 (0x6c4bd 꼴 0x330 · 0x6c2bd)', () => {
    expect(movedListCursor(0, 0, 7, -1)).toEqual({ cursor: 6, top: 1 })
    expect(movedListCursor(6, 1, 7, 1)).toEqual({ cursor: 0, top: 0 })
    expect(movedListCursor(2, 0, 3, 1)).toEqual({ cursor: 0, top: 0 })
  })

  it('체력 줄 0x571d8 — 용량 280 · 100% 면 길이 11, 90% 면 9 (emu: 38~49 · 38~47)', () => {
    expect(staminaLinesOf(280, 100)).toEqual({ length: 11, current: 11 })
    expect(staminaLinesOf(280, 90)).toEqual({ length: 11, current: 9 })
  })

  it('"CHANGE" 애니 0 — 프레임 41 · 42 · 43 을 4 그림씩 돌린다', () => {
    expect([0, 3, 4, 8, 12].map(changeFrameAt)).toEqual([41, 41, 42, 43, 41])
  })
})

describe('선수 정보 창 0x5b798', () => {
  it("'0' 로 열면 (202, 7) 에서 걸음을 두 배로 늘리며 왼쪽으로 자라 여섯째 그림에 (106, 106) 으로 선다 (0x5c8aa)", () => {
    expect([0, 1, 2, 3, 4, 5].map((draw) => detailWindowFrameAt(draw))).toEqual([
      { x: 202, width: 7, isOpen: false },
      { x: 200, width: 9, isOpen: false },
      { x: 196, width: 13, isOpen: false },
      { x: 188, width: 21, isOpen: false },
      { x: 172, width: 37, isOpen: false },
      { x: 140, width: 69, isOpen: false },
    ])
    expect(detailWindowFrameAt(6)).toEqual({ x: 106, width: 106, isOpen: true })
  })

  it('연봉 0x55cf4 — 9999 까지 그대로, 넘으면 억 (나머지는 세 자리 이상)', () => {
    expect(salaryTextOf(5000)).toBe('5000')
    expect(salaryTextOf(10000)).toBe('1억')
    expect(salaryTextOf(12000)).toBe('1억2000')
    expect(salaryTextOf(30500)).toBe('3억500')
    expect(salaryTextOf(30050)).toBe('3억050')
  })

  it('필살 이름 — StrCOMMON[0x18 + n], 장타형 n = 4 면 메테오 스윙', () => {
    expect(specialSwingTextOf(1, 0)).toBe('파워 스윙')
    expect(specialSwingTextOf(4, 0)).toBe('미라지 스윙')
    expect(specialSwingTextOf(4, 1)).toBe('메테오 스윙')
  })
})
