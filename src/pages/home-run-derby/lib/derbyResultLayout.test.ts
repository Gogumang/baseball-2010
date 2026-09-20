import { describe, expect, it } from 'vitest'
import {
  POINT_BOX, POINT_ROWS, POINT_VALUE_BOX, RESULT_TITLE, RESULT_WINDOW, RETRY_BOX, RETRY_BUTTONS,
  STAT_BOX, STAT_BOX_TITLE, STAT_ROWS, STAT_VALUE_BOX,
  gamePointGlyphsOf, statLabelTopOf, statValueTopOf,
} from '@/pages/home-run-derby/lib/derbyResultLayout'

/**
 * R14 1절이 디스어셈으로 읽어 낸 좌표를 그대로 지킨다 — 240×320 화면 기준이다.
 * (문서 본문: "240×320 화면이면 (32, 54, 176, 213)")
 */
describe('결과 화면 0x45c18 배치', () => {
  it('창은 176×213, 왼쪽 위 (32, 54)', () => {
    expect(RESULT_WINDOW).toEqual({ x: 32, y: 54, width: 176, height: 213 })
  })

  it('"RESULT" 는 game_ui 이미지 30 을 (87, 61) 에', () => {
    expect(RESULT_TITLE.image).toBe(30)
    expect({ x: RESULT_TITLE.x, y: RESULT_TITLE.y }).toEqual({ x: 87, y: 61 })
  })

  it('칸 A 는 162×84, 위끝 75', () => {
    expect(STAT_BOX).toEqual({ x: 39, y: 75, width: 162, height: 84 })
  })

  it('칸 제목은 img_text 253 "홈런더비" 를 (50, 78) 에', () => {
    expect(STAT_BOX_TITLE).toEqual({ frame: 253, x: 50, y: 78 })
  })

  it('네 줄은 총 기회 · 최대 콤보 · 현재 비거리 · 최고 비거리 이고 단위는 회·회·M·M', () => {
    expect(STAT_ROWS.map((row) => row.label)).toEqual([243, 244, 247, 248])
    expect(STAT_ROWS.map((row) => row.unit)).toEqual([260, 260, 249, 249])
  })

  it('줄 간격은 16 이다', () => {
    expect(statLabelTopOf(0)).toBe(95)
    expect(statLabelTopOf(3)).toBe(95 + 48)
    expect(statValueTopOf(0)).toBe(94)
    expect(statValueTopOf(3)).toBe(94 + 48)
  })

  it('값 칸은 42×12 오른쪽 정렬', () => {
    expect(STAT_VALUE_BOX.width).toBe(42)
    expect(STAT_VALUE_BOX.height).toBe(12)
  })

  it('칸 B 는 162×44, 위끝 164 이고 두 줄은 획득 · 보유 다', () => {
    expect(POINT_BOX).toEqual({ x: 39, y: 164, width: 162, height: 44 })
    expect(POINT_ROWS.map((row) => row.label)).toEqual([256, 257])
    expect(POINT_VALUE_BOX).toEqual({ x: 109, width: 0x55, height: 0x10 })
  })

  it('칸 C 는 162×49, 위끝 213', () => {
    expect(RETRY_BOX).toEqual({ x: 39, y: 213, width: 162, height: 49 })
  })

  it('예·아니오 단추는 66px 떨어져 있고 고르면 프레임 6·7 이 된다', () => {
    const [yes, no] = RETRY_BUTTONS
    expect(no.x - yes.x).toBe(66)
    expect(yes.y).toBe(no.y)
    expect([yes.frame, yes.selectedFrame]).toEqual([1, 6])
    expect([no.frame, no.selectedFrame]).toEqual([2, 7])
  })
})

describe('G 숫자 글자 (gpoint.pzx)', () => {
  it('"1" 만 4px 이고 나머지는 8px 이다', () => {
    expect(gamePointGlyphsOf(105)).toEqual([
      { frame: 1, width: 4 },
      { frame: 0, width: 8 },
      { frame: 5, width: 8 },
    ])
  })
})
