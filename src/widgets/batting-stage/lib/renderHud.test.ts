import { describe, expect, it } from 'vitest'
import { hudRowsOf, type HudState } from '@/widgets/batting-stage/lib/renderHud'

const HUD: HudState = {
  inning: 1,
  half: '초',
  ourScore: 3,
  opponentScore: 5,
  balls: 0,
  strikes: 0,
  outs: 0,
  bases: { first: false, second: false, third: false },
  ourLogoUrl: 'ours.png',
  opponentLogoUrl: 'theirs.png',
}

describe('hudRowsOf — 위 줄 = 측 0(선공), 아래 줄 = 측 1 (0x373d0 37516~37548 · 375e8~37620)', () => {
  it('사람 팀이 선공(측 0)이면 위 줄이 사람 팀이다', () => {
    const rows = hudRowsOf({ ...HUD, playerSide: 0 })
    expect(rows.top).toEqual({ logoUrl: 'ours.png', score: 3, isBatting: true })
    expect(rows.bottom).toEqual({ logoUrl: 'theirs.png', score: 5, isBatting: false })
  })

  it('사람 팀이 후공(측 1)이면 위 줄이 상대다 — 말 공격이면 아래 줄 막대', () => {
    const rows = hudRowsOf({ ...HUD, half: '말', playerSide: 1 })
    expect(rows.top).toEqual({ logoUrl: 'theirs.png', score: 5, isBatting: false })
    expect(rows.bottom).toEqual({ logoUrl: 'ours.png', score: 3, isBatting: true })
  })

  it('측을 안 주면 사람 = 후공으로 본다', () => {
    expect(hudRowsOf(HUD).top.logoUrl).toBe('theirs.png')
  })
})
