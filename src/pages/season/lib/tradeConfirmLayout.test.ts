import { describe, expect, it } from 'vitest'
import {
  TRADE_CONFIRM,
  moneyTextOf,
  teamNameFrameOf,
  tradeBadgeOf,
  tradeBoostTextOf,
  tradeCostBoxPaintsOf,
  tradeCostTextOf,
} from '@/pages/season/lib/tradeConfirmLayout'

/** 트레이드 확인 0xd4e8 — 기대값은 unicorn 으로 0xd4e8 을 돌려 받은 그리기 인자다(r89) */
describe('트레이드 확인 0xd4e8', () => {
  it('판 · 칸은 mode_ui 프레임 70 · 71 박스 — 머리 글 표 0xcbe80 [320 이름 · 323 보직 · 81 팀명]', () => {
    expect(TRADE_CONFIRM.panel).toMatchObject({ x: 24, y: 57, width: 192, height: 210 })
    expect(TRADE_CONFIRM.headers.map((header) => header.frame)).toEqual([320, 323, 81])
    expect(TRADE_CONFIRM.rows.map((row) => row.y)).toEqual([209, 226, 243])
    expect(teamNameFrameOf(3)).toBe(68)
  })

  it('딱지 — 투수 탭 보직 0 선발(0x49 · 49) · 1 중계(0x4c · 170) · 2 구원(0x4a · 182), 타자 탭 0 내야 · 1 외야 · 그 밖 지명', () => {
    expect([0, 1, 2].map((role) => tradeBadgeOf(true, role))).toEqual([
      { chip: 0x49, label: 49 },
      { chip: 0x4c, label: 170 },
      { chip: 0x4a, label: 182 },
    ])
    expect([0, 1, 2].map((low) => tradeBadgeOf(false, low))).toEqual([
      { chip: 0x4a, label: 304 },
      { chip: 0x49, label: 305 },
      { chip: 0x4c, label: 183 },
    ])
  })

  it('비용 글 — StrMODE[167] + 부호 + 0x55cf5(|d| × 100), d = (내 − 상대) × 10 · 음수면 × 2', () => {
    expect(tradeCostTextOf(9, 9)).toBe('트레이드 비용 : 0')
    expect(tradeCostTextOf(12, 9)).toBe('트레이드 비용 :  +3000')
    expect(tradeCostTextOf(9, 19)).toBe('트레이드 비용 :  -2억')
    expect(moneyTextOf(23456)).toBe('2억3456')
    expect(tradeBoostTextOf(1)).toContain('+50%')
  })

  it('0x802dd 창 — #1D44A8 칠 · 위 · 왼 #0A266F · 아래 · 오른 #5683F5', () => {
    expect(tradeCostBoxPaintsOf({ x: 33, y: 170, width: 174, height: 34 })).toEqual([
      { x: 33, y: 170, width: 174, height: 34, color: '#1D44A8' },
      { x: 33, y: 170, width: 174, height: 1, color: '#0A266F' },
      { x: 33, y: 170, width: 1, height: 35, color: '#0A266F' },
      { x: 34, y: 204, width: 173, height: 1, color: '#5683F5' },
      { x: 206, y: 171, width: 1, height: 34, color: '#5683F5' },
    ])
  })
})
