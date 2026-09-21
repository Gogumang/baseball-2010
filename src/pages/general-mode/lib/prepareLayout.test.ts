import { describe, expect, it } from 'vitest'
import { ACE_LAYOUT, aceCellPositionOf } from '@/pages/general-mode/lib/prepareLayout'

/** 일반모드 준비 화면 배치 (공용 목록 페이지 0x63b15 — P6 2a) */

describe('마선수 격자 세로 기준 (S9 10절 정정 1)', () => {
  it('cy 는 **첫 줄 위쪽** 이다 — PITCHER 딱지(175) 바로 아래에 첫 줄이 온다', () => {
    const 첫줄 = aceCellPositionOf(0).y

    // 첫 열 보정 3 → 190 − 3 = 187
    expect(첫줄).toBe(187)
    // 예전에는 세로도 중심으로 읽어 첫 줄이 150 이라 PITCHER 딱지가 칸 한복판을 뚫었다
    expect(ACE_LAYOUT.rowTags[0].panel.y).toBeLessThan(첫줄)
  })

  /**
   * ⚠️ 세로 틈(vGap)은 원본 인자에 값이 없다 — 지금은 0 이라 둘째 줄이 227 에서 시작해
   * BATTER 딱지(233)보다 위에 온다. 딱지에서 역산하면 틈이 18 쯤으로 보이지만 **근거가 없어**
   * 단정하지 않는다. 값이 밝혀지면 여기부터 고치면 된다.
   */
  it('둘째 줄은 칸 높이만큼 내려간다 (세로 틈은 아직 0 — 근거 없음)', () => {
    expect(aceCellPositionOf(5).y).toBe(aceCellPositionOf(0).y + ACE_LAYOUT.grid.cell)
  })
})
