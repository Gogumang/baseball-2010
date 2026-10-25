// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetTouchKeyOffersForTest, touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { RankingBoard } from '@/pages/nari-record-room/ui/RankingBoard'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'

afterEach(() => {
  cleanup()
  act(() => resetTouchKeyOffersForTest())
})

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

  it('터치 — 쪽 화살 자리 투명 칸은 원본 → 키 한 번(keydown · keyup)을 내고, 있는 쪽만 선다 — 같은 키를 상황 버튼으로 또 내지 않는다(필요한 버튼만)', () => {
    const seen: string[] = []
    const record = (event: KeyboardEvent) => seen.push(`${event.type}:${event.key}`)
    window.addEventListener('keydown', record)
    window.addEventListener('keyup', record)
    render(
      <RankingBoard kind={12} kindLabelFrame={172} entries={[]} myTeamId={3}
        hasPreviousPage={false} hasNextPage testIdPrefix="기록순위" />,
    )
    expect(screen.queryByRole('button', { name: '앞 쪽' })).toBeNull()
    expect(touchKeyOffersNow()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
    expect(seen).toEqual(['keydown:ArrowRight', 'keyup:ArrowRight'])
    window.removeEventListener('keydown', record)
    window.removeEventListener('keyup', record)
  })
})
