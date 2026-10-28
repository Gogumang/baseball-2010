import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { reputationCompleteGameInningIndexOf, reputationCompleteGameOf, seasonHumanWonOf } from '@/entities/season-mode/model/seasonEvaluation'
import { nationalCupRewardOf } from '@/entities/season-mode/model/seasonRewards'
import { masterRosterSlotOf, tradePenaltyOf } from '@/entities/season-mode/model/playerTrade'
import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

describe('B-38 연장 완투는 평판 보너스를 못 받는다', () => {
  const 깃발 = { allowedBaserunner: true, allowedHit: true, allowedRun: true }
  /** 11회까지 완투 — 아웃 33 */
  const 연장 = (current: number) => reputationCompleteGameOf(33, reputationCompleteGameInningIndexOf(current, 8), 깃발)

  it('원본: 평판은 정규 마지막 이닝(8)을 보아 연장 완투가 아니다', () => {
    expect(연장(10)).toBeNull()
  })

  it('고침: 지금 이닝을 보아 연장 완투도 완투 — 9이닝은 같다', () => {
    켜기('B-38')
    expect(연장(10)).toBe('완투')
    expect(reputationCompleteGameOf(27, reputationCompleteGameInningIndexOf(8, 8), 깃발)).toBe('완투')
  })
})

describe('B-40 동점이면 선공 팀이 이긴 것으로 본다', () => {
  it('원본: 동점에서 선공(측 0)이면 이겼다', () => {
    expect(seasonHumanWonOf(3, 3, 0)).toBe(true)
    expect(seasonHumanWonOf(3, 3, 1)).toBe(false)
  })

  it('고침: 동점은 아무도 이기지 않는다 — 점수가 갈리면 그대로', () => {
    켜기('B-40')
    expect(seasonHumanWonOf(3, 3, 0)).toBe(false)
    expect(seasonHumanWonOf(3, 3, 1)).toBe(false)
    expect(seasonHumanWonOf(4, 3, 0)).toBe(true)
    expect(seasonHumanWonOf(4, 3, 1)).toBe(true)
  })
})

describe('B-43 시즌 국가대항전 준우승 — 글 2500만 · 실제 2000만', () => {
  it('원본: 더하는 값은 20(2000만)', () => {
    expect(nationalCupRewardOf(11, true).money).toBe(20)
  })

  it('고침: 글대로 25(2500만) — 우승 · 탈락은 그대로', () => {
    켜기('B-43')
    expect(nationalCupRewardOf(11, true).money).toBe(25)
    expect(nationalCupRewardOf(10, true).money).toBe(50)
    expect(nationalCupRewardOf(11, false).messageId).toBe(0)
  })
})

describe('B-47 트레이드 자리 벌점을 id 아래 비트로 찾는다', () => {
  const 선수 = (덮어쓰기: Partial<SeasonPlayer> = {}): SeasonPlayer => ({
    id: 0,
    kindByte: 0,
    fieldPosition: 0,
    stamina: 0,
    ...덮어쓰기,
  })

  it('원본: 3팀 2번 투수 · 4팀 8번 타자는 못 찾아 벌점 0', () => {
    expect(masterRosterSlotOf(선수({ id: 2, kindByte: 0 }), 3, 0)).toBe(-1)
    expect(tradePenaltyOf(선수({ id: 2, kindByte: 0 }), 3, 0)).toBe(0)
    expect(masterRosterSlotOf(선수({ id: 8, kindByte: 3 }), 4, 1)).toBe(-1)
  })

  it('고침: 리그 선수는 늘 찾아 제 칸 번호(+0xa 하위 5비트)로 벌점 — 명전 · 나리는 그대로 −1', () => {
    켜기('B-47')
    expect(masterRosterSlotOf(선수({ id: 2, kindByte: 0 }), 3, 0)).toBe(0)
    expect(tradePenaltyOf(선수({ id: 2, kindByte: 0 }), 3, 0)).toBe(10)
    expect(masterRosterSlotOf(선수({ id: 8, kindByte: 3 }), 4, 1)).toBe(3)
    expect(tradePenaltyOf(선수({ id: 8, kindByte: 3 }), 4, 1)).toBe(10)
    expect(masterRosterSlotOf(선수({ id: 0xfe, kindByte: 0 }), 0, 0)).toBe(-1)
  })
})
