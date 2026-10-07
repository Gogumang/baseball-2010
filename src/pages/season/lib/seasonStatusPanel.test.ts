import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import { seasonStatusPanelLayoutOf, statusPanelGoalRankOf } from '@/pages/season/lib/seasonStatusPanel'

const 레코드 = (바꿀 = {}) => ({ ...startNewSeason(2, '테스트').record, ...바꿀 })

describe('시즌 상태판 0x7d34c 모드 2 갈래', () => {
  it('이름 띠는 W/2 − 0x1c = 92 에서 꺾이고, 박스 1 에 팀 이름 그림(65 + 팀)을 가운데 + ox 6 으로', () => {
    const layout = seasonStatusPanelLayoutOf(레코드())
    expect(layout.nameBandSplit).toBe(92)
    // 박스 1 (0,136,81,20) · 그림 67 은 53×10 → x = (81 − 53) >> 1 + 6 = 20 · y = 136 + 올림(10/2) = 141
    expect(layout.teamName).toEqual({ frame: 67, left: 20, top: 141 })
  })

  it('박스 2 에 314 "팀목표 위 이내" 를 가운데 + ox 6, 빈칸에 목표 순위 숫자(num 20 + 순위)를 (박스x + 폭/2 + 3, 박스y + 5) 에', () => {
    const layout = seasonStatusPanelLayoutOf(레코드())
    // 박스 2 (92,136,148,20) · 314 는 83 폭 → 92 + 32 + 6 = 130
    expect(layout.goalText).toEqual({ frame: 314, left: 130, top: 141 })
    // 1년차 목표 순위 4 → num 24 · (92 + 74 + 3, 136 + 5)
    expect(layout.goalRankDigit).toEqual({ frame: 24, left: 169, top: 141 })
  })

  it('목표 순위는 0xd4406[min(연차, 9) × 5] — 상태판은 연차를 9 로 자른다', () => {
    expect([0, 3, 9].map(statusPanelGoalRankOf)).toEqual([4, 3, statusPanelGoalRankOf(9)])
    expect(statusPanelGoalRankOf(12)).toBe(statusPanelGoalRankOf(9))
  })

  it('박스 9 는 직전 경기 관중 — 숫자 오른쪽 끝 ox −11, "명"(344) 은 정렬 0x24 · ox −2', () => {
    const layout = seasonStatusPanelLayoutOf(레코드({ lastAttendance: 12345 }))
    // 박스 9 (157,180,58,15) → 숫자 오른끝 215 − 11 = 204 · "명" 9 폭 → 157 + 58 − 9 − 2 = 204, y 180 + 3
    expect(layout.attendanceRight).toBe(204)
    expect(layout.attendanceUnit).toEqual({ frame: 344, left: 204, top: 183 })
  })

  it('메시지줄 — 연차 SR+0xb3 + 1, 경기 SR+0xb2 + 1 (0 이고 포스트시즌이면 45)', () => {
    expect(seasonStatusPanelLayoutOf(레코드({ yearIndex: 2, games: 10 }))).toMatchObject({ year: 3, game: 11 })
    expect(seasonStatusPanelLayoutOf(레코드({ games: 0, inPostseason: true })).game).toBe(45)
    expect(seasonStatusPanelLayoutOf(레코드({ games: 2, inPostseason: true })).game).toBe(3)
    // 이벤트 대화창 0x8b5ac 가 둘째 인자를 세우면 1 보다 클 때 −1
    expect(seasonStatusPanelLayoutOf(레코드({ games: 10 }), true).game).toBe(10)
  })

  it('상태 아이콘은 이글아이(SR+0x54)·질병(SR+5) 둘만 본다 — 행운·부상·무력감 칸은 건너뛴다', () => {
    expect(seasonStatusPanelLayoutOf(레코드({ aimVisionGames: 3, illness: 2 })).icons).toEqual({
      isLuckEquipped: false, eagleEyeGamesRemaining: 3, isSick: true, isInjured: false, hasHelplessness: false,
    })
  })
})
