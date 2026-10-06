// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'

afterEach(cleanup)

const srcs = (testId: string) => screen.queryAllByTestId(testId).map((node) => node.getAttribute('src'))

describe('투수·타자 소개 판 (0x44944)', () => {
  it('틱 0 은 화면 밖, 틱 7 이면 우타 기준 투수 판 (−3, 90) · 타자 판 (103, 225)', () => {
    const { rerender } = render(
      <MatchupCards tick={0} batterHand={0} pitcher={{ isComputer: true }} batter={{ isComputer: false }} />,
    )
    expect(screen.getByTestId('투수판').dataset.x).toBe(String(-139 - 3))
    rerender(<MatchupCards tick={7} batterHand={0} pitcher={{ isComputer: true }} batter={{ isComputer: false }} />)
    expect([screen.getByTestId('투수판').dataset.x, screen.getByTestId('투수판').dataset.y]).toEqual(['-3', '90'])
    expect([screen.getByTestId('타자판').dataset.x, screen.getByTestId('타자판').dataset.y]).toEqual(['103', '225'])
  })

  it('판은 game_ui 1·2, 팀 글자 COM/PLAYER, 그림 글자 방어·삼진·타율·홈런·타점, 타자 손', () => {
    render(<MatchupCards tick={7} batterHand={1} pitcher={{ isComputer: true }} batter={{ isComputer: false }} />)
    expect(srcs('판')).toEqual(['./sprites/game_ui/frames/001.png', './sprites/game_ui/frames/002.png'])
    expect(srcs('투수팀')).toEqual(['./sprites/img_text/frames/158.png'])
    expect(srcs('타자팀')).toEqual(['./sprites/img_text/frames/157.png'])
    expect(srcs('방어')).toEqual(['./sprites/img_text/frames/316.png'])
    expect(srcs('삼진')).toEqual(['./sprites/img_text/frames/317.png'])
    expect(srcs('타율칸')).toEqual(['./sprites/img_text/frames/318.png'])
    expect(srcs('홈런칸')).toEqual(['./sprites/img_text/frames/180.png'])
    expect(srcs('타점칸')).toEqual(['./sprites/img_text/frames/319.png'])
    expect(srcs('타자손')).toEqual(['./sprites/img_text/frames/056.png'])
  })

  it('모르는 값은 안 그린다 — 이름·숫자·막대·기록 칸이 없다', () => {
    render(<MatchupCards tick={7} batterHand={0} pitcher={{ isComputer: true }} batter={{ isComputer: false }} />)
    expect(screen.queryAllByTestId('이름')).toHaveLength(0)
    expect(screen.queryAllByTestId('방어율')).toHaveLength(0)
    expect(screen.queryAllByTestId('타석기록')).toHaveLength(0)
    expect(screen.queryAllByTestId('투수손')).toHaveLength(0)
  })

  it('넘긴 값은 원본 칸에 그린다', () => {
    render(
      <MatchupCards
        tick={7}
        batterHand={0}
        pitcher={{ isComputer: true, name: '레오니', role: 0, throwsLeft: true, earnedRunAverage: 345, strikeouts: 12 }}
        batter={{
          isComputer: false, name: '나리', position: 6, battingAverage: 305, homeRuns: 3, runsBattedIn: 9,
          battingOrder: 3, recentResults: [1, 7],
        }}
      />,
    )
    expect(screen.getAllByTestId('이름').map((node) => node.textContent)).toEqual(['레오니', '나리'])
    expect(srcs('보직칸')).toEqual(['./sprites/game_ui/frames/004.png'])
    expect(srcs('보직')).toEqual(['./sprites/img_text/frames/049.png'])
    expect(srcs('투수손')).toEqual(['./sprites/img_text/frames/054.png'])
    expect(srcs('수비')).toEqual(['./sprites/img_text/frames/184.png'])
    expect(screen.getAllByTestId('방어율').map((node) => node.dataset.image)).toEqual(['23', '25', '24'])
    expect(screen.getAllByTestId('타순').map((node) => node.dataset.image)).toEqual(['34'])
    expect(screen.getAllByTestId('타석기록').map((node) => node.dataset.label)).toEqual(['58', '181'])
  })
})
