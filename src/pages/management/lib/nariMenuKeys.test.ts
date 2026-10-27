import { describe, expect, it } from 'vitest'
import { isNariMenuOkKey, nariMenuCursorAfterStep, nariMenuStepOfKey } from '@/pages/management/lib/nariMenuKeys'

describe('나리 관리 메뉴 키 — 숫자키 꼴 1 (0x6c031 · 표 0xd2e7c) · 꼴 0x330', () => {
  it("'2' · ↑ · '4' · ← 은 앞 칸, '8' · ↓ · '6' · → 은 다음 칸 — 한 줄 메뉴의 세로 감기가 열을 ±1 (0x200)", () => {
    expect(['ArrowLeft', 'ArrowUp', '4', '2'].map(nariMenuStepOfKey)).toEqual([-1, -1, -1, -1])
    expect(['ArrowRight', 'ArrowDown', '6', '8'].map(nariMenuStepOfKey)).toEqual([1, 1, 1, 1])
    expect(['Enter', '5', '0', '*', 'Escape'].map(nariMenuStepOfKey)).toEqual([0, 0, 0, 0, 0])
  })

  it("확인은 OK · '5'", () => {
    expect(isNariMenuOkKey('Enter')).toBe(true)
    expect(isNariMenuOkKey('5')).toBe(true)
    expect(isNariMenuOkKey('Escape')).toBe(false)
  })
})

describe('vt+8 0x6c445 — 켬 표 0 칸을 건너뛴다', () => {
  // 행동함: 트레이닝 · 휴식 · 외출(1 · 2 · 3) 이 꺼진다 (105 진입 0x11910)
  const acted = (index: number) => index >= 1 && index <= 3

  it('꺼진 칸이 없으면 한 칸씩 감아 돈다', () => {
    expect(nariMenuCursorAfterStep(5, 1, 6, () => false)).toBe(0)
    expect(nariMenuCursorAfterStep(0, -1, 6, () => false)).toBe(5)
    expect(nariMenuCursorAfterStep(2, 1, 6, () => false)).toBe(3)
  })

  it('행동한 뒤엔 선수정보 → 아이템, 아이템 → 선수정보 로 건너뛴다', () => {
    expect(nariMenuCursorAfterStep(0, 1, 6, acted)).toBe(4)
    expect(nariMenuCursorAfterStep(4, -1, 6, acted)).toBe(0)
    expect(nariMenuCursorAfterStep(5, 1, 6, acted)).toBe(0)
    expect(nariMenuCursorAfterStep(0, -1, 6, acted)).toBe(5)
  })

  it('켜진 칸이 하나뿐이면 그 칸에서 안 움직이고, 꺼진 칸에 서 있으면 켜진 칸으로 간다', () => {
    const onlyFirst = (index: number) => index !== 0
    expect(nariMenuCursorAfterStep(0, 1, 6, onlyFirst)).toBe(0)
    expect(nariMenuCursorAfterStep(3, 1, 6, onlyFirst)).toBe(0)
    expect(nariMenuCursorAfterStep(3, 1, 6, () => true)).toBe(3)
  })
})
