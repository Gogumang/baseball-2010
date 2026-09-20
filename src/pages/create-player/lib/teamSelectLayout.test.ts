import { describe, expect, it } from 'vitest'
import {
  ANCHOR_A, ANCHOR_B, GRID, NAME_BAR, OPEN_TEAM_COUNT, TAG, TEAM_COUNT,
  cellPositionOf, gridRowCountOf, isTeamOpen, teamNameFrameOf,
} from '@/pages/create-player/lib/teamSelectLayout'

/** 팀 고르기 배치 (상태 0x65 → 목록 0x63b15 의 k=0, 본문 0x63dee — P6 2a 확정) */

describe('기준점', () => {
  it('k=0 보정이 들어간 A·B 다 — (58,110) · (178,96)', () => {
    expect([ANCHOR_A.x, ANCHOR_A.y]).toEqual([58, 110])
    expect([ANCHOR_B.x, ANCHOR_B.y]).toEqual([178, 96])
  })

  it('딱지 막대는 기준점에서 (−28, −53), 글자는 −48 이다 (0x65744)', () => {
    expect([TAG.dx, TAG.dy, TAG.textDy]).toEqual([-28, -53, -48])
    expect([TAG.aTextFrame, TAG.bTextFrame]).toEqual([157, 159])
  })

  it('이름 막대는 slt_frame 9 (82×15) 을 (A.x−41, A.y+40) 에 둔다', () => {
    expect([NAME_BAR.frame, NAME_BAR.width, NAME_BAR.height]).toEqual([9, 82, 15])
    expect([ANCHOR_A.x + NAME_BAR.dx, ANCHOR_A.y + NAME_BAR.dy]).toEqual([17, 150])
  })

  it('팀 이름 글은 img_text 65 + 팀이다', () => {
    expect(teamNameFrameOf(0)).toBe(65)
    expect(teamNameFrameOf(14)).toBe(79)
  })
})

describe('팀 격자', () => {
  it('15팀 · 5열 · 칸 40px · 중심 (120, 182) 다', () => {
    expect(TEAM_COUNT).toBe(15)
    expect([GRID.columns, GRID.cell, GRID.centerX, GRID.centerY]).toEqual([5, 40, 120, 182])
    expect(gridRowCountOf(TEAM_COUNT)).toBe(3)
  })

  it('칸은 중심을 기준으로 펼쳐진다 — 첫 칸 (20, 122)', () => {
    expect(cellPositionOf(0)).toEqual({ x: 20, y: 122 })
    // 한 줄 아래 첫 칸은 40px 내려간다
    expect(cellPositionOf(5)).toEqual({ x: 20, y: 162 })
    expect(cellPositionOf(4).x).toBe(20 + 40 * 4)
  })
})

describe('히든 팀 잠금', () => {
  it('0~9 는 늘 열려 있다 (0x63e30 의 `idx ≤ 9`)', () => {
    expect(OPEN_TEAM_COUNT).toBe(10)
    for (let team = 0; team < OPEN_TEAM_COUNT; team += 1) {
      expect(isTeamOpen(team, [])).toBe(true)
    }
  })

  it('10~14 는 해금 기록이 있어야 열린다', () => {
    expect(isTeamOpen(12, [])).toBe(false)
    expect(isTeamOpen(12, [12])).toBe(true)
  })
})
