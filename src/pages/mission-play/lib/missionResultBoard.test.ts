import { describe, expect, it } from 'vitest'
import {
  MISSION_POINT_BOX, MISSION_POINT_ROWS, MISSION_RESULT_TITLE, MISSION_RESULT_WINDOW, MISSION_RETRY_BOX,
  MISSION_RETRY_BUTTONS, MISSION_RETRY_TEXT, missionResultEarnedOf, missionResultHeldOf, missionResultKeyActionOf,
  missionResultStepOf,
} from '@/pages/mission-play/lib/missionResultBoard'

const 보통 = { flag11f: false, flag176: false }

describe('미션 결과 판 0x4a384 (모드 5·6 갈래)', () => {
  it('창 (32, 84, 176, 152) · RESULT (92, 91) · 칸 (39, 109, 162, 61) · (39, 176, 162, 49)', () => {
    expect(MISSION_RESULT_WINDOW).toEqual({ x: 32, y: 84, width: 176, height: 152 })
    expect(MISSION_RESULT_TITLE).toMatchObject({ image: 30, x: 92, y: 91 })
    expect(MISSION_POINT_BOX).toEqual({ x: 39, y: 109, width: 162, height: 61 })
    expect(MISSION_RETRY_BOX).toEqual({ x: 39, y: 176, width: 162, height: 49 })
  })

  it('획득 · 보유 줄 — 글 y 124 · 144, G 숫자 y 121 · 141, 재도전 글 (39, 183)', () => {
    expect(MISSION_POINT_ROWS.map((row) => [row.labelY, row.valueY, row.plus])).toEqual([[124, 121, true], [144, 141, false]])
    expect(MISSION_RETRY_TEXT).toEqual({ x: 39, y: 183, width: 162 })
  })

  it('예 · 아니오 단추 — popup 1 · 2 를 (67, 204) · (133, 204), 고르면 6 · 7', () => {
    expect(MISSION_RETRY_BUTTONS.map((b) => [b.frame, b.selectedFrame, b.x, b.y])).toEqual([[1, 6, 67, 204], [2, 7, 133, 204]])
  })

  it('번 G — 성공이고 대결이 아닐 때만 보상, 보유는 0..99999', () => {
    expect(missionResultEarnedOf(true, false, 500)).toBe(500)
    expect(missionResultEarnedOf(false, false, 500)).toBe(0)
    expect(missionResultEarnedOf(true, true, 500)).toBe(0)
    expect(missionResultHeldOf(99_800, 500)).toBe(99_999)
    expect(missionResultHeldOf(100, 500)).toBe(600)
  })

  it('키 0x407f0 — ←/→/4/6 뒤집기, OK 는 예 → 다시 · 아니오 → 목록, CLR 은 목록', () => {
    expect(missionResultKeyActionOf('4')).toBe('뒤집기')
    expect(missionResultKeyActionOf('ArrowRight')).toBe('뒤집기')
    expect(missionResultKeyActionOf('5')).toBe('확인')
    expect(missionResultKeyActionOf('Escape')).toBe('취소')
    expect(missionResultKeyActionOf('2')).toBeNull()
    expect(missionResultStepOf('뒤집기', true, 보통)).toEqual({ answer: false, exit: null })
    expect(missionResultStepOf('확인', true, 보통).exit).toBe('다시')
    expect(missionResultStepOf('확인', false, 보통).exit).toBe('목록')
    expect(missionResultStepOf('취소', true, 보통).exit).toBe('목록')
  })

  it('마선수 대결 — 커서를 안 뒤집고, CLR 은 대결 끝 · OK 는 두 칸이 다 서야 대결 끝', () => {
    const 타자대결 = { flag11f: true, flag176: false }
    expect(missionResultStepOf('뒤집기', true, 타자대결)).toEqual({ answer: true, exit: null })
    expect(missionResultStepOf('취소', true, 타자대결).exit).toBe('대결끝')
    expect(missionResultStepOf('확인', true, 타자대결).exit).toBe('다시')
    expect(missionResultStepOf('확인', true, { flag11f: true, flag176: true }).exit).toBe('대결끝')
  })
})
