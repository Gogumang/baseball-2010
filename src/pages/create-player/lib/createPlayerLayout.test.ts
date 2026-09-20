import { describe, expect, it } from 'vitest'
import {
  CHOICES, INFO_CELLS, ROW_ORDER, choiceStepped, cursorRectOf, isCursorVisibleAt,
} from '@/pages/create-player/lib/createPlayerLayout'
import { DEFAULT_ROOKIE_PROFILE } from '@/entities/career/model/playerCareer'

/** 선수 등록 배치 (0x15f34 · C-6) — 커서 표가 원본 값과 같아야 한다 */

describe('선수 등록 커서 (0x16038)', () => {
  it('줄 순서는 이름 · 타입 · 포지션 · 손 · 피부 다 (줄 목록 [this+0x74], 0x17360)', () => {
    expect([...ROW_ORDER]).toEqual(['이름', '타입', '포지션', '손', '피부'])
  })

  it('커서 사각형이 C-6 표와 같다', () => {
    // 이름 (59,200,83,17) · 타입 (59,217,83,17) · 포지션 (175,183,34,17) · 손 (175,200,34,17) · 피부 (175,217,34,17)
    expect(cursorRectOf(0)).toEqual({ x: 59, y: 200, width: 83, height: 17 })
    expect(cursorRectOf(1)).toEqual({ x: 59, y: 217, width: 83, height: 17 })
    expect(cursorRectOf(2)).toEqual({ x: 175, y: 183, width: 34, height: 17 })
    expect(cursorRectOf(3)).toEqual({ x: 175, y: 200, width: 34, height: 17 })
    expect(cursorRectOf(4)).toEqual({ x: 175, y: 217, width: 34, height: 17 })
  })

  it('타이머 %10 == 0 일 때만 커서를 감춘다 (깜빡임)', () => {
    expect(isCursorVisibleAt(0)).toBe(false)
    expect(isCursorVisibleAt(1)).toBe(true)
    expect(isCursorVisibleAt(10)).toBe(false)
  })
})

describe('선수 등록 정보 칸 (0x7c450)', () => {
  it('칸 여덟은 1열 팀명·이름·타입·필살 / 2열 포지션·손·피부·타순 이다', () => {
    expect(INFO_CELLS.map((cell) => cell.id)).toEqual([
      '팀명', '이름', '타입', '필살', '포지션', '손', '피부', '타순',
    ])
  })

  it('팀명·필살·타순 칸에는 커서가 가지 않는다 (타순은 보여 주기만 하는 칸)', () => {
    const 커서없는칸 = INFO_CELLS.filter((cell) => cell.rowIndex === null).map((cell) => cell.id)
    expect(커서없는칸).toEqual(['팀명', '필살', '타순'])
  })
})

describe('선수 등록 선택지', () => {
  it('선택지는 원본 문자열 표 그대로다', () => {
    expect([...CHOICES.타입.options]).toEqual(['타격형', '장타형'])
    expect([...CHOICES.포지션.options]).toEqual(['내야', '외야'])
    expect([...CHOICES.손.options]).toEqual(['우타', '좌타'])
    expect([...CHOICES.피부.options]).toEqual(['황인', '백인', '흑인'])
  })

  it('값은 목록 끝에서 돈다', () => {
    const 좌타 = choiceStepped(DEFAULT_ROOKIE_PROFILE, '손', 1)
    expect(좌타.battingSide).toBe(1)
    expect(choiceStepped(좌타, '손', 1).battingSide).toBe(0)
    expect(choiceStepped(DEFAULT_ROOKIE_PROFILE, '피부', -1).skinIndex).toBe(2)
  })
})
