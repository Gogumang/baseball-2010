// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'

afterEach(cleanup)

describe('ScoreboardFrame — 0x41440', () => {
  it('두 팀 로고(team_logo 그림)와 이름 칸 칠 #243677 을 원본 자리에', () => {
    render(<ScoreboardFrame x={0} y={80} side0={{ team: 3, isComputer: false }} side1={{ team: 5, isComputer: true }} />)
    const logo = screen.getByTestId('점수판-로고-1') as HTMLImageElement
    expect(logo.getAttribute('src')).toBe('./sprites/team_logo/005.png')
    // 박스 3 (153, 43, 66, 68) 에 75×76 — d = −9 → −4 − 1
    expect([logo.style.left, logo.style.top]).toEqual(['148px', '119px'])
    const plate = screen.getByTestId('점수판-이름칸-0').children
    expect(plate).toHaveLength(2)
    expect((plate[0] as HTMLElement).style.background).toBe('rgb(36, 54, 119)')
  })

  it('효과 1 · 인자 0 이면 그림은 안 그리고 칠만 남는다 (인트로 끝)', () => {
    render(<ScoreboardFrame x={0} y={90} side0={{ team: 0, isComputer: false }} side1={{ team: 1, isComputer: true }}
      effectLevel={0} introAlpha={135} />)
    expect(screen.queryByTestId('점수판-로고-0')).toBeNull()
    expect(screen.getByTestId('점수판-이름칸-0').style.opacity).toBe(String(135 / 255))
  })
})
