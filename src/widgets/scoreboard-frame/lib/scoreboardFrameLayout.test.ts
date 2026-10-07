import { describe, expect, it } from 'vitest'
import {
  SCOREBOARD_AT, SIDE_LABEL_FRAME, effectOpacityOf, introScoreboardEffectOf, namePlateOpacityOf, roundPlateRectsOf,
  scoreboardPlacementOf,
} from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

describe('점수판 틀 0x41440', () => {
  it('정산 (0, 80) — 박스 0·1 PLAYER/COM (팔레트 4) · 2·3 로고 · 4·5 이름 칸과 img_text 0x41 + 팀', () => {
    const at = SCOREBOARD_AT.settlement
    const placed = scoreboardPlacementOf(at.x, at.y, [{ team: 0, isComputer: false }, { team: 9, isComputer: true }])
    expect(placed.frame).toEqual({ x: 0, y: 80 })
    // 박스 0 (28, 21, 49, 15) + (0, 80) 에 157 (39×5) 가운데 · 박스 1 (162, 21, 49, 15) 에 158 (20×5)
    expect(placed.labels).toEqual([
      { frame: SIDE_LABEL_FRAME.player, x: 33, y: 106 },
      { frame: SIDE_LABEL_FRAME.computer, x: 176, y: 106 },
    ])
    // 박스 2 (22, 43, 66, 68) 에 77×76 · 박스 3 (153, 43, 66, 68) 에 76×76 — 그림 가운데(나머지 올림)
    expect(placed.logos).toEqual([{ team: 0, x: 16, y: 119 }, { team: 9, x: 148, y: 119 }])
    expect(placed.plates).toEqual([
      { x: 14, y: 200, width: 82, height: 15 },
      { x: 144, y: 199, width: 82, height: 15 },
    ])
    // 65 (65×10) · 74 (65×10) — 세로 (15 − 10) → 2 + 1
    expect(placed.names).toEqual([{ frame: 65, x: 22, y: 203 }, { frame: 74, x: 152, y: 202 }])
  })

  it('둥근 칠 둥글기 1 은 (w+1)×(h+1) 에서 모서리 넷을 뺀다', () => {
    expect(roundPlateRectsOf({ x: 14, y: 200, width: 82, height: 15 })).toEqual([
      { x: 15, y: 200, width: 81, height: 16 },
      { x: 14, y: 201, width: 83, height: 14 },
    ])
  })

  it('효과 1 · 인자 L — 그림 몫 L/16, 0 이면 안 그린다 · 인트로는 [+0x17e6] ≤ 14 부터', () => {
    expect(effectOpacityOf(null)).toBe(1)
    expect(effectOpacityOf(7)).toBe(7 / 16)
    expect(effectOpacityOf(0)).toBe(0)
    expect(introScoreboardEffectOf(15)).toBeNull()
    expect(introScoreboardEffectOf(13)).toBe(13)
  })

  it('이름 칸 알파 — 인트로만, 0·255 는 불투명', () => {
    expect(namePlateOpacityOf(null)).toBe(1)
    expect(namePlateOpacityOf(255)).toBe(1)
    expect(namePlateOpacityOf(195)).toBeCloseTo(195 / 255)
  })

  it('부르는 곳 — 정산 (0, 80) · 교대 (0, 0) · 경기 끝 (0, 3) · 인트로 (0, 90)', () => {
    expect(SCOREBOARD_AT).toEqual({
      settlement: { x: 0, y: 80 }, halfInning: { x: 0, y: 0 }, gameEnd: { x: 0, y: 3 }, intro: { x: 0, y: 90 },
    })
  })
})
