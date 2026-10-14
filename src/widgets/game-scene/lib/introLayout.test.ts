import { describe, expect, it } from 'vitest'
import {
  INTRO_BAND,
  INTRO_BAR_X,
  INTRO_BAR_Y,
  INTRO_STADIUM_LABEL_X,
  INTRO_TEAM_NAME_X,
  INTRO_TEXT_Y,
  SCREEN_Y_ADJUST,
  introStadiumNameFrameOf,
} from '@/widgets/game-scene/lib/introLayout'

describe('인트로 그리기 0x417ac 의 자리', () => {
  it('세로 보정 0xbaa8c() = (320 − 290) >> 1 = 15 (0x321a)', () => {
    expect(SCREEN_Y_ADJUST).toBe(15)
  })

  it('띠 (0, 55, 240, 30) · 막대 (35, 50) · 글씨 줄 y 58', () => {
    expect(INTRO_BAND).toEqual({ x: 0, y: 55, width: 240, height: 30 })
    expect([INTRO_BAR_X, INTRO_BAR_Y]).toEqual([35, 50])
    expect(INTRO_TEXT_Y).toBe(58)
  })

  it('팀 이름은 x0 + 25, "스타디움"은 x0 + 100', () => {
    expect(INTRO_TEAM_NAME_X).toBe(60)
    expect(INTRO_STADIUM_LABEL_X).toBe(135)
  })

  it('모드 1 은 구장 번호 st+0x30, 그 밖은 홈 팀 — img_text 0x41 + n', () => {
    expect(introStadiumNameFrameOf(1, 3, 7)).toBe(0x41 + 3)
    // 9 보다 큰 "랜덤" 칸도 그대로 첨자로 쓴다
    expect(introStadiumNameFrameOf(1, 12, 7)).toBe(0x41 + 12)
    expect(introStadiumNameFrameOf(1, undefined, 7)).toBe(0x41 + 7)
    expect(introStadiumNameFrameOf(2, 3, 7)).toBe(0x41 + 7)
    expect(introStadiumNameFrameOf(4, null, 0)).toBe(0x41)
  })
})
