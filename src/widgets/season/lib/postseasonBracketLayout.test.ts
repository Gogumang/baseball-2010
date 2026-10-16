import { describe, expect, it } from 'vitest'
import { advancePostseason, startPostseason } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import {
  RANK_TAGS, bracketViewOf, rankDigitBoxTopOf, rankDigitRightOf, rankGlyphsOf, rankUnitPositionOf,
} from '@/widgets/season/lib/postseasonBracketLayout'
import type { BracketView } from '@/widgets/season/lib/postseasonBracketLayout'

/** 대진표 0x853ac 의 순위 딱지 — 0x854c8~0x85524 직접 떴다 */
describe('순위 딱지', () => {
  it('숫자는 num 0~9(기준 0) · 자간 0 — "1" 만 4px', () => {
    expect(rankGlyphsOf(4)).toEqual([{ frame: 4, width: 8, spacing: 0 }])
    expect(rankGlyphsOf(1)).toEqual([{ frame: 1, width: 4, spacing: 0 }])
  })

  it('숫자는 박스 x + 8 에 왼쪽 붙임, 세로는 oy 1 뒤 올림 가운데 (0xba51c 정렬 0x21)', () => {
    const tag = RANK_TAGS[0] // 4위 (26, 243, 39, 15)
    // 오른쪽 끝 = 26 + 8 + 8 → 숫자 왼쪽 = 34
    expect(rankDigitRightOf(tag, 4)).toBe(42)
    expect(rankDigitBoxTopOf(tag)).toBe(244)
  })

  it('"위"(img_text 307, 9×10) 는 오른쪽 맞춤 ox −6 · 세로 ceil((15 − 10)/2) (0xb9d74 정렬 0x24)', () => {
    expect(rankUnitPositionOf(RANK_TAGS[0])).toEqual({ x: 26 - 6 + 39 - 9, y: 243 + 3 })
  })
})

describe('이긴 길 · 진 칸 (0x85536~0x8580e)', () => {
  const 순위 = [0, 1, 2, 3] // 1~4위 = 팀 0~3
  const 이김 = (series: PostseasonSeries, team: number, times: number) => {
    let next = series
    for (let i = 0; i < times; i += 1) next = advancePostseason(next, team)
    return next
  }
  const 박스 = (view: BracketView) => view.redBoxes.map(({ frame, box }) => `${frame}.${box}`)

  it('준PO 전: 빨강 없음 · 칸 팀은 [3위, 4위, 2위, 1위]', () => {
    const view = bracketViewOf(startPostseason(순위))
    expect(view.cellTeams).toEqual([2, 3, 1, 0])
    expect(view.redBoxes).toEqual([])
    expect(view.darkCells).toEqual([false, false, false, false])
  })

  it('3위(b)가 준PO 승: 54 박스 0~2 · 55.0 · 56.0 빨강, 칸 1 덮기', () => {
    const view = bracketViewOf(이김(startPostseason(순위), 2, 3))
    expect(박스(view)).toEqual(['54.0', '54.1', '54.2', '55.0', '56.0'])
    expect(view.darkCells).toEqual([false, true, false, false])
  })

  it('4위가 준PO 승: 55 박스 0~2 · 55.0 · 56.0 빨강, 칸 0 덮기', () => {
    const view = bracketViewOf(이김(startPostseason(순위), 3, 3))
    expect(박스(view)).toEqual(['55.0', '55.1', '55.2', '55.0', '56.0'])
    expect(view.darkCells).toEqual([true, false, false, false])
  })

  it('준PO 승자(4위)가 PO 승: 55 박스 0~4 · 56.0 · 57.0 더, 칸 2 덮기', () => {
    const view = bracketViewOf(이김(이김(startPostseason(순위), 3, 3), 3, 3))
    expect(박스(view).slice(5)).toEqual(['55.0', '55.1', '55.2', '55.3', '55.4', '56.0', '57.0'])
    expect(view.darkCells).toEqual([true, false, true, false])
  })

  it('2위가 PO 승: 준PO 승자 길은 끝까지 남고(semiPlayoffWinner) 56 박스 0~2 · 56.0 · 57.0, 칸 0·1 덮기', () => {
    const view = bracketViewOf(이김(이김(startPostseason(순위), 2, 3), 1, 3))
    expect(박스(view)).toEqual(['54.0', '54.1', '54.2', '55.0', '56.0', '56.0', '56.1', '56.2', '56.0', '57.0'])
    expect(view.darkCells).toEqual([true, true, false, false])
  })

  it('1위 우승: 57 박스 전부, 칸 0~2 덮기 · 다른 팀 우승이면 칸 3 덮기', () => {
    const ps = 이김(이김(startPostseason(순위), 2, 3), 1, 3)
    const 일위 = bracketViewOf(이김(ps, 0, 4))
    expect(박스(일위).slice(-3)).toEqual(['57.0', '57.1', '57.2'])
    expect(일위.darkCells).toEqual([true, true, true, false])
    const 이위 = bracketViewOf(이김(ps, 1, 4))
    expect(박스(이위).slice(-5)).toEqual(['56.0', '56.1', '56.2', '56.3', '56.4'])
    expect(이위.darkCells).toEqual([true, true, false, true])
  })

  it('옛 저장(준PO 승자 칸 없음)은 withSemiPlayoffWinner 로 되살린다', () => {
    const ps = 이김(이김(startPostseason(순위), 2, 3), 1, 3)
    const { semiPlayoffWinner: _drop, ...old } = ps
    expect(박스(bracketViewOf(old)).slice(0, 3)).toEqual(['54.0', '54.1', '54.2'])
  })
})
