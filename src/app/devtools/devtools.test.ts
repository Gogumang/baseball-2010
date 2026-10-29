import { describe, expect, it } from 'vitest'
import { isPerfOverlayWanted } from '@/app/devtools/perfOverlay'
import { basesTextOf, countTextOf, inningTextOf, scoreTextOf } from '@/app/devtools/devPanelView'
import type { GameState } from '@/entities/game/model/gameState'

describe('isPerfOverlayWanted', () => {
  it('개발 서버면 늘, 배포판은 `?vitals` 일 때만', () => {
    expect(isPerfOverlayWanted(true, '')).toBe(true)
    expect(isPerfOverlayWanted(false, '')).toBe(false)
    expect(isPerfOverlayWanted(false, '?vitals')).toBe(true)
    expect(isPerfOverlayWanted(false, '?a=1&vitals=1')).toBe(true)
    expect(isPerfOverlayWanted(false, '?vital')).toBe(false)
  })
})

describe('개발 패널 글', () => {
  const game = {
    inning: 7,
    half: '말',
    outs: 2,
    bases: { first: true, second: false, third: true },
    ourScore: 3,
    opponentScore: 5,
  } as GameState

  it('경기 상황을 한 줄씩', () => {
    expect(inningTextOf(game)).toBe('7회 말 · 2아웃')
    expect(scoreTextOf(game)).toBe('우리 3 : 5 상대')
    expect(basesTextOf(game)).toBe('1 _ 3')
    expect(countTextOf({ balls: 2, strikes: 1, outcome: null })).toBe('B2 S1')
  })

  it('경기가 없으면 줄표', () => {
    expect(inningTextOf(null)).toBe('-')
    expect(scoreTextOf(null)).toBe('-')
    expect(basesTextOf(null)).toBe('-')
  })
})
