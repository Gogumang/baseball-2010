import { describe, expect, it } from 'vitest'
import {
  SETTLEMENT_INFO_BAR, SETTLEMENT_INFO_POINT, SETTLEMENT_SCORE, scrollSettlementRecords, settlementKeyActionOf,
  settlementPanelHeightOf, settlementPanelLayoutOf, settlementRecordRowsOf, startSettlementScroll, versusRewardTextOf,
} from '@/pages/team-game/lib/settlementBoard'

describe('팀경기 정산 판 0x4a384 (그 밖 모드 갈래 0x4a948)', () => {
  it('점수는 game_ui 프레임 16 박스 4·5 로 (57, 225) · (187, 225) 가 글 가운데다', () => {
    expect(SETTLEMENT_SCORE.side0).toEqual({ centerX: 57, y: 225 })
    expect(SETTLEMENT_SCORE.side1).toEqual({ centerX: 187, y: 225 })
  })

  it('기본 화면 바닥 — game_ui 이미지 12 (100, 307) · "0:INFO" (105, 310) · 번 G (80, 289)', () => {
    expect([SETTLEMENT_INFO_BAR.x, SETTLEMENT_INFO_BAR.y]).toEqual([100, 307])
    expect([SETTLEMENT_INFO_BAR.labelX, SETTLEMENT_INFO_BAR.labelY]).toEqual([105, 310])
    expect([SETTLEMENT_INFO_POINT.x, SETTLEMENT_INFO_POINT.y]).toEqual([80, 289])
  })

  it('기록 판 높이는 182, 대전모드(8·9)에서 이겼을 때만 202', () => {
    expect(settlementPanelHeightOf(2, true)).toBe(182)
    expect(settlementPanelHeightOf(8, false)).toBe(182)
    expect(settlementPanelHeightOf(8, true)).toBe(202)
    expect(settlementPanelHeightOf(9, true)).toBe(202)
  })

  it('판 h = 182 의 자리 — r7 = 69 에서 칸·줄·OK 가 이어진다', () => {
    const layout = settlementPanelLayoutOf(182, 3, false)
    expect(layout.window).toEqual({ x: 32, y: 69, width: 176, height: 182 })
    expect(layout.title).toMatchObject({ x: 92, y: 76 })
    expect(layout.recordBox).toEqual({ x: 39, y: 92, width: 162, height: 85 })
    expect(layout.records.firstRowY).toBe(104)
    expect(layout.records.scrollBar).toEqual({ x: 188, y: 103 })
    expect(layout.emptyText).toEqual({ x: 39, y: 128, width: 162 })
    expect(layout.pointBox).toEqual({ x: 39, y: 181, width: 162, height: 46 })
    expect(layout.pointRows.map((row) => [row.labelY, row.valueY])).toEqual([[189, 186], [209, 206]])
    expect(layout.rewardBox).toBeNull()
    expect(layout.okButton).toMatchObject({ x: 100, y: 231 })
  })

  it('대전 이김(h = 202) — 승리 추가 보상 칸과 흐르는 글 (W/2 − 0x51, r7 + 3, 162, 18) 뒤에 OK', () => {
    const layout = settlementPanelLayoutOf(202, 0, true)
    expect(layout.window.y).toBe(59)
    expect(layout.rewardBox).toEqual({ x: 39, y: 221, width: 162, height: 18 })
    expect(layout.ticker).toEqual({ x: 39, y: 224, width: 162, height: 18 })
    expect(layout.okButton.y).toBe(241)
    expect(versusRewardTextOf(100)).toBe('승리 추가 보상[!cffff00100 G포인트!cffffff]')
  })

  it('기록 줄 — 0x4ebe0: 번호 차례로 횟수가 있는 것만', () => {
    expect(settlementRecordRowsOf([5, 2, 5, 39, 40])).toEqual([
      { id: 2, count: 1 }, { id: 5, count: 2 }, { id: 39, count: 1 },
    ])
  })

  it('스크롤 0x61c55(skin, 0x3a, 4, n) — 4줄 보이고 한 줄씩', () => {
    const scroll = startSettlementScroll(6)
    expect(scroll).toMatchObject({ top: 0, step: 14, thumbLength: 56 - 2 * 14 })
    const down = scrollSettlementRecords(scrollSettlementRecords(scrollSettlementRecords(scroll, 'down'), 'down'), 'down')
    expect(down.top).toBe(2)
    expect(scrollSettlementRecords(startSettlementScroll(3), 'down').top).toBe(0)
  })

  it('키 0x407f0 — 닫힌 판: \'0\' 만 연다, 나머지는 나간다 · 열린 판: OK·CLR·\'0\'·\'5\' 가 닫는다', () => {
    expect(settlementKeyActionOf('0', false)).toBe('판열기')
    expect(settlementKeyActionOf('Enter', false)).toBe('나가기')
    expect(settlementKeyActionOf('ArrowDown', false)).toBe('나가기')
    expect(settlementKeyActionOf('Shift', false)).toBeNull()
    expect(settlementKeyActionOf('8', true)).toBe('아래로')
    expect(settlementKeyActionOf('0', true)).toBe('판닫기')
    expect(settlementKeyActionOf('Escape', true)).toBe('판닫기')
    expect(settlementKeyActionOf('4', true)).toBeNull()
  })
})
