// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RankingBoard } from '@/pages/nari-record-room/ui/RankingBoard'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'

afterEach(cleanup)

describe('순위 판 0x5796c 그리기', () => {
  it('빈 줄도 칸 네 개 · 내 팀 줄은 이름 글만 노랑 · 값은 숫자 그림', () => {
    const entries = [
      { record: { ...EMPTY_LEAGUE_RECORD, teamId: 3, name: '가나' }, value: 315 },
      { record: { ...EMPTY_LEAGUE_RECORD, teamId: 1, name: '다라' }, value: 298 },
    ]
    const { container } = render(
      <RankingBoard kind={12} kindLabelFrame={172} entries={entries} myTeamId={3}
        hasPreviousPage={false} hasNextPage testIdPrefix="기록순위" />,
    )
    expect(screen.getByTestId('기록순위-줄-9').querySelectorAll('img')).toHaveLength(4)
    expect(screen.getByTestId('기록순위-이름-0').style.color).toBe('rgb(255, 212, 41)')
    expect(screen.getByTestId('기록순위-이름-1').style.color).not.toBe('rgb(255, 212, 41)')
    expect(screen.getByTestId('기록순위-값-0').getAttribute('aria-label')).toBe('.315')
    expect(screen.getByTestId('기록순위-값-0').querySelectorAll('img')).toHaveLength(3)
    expect(container.querySelector('img[alt="다음 쪽"]')).not.toBeNull()
    expect(container.querySelector('img[alt="앞 쪽"]')).toBeNull()
  })

  it('[판+0x40c] 키 수가 % 8 > 4 이면 쪽 화살이 2 줄어든 자리로 (57b74 · 57c08)', () => {
    const 판 = (keyCount: number) => render(
      <RankingBoard kind={12} kindLabelFrame={172} entries={[]} myTeamId={3}
        hasPreviousPage hasNextPage={false} testIdPrefix="기록순위" keyCount={keyCount} />,
    )
    const 앞 = Number.parseFloat((판(0).container.querySelector('img[alt="앞 쪽"]') as HTMLElement).style.left)
    cleanup()
    const 뒤 = Number.parseFloat((판(5).container.querySelector('img[alt="앞 쪽"]') as HTMLElement).style.left)
    expect(뒤 - 앞).toBe(2)
  })
})
