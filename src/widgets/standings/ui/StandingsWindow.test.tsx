// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StandingsWindow } from '@/widgets/standings/ui/StandingsWindow'
import { ROW_CELLS, ROW_STEP, TEAM_LABEL_BASE_FRAME } from '@/widgets/standings/lib/standingsLayout'
import { applyGameResult, createCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { GameResult } from '@/entities/game/model/gameState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 기록실 순위표가 `career.league` 를 그대로 그리는지 본다.
 * 숫자는 글자 그림이라 num 그림 번호에서 숫자를 되읽고, 놓인 x 로 어느 칸인지 가른다.
 */

afterEach(cleanup)

const OUR_TEAM = 0
const RIVAL_TEAM = 3

/** num 그림 번호 → 숫자. 승·패·승률은 주황 20번대, 순위는 하늘색 90번대다 */
const ORANGE_DIGIT_BASE = 20
const SKY_BLUE_DIGIT_BASE = 90

function digitOf(source: string): { digit: number; isRank: boolean } | null {
  const matched = /\/sprites\/num\/(\d{3})\.png$/.exec(source)
  if (matched === null) return null
  const frame = Number(matched[1])
  if (frame >= ORANGE_DIGIT_BASE && frame < ORANGE_DIGIT_BASE + 10) {
    return { digit: frame - ORANGE_DIGIT_BASE, isRank: false }
  }
  if (frame >= SKY_BLUE_DIGIT_BASE && frame < SKY_BLUE_DIGIT_BASE + 10) {
    return { digit: frame - SKY_BLUE_DIGIT_BASE, isRank: true }
  }
  return null
}

interface StandingsRow {
  readonly rank: number
  readonly teamId: number
  readonly wins: number
  readonly losses: number
  readonly winningPercent: number
}

/** 그려진 창을 사람이 보는 표로 되돌린다 */
function readStandings(): StandingsRow[] {
  const dialog = screen.getByRole('dialog', { name: '기록실' })
  const rows: StandingsRow[] = []

  for (const element of dialog.querySelectorAll('img')) {
    const source = element.getAttribute('src') ?? ''
    const top = Number.parseInt(element.style.top, 10)
    const teamLabel = /\/sprites\/img_text\/frames\/(\d{3})\.png$/.exec(source)
    if (teamLabel !== null) {
      const index = Math.round((top - ROW_CELLS.team.y) / ROW_STEP)
      if (index < 0) continue // 머리칸 이름표
      rows[index] = { ...(rows[index] ?? blankRow()), teamId: Number(teamLabel[1]) - TEAM_LABEL_BASE_FRAME }
      continue
    }
    const read = digitOf(source)
    if (read === null) continue
    const left = Number.parseInt(element.style.left, 10)
    const index = Math.round((top - (read.isRank ? ROW_CELLS.rank.y : ROW_CELLS.wins.y)) / ROW_STEP)
    const column = columnAt(left, read.isRank)
    if (column === null || index < 0) continue
    const current = rows[index] ?? blankRow()
    rows[index] = { ...current, [column]: current[column] * 10 + read.digit }
  }
  return rows
}

const blankRow = (): StandingsRow => ({ rank: 0, teamId: -1, wins: 0, losses: 0, winningPercent: 0 })

type NumberColumn = 'rank' | 'wins' | 'losses' | 'winningPercent'

/** 글자가 놓인 x 로 칸을 가른다 — 칸들은 x 범위가 겹치지 않는다 */
function columnAt(left: number, isRank: boolean): NumberColumn | null {
  if (isRank) return 'rank'
  const columns: NumberColumn[] = ['wins', 'losses', 'winningPercent']
  return (
    columns.find((column) => left >= ROW_CELLS[column].x && left < ROW_CELLS[column].x + ROW_CELLS[column].width) ??
    null
  )
}

function summaryOf(result: GameResult, opponentTeamId: number): GameSummary {
  return {
    result,
    ourScore: result === '승' ? 3 : result === '패' ? 1 : 2,
    opponentScore: result === '승' ? 1 : result === '패' ? 3 : 2,
    stats: EMPTY_SEASON_STATS,
    popularityPoints: 0,
    doublePlays: 0,
    scoringPositionOuts: 0,
    ourTeamId: OUR_TEAM,
    opponentTeamId,
    recordIds: [],
  }
}

/** 경기를 차례로 치른 커리어 */
function afterGames(results: readonly GameResult[]): PlayerCareer {
  return results.reduce(
    (career, result) => applyGameResult(career, summaryOf(result, RIVAL_TEAM)),
    createCareer('테스터'),
  )
}

const rowOf = (rows: readonly StandingsRow[], teamId: number) => rows.find((row) => row.teamId === teamId)

describe('기록실 순위표', () => {
  it('한 경기도 안 치렀으면 모든 팀이 0승 0패 0% 다', () => {
    render(<StandingsWindow league={createCareer('테스터').league} onClose={vi.fn()} />)

    const rows = readStandings()

    expect(rows).toHaveLength(10)
    expect(rows.every((row) => row.wins === 0 && row.losses === 0 && row.winningPercent === 0)).toBe(true)
  })

  it('승·패가 우리 팀과 상대 팀 양쪽에 쌓인다', () => {
    const career = afterGames(['승', '승', '승', '패'])

    render(<StandingsWindow league={career.league} onClose={vi.fn()} />)
    const rows = readStandings()

    expect(rowOf(rows, OUR_TEAM), `우리 팀 줄: ${JSON.stringify(rowOf(rows, OUR_TEAM))}`).toMatchObject({
      wins: 3, losses: 1,
    })
    expect(rowOf(rows, RIVAL_TEAM)).toMatchObject({ wins: 1, losses: 3 })
  })

  it('승률은 승×100÷(승+패) 를 버린 정수 % 다', () => {
    // 3승 1패 = 75%, 상대는 1승 3패 = 25%
    render(<StandingsWindow league={afterGames(['승', '승', '승', '패']).league} onClose={vi.fn()} />)
    const rows = readStandings()

    expect(rowOf(rows, OUR_TEAM)?.winningPercent, `우리 승률: ${rowOf(rows, OUR_TEAM)?.winningPercent}`).toBe(75)
    expect(rowOf(rows, RIVAL_TEAM)?.winningPercent).toBe(25)
  })

  it('버림이라 2승 1패는 67% 가 아니라 66% 다', () => {
    render(<StandingsWindow league={afterGames(['승', '승', '패']).league} onClose={vi.fn()} />)

    expect(rowOf(readStandings(), OUR_TEAM)?.winningPercent).toBe(66)
  })

  it('무승부는 승도 패도 늘리지 않는다 (0xb76dc·0xb77e0 에 무승부 분기가 없다)', () => {
    const drawn = afterGames(['승', '무', '무', '패'])
    const withoutDraws = afterGames(['승', '패'])

    render(<StandingsWindow league={drawn.league} onClose={vi.fn()} />)
    const rows = readStandings()

    expect(rowOf(rows, OUR_TEAM)).toMatchObject({ wins: 1, losses: 1, winningPercent: 50 })
    expect(drawn.league).toEqual(withoutDraws.league)
    // 선수 개인 기록에는 무승부가 남는다 — 순위표만 안 세는 것이다
    expect(drawn.draws, `개인 무승부: ${drawn.draws}`).toBe(2)
  })

  it('승이 많은 팀이 위에 온다 — 1위 줄이 우리 팀이다', () => {
    render(<StandingsWindow league={afterGames(['승', '승']).league} onClose={vi.fn()} />)
    const rows = readStandings()

    expect(rows[0]).toMatchObject({ rank: 1, teamId: OUR_TEAM, wins: 2, losses: 0 })
    expect(rows[rows.length - 1].rank).toBe(10)
  })

  it('포스트시즌은 진출 4팀만 그린다', () => {
    render(<StandingsWindow league={afterGames(['승']).league} rowCount={4} onClose={vi.fn()} />)

    expect(readStandings()).toHaveLength(4)
  })
})
