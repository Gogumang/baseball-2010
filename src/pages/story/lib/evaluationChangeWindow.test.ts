import { describe, expect, it } from 'vitest'
import { EVALUATION_CHANGE_BOXES, evaluationChangeWindowLayoutOf } from '@/pages/story/lib/evaluationChangeWindow'

const 목표 = { labelSet: 1 as const, current: [350, 10, 3, 20, 5], goals: [400, 50, 8, 60, 100] }

describe('경기 평가 변화 창 0x86c90 — mode_ui 프레임 84', () => {
  it('변화 ≠ 0 은 박스 4 줄마다 (x + 1, y + 2) 에 애니 1(▲) · 2(▼), 0 은 흰 막대 (x + 1, y + h/2, w/2 − 4, 2)', () => {
    const layout = evaluationChangeWindowLayoutOf({ changes: [5, 0, -3], currents: [60, 1200, 300] }, 목표)
    const { change } = EVALUATION_CHANGE_BOXES
    expect(layout.arrows).toEqual([
      { animation: 1, x: change.x + 1, y: change.y + 2 },
      { animation: 2, x: change.x + 1, y: change.y + 2 * (change.height + 2) + 2 },
    ])
    expect(layout.dashes).toEqual([{ x: 148, y: 83 + 17 + 7, width: 12, height: 2 }])
  })

  it('제목 줄 오른쪽 "N년 G/45경기" 사각형은 박스 1 을 w × 3 − 8 로 늘린 것 (0x86d72~0x86d98)', () => {
    const layout = evaluationChangeWindowLayoutOf({ changes: [0, 0, 0], currents: [0, 0, 0] }, 목표)
    expect(layout.messageBox).toEqual({ x: 37, y: 57, width: 178, height: 11 })
  })

  it('이름 줄은 박스 2 오른쪽 정렬 ox −4, 아래 표는 0x8656c(박스 7 · 5 · 6) — 이름 다섯 · "현재" · "목표"', () => {
    const layout = evaluationChangeWindowLayoutOf({ changes: [0, 0, 0], currents: [0, 0, 0] }, 목표)
    const 사기 = layout.texts.find((piece) => piece.frame === 84)!
    // 박스 2 (42, 83, 35, 15) — 오른쪽 끝 77 − 폭 20 − 4
    expect(사기).toMatchObject({ x: 53, y: 86 })
    const 머리 = layout.texts.filter((piece) => piece.frame === 87 || piece.frame === 148).map((piece) => piece.y)
    expect(머리).toEqual([143, 143])
  })
})
