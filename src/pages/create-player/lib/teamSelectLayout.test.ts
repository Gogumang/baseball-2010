import { describe, expect, it } from 'vitest'
import {
  ABILITY_AXIS_ANGLES, ABILITY_AXIS_MAXIMUM, ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, NAME_BAR,
  OPEN_TEAM_COUNT, TAG, TEAM_COUNT, abilityAxisLengthOf, abilityAxisMaximumLengthOf,
  abilityChartOutlineOf, abilityChartVerticesOf, cellPositionOf, gridRowCountOf, isTeamOpen,
  teamNameFrameOf,
} from '@/pages/create-player/lib/teamSelectLayout'

/** 팀 고르기 배치 (상태 0x65 → 목록 0x63b15 의 k=0, 본문 0x63dee — P6 2a 확정) */

describe('기준점', () => {
  it('k=0 보정이 들어간 A·B 다 — (58,110) · (178,96)', () => {
    expect([ANCHOR_A.x, ANCHOR_A.y]).toEqual([58, 110])
    expect([ANCHOR_B.x, ANCHOR_B.y]).toEqual([178, 96])
  })

  it('A 딱지는 흰 막대(이미지 116) 를 (−28, −53), 글자는 −48 이다 (0x65744)', () => {
    expect([TAG.aBarImage, TAG.dx, TAG.aDy, TAG.aTextDy]).toEqual([116, -28, -53, -48])
    expect([TAG.aTextFrame, TAG.bTextFrame]).toEqual([157, 159])
  })

  it('B 딱지는 **파란 막대(이미지 117)** 이고 y 보정도 −43 으로 다르다 — k 3~5 만 116·53 이다', () => {
    expect(TAG.bBarImage).toBe(117)
    expect(TAG.bDy).toBe(-43)
    expect(TAG.bTextDy).toBe(TAG.bDy + 5)
  })

  it('이름 막대는 slt_frame **이미지** 9 (82×15) 을 (A.x−41, A.y+40) 에 둔다', () => {
    // ⚠️ 같은 번호가 frames 폴더에도 있지만 그건 72×17(탭 커서)이라 다른 그림이다
    expect([NAME_BAR.image, NAME_BAR.width, NAME_BAR.height]).toEqual([9, 82, 15])
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
    expect([GRID.columns, GRID.cell, GRID.centerX, GRID.top]).toEqual([5, 40, 120, 182])
    expect(gridRowCountOf(TEAM_COUNT)).toBe(3)
  })

  /**
   * ⚠️ 예전에는 세로도 중심으로 읽어 첫 칸이 (20, 122) 였다 — 격자가 60px 올라가
   * 팀 로고(72~148)와 이름 막대(150~165)를 덮고 있었다. 원본은 **cy 가 첫 줄 위쪽**이다
   * (S9 10절 정정 1). 182 로 내려오면 이름 막대 아래끝 165 밑이라 겹치지 않는다.
   */
  it('가로만 가운데를 맞추고 **세로는 cy 를 그대로** 쓴다 — 첫 칸 (20, 179)', () => {
    // 첫 열의 y 보정은 3 이라 182 − 3 = 179
    expect(cellPositionOf(0)).toEqual({ x: 20, y: 179 })
    // 한 줄 아래 첫 칸은 40px 내려간다
    expect(cellPositionOf(5)).toEqual({ x: 20, y: 219 })
    expect(cellPositionOf(4).x).toBe(20 + 40 * 4)
  })

  it('5열 화면의 **열별 y 보정** [3,3,3,13,13] 을 받는다 — 4·5열이 10px 더 올라간다 (S9 4-3)', () => {
    expect(cellPositionOf(3).y).toBe(cellPositionOf(0).y - 10)
    expect(cellPositionOf(4).y).toBe(cellPositionOf(0).y - 10)
    expect(cellPositionOf(2).y).toBe(cellPositionOf(0).y)
  })
})

/**
 * 능력치 마름모 — 0x5aefd 종류 0 · 꼭짓점 길이 0x75ebc (이번에 디스어셈으로 풀었다).
 * 호출이 넘기는 반지름은 두 갈래(열린 팀 0x63e64 · 잠긴 팀 0x63f22) 모두 `movs r3,#0x1e` = 30 이다.
 */
describe('능력치 마름모', () => {
  const 중심 = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  /** 서울 드래곤즈 TEAM_DATA 의 네 능력치 (레코드 +4·+6·+8·+0xa) */
  const 드래곤즈 = [365, 440, 430, 365]

  it('4축은 표 0xd1b0c 의 225·315·45·135° 네 대각선이다 — 위·오른쪽·아래·왼쪽이 아니다', () => {
    expect(ABILITY_AXIS_ANGLES).toEqual([225, 315, 45, 135])
    expect([ABILITY_CHART.radius, ABILITY_AXIS_MAXIMUM]).toEqual([30, 999])
  })

  it('최대길이 = 반지름 × 축 최대치 / 999 라 999 축에서는 반지름 그대로다 (0x75f30)', () => {
    expect(abilityAxisMaximumLengthOf(30)).toBe(30)
  })

  it('현재길이 = 최대길이 × 값 / 999 이고 정수 나눗셈이라 버린다 (0x75f96)', () => {
    expect(드래곤즈.map((value) => abilityAxisLengthOf(value, 30))).toEqual([10, 13, 12, 10])
    expect(abilityAxisLengthOf(999, 30)).toBe(30)
    expect(abilityAxisLengthOf(0, 30)).toBe(0)
  })

  it('꼭짓점 = 중심 + (길이 × cos·sin) >> 16 — ×65535 표(0xd2eec)와 산술 시프트다', () => {
    expect(abilityChartVerticesOf(중심, 드래곤즈)).toEqual([
      { x: 170, y: 96 },  // 225° 왼위
      { x: 187, y: 94 },  // 315° 오른위
      { x: 186, y: 112 }, // 45°  오른아래
      { x: 170, y: 111 }, // 135° 왼아래
    ])
  })

  it('바깥 마름모는 네 축 모두 최대길이로 뻗는다 — 값 마름모가 그 안에 들어간다', () => {
    expect(abilityChartOutlineOf(중심)).toEqual([
      { x: 156, y: 82 }, { x: 199, y: 82 }, { x: 199, y: 125 }, { x: 156, y: 125 },
    ])
  })

  it('잠긴 팀(idx −1)은 원본도 네 값을 0 으로 채워 꼭짓점이 중심에 모인다 (0x5b008)', () => {
    expect(abilityChartVerticesOf(중심, [])).toEqual([중심, 중심, 중심, 중심])
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
