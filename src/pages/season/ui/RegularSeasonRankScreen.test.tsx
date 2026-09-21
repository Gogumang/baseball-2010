// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RegularSeasonRankScreen } from '@/pages/season/ui/RegularSeasonRankScreen'
import { EMPTY_LEAGUE, recordLeagueResult } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'

/**
 * 정규시즌 순위 (0xf0, 갱신 0x6c90) — P4 2b 절.
 * 순위(0부터) 0 → 401 · 1~3 → 402 · 4 이상 → 403 으로 갈린다.
 */

afterEach(cleanup)

/** 팀 t 가 승수 n 을 쌓은 리그 — 진 쪽은 늘 팀 9 로 둔다 */
function 리그(승수: Readonly<Record<number, number>>): League {
  let league = EMPTY_LEAGUE
  for (const [team, wins] of Object.entries(승수)) {
    for (let game = 0; game < wins; game += 1) league = recordLeagueResult(league, Number(team), 9)
  }
  return league
}

describe('순위별 이벤트', () => {
  it('1위면 401 (한국시리즈 직행)', () => {
    render(<RegularSeasonRankScreen league={리그({ 3: 20, 1: 10 })} teamId={3} onNext={vi.fn()} />)

    expect(document.body.textContent).toContain('정규시즌 순위 1위 — 이벤트 401')
  })

  it('2~4위면 402 (플레이오프)', () => {
    render(<RegularSeasonRankScreen league={리그({ 3: 20, 1: 10 })} teamId={1} onNext={vi.fn()} />)

    expect(document.body.textContent).toContain('2위 — 이벤트 402')
  })

  it('5위 아래면 403 (플레이오프 탈락)', () => {
    // 팀 0~3 이 이겨 위로 가고, 팀 8 은 한 번도 못 이겨 아래로 떨어진다
    render(
      <RegularSeasonRankScreen league={리그({ 0: 20, 1: 18, 2: 16, 3: 14, 4: 12 })} teamId={8} onNext={vi.fn()} />,
    )

    expect(document.body.textContent).toContain('이벤트 403')
  })
})

describe('화면', () => {
  it('확정 배치인 순위표 0x7f070 을 깔고 시즌 결산으로 넘어간다', () => {
    const onNext = vi.fn()
    render(<RegularSeasonRankScreen league={리그({ 0: 20 })} teamId={0} onNext={onNext} />)

    // 순위표 창은 widgets/standings 의 0x7f070 배치를 그대로 쓴다
    expect(screen.getByRole('dialog', { name: '기록실' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(onNext).toHaveBeenCalled()
  })
})
