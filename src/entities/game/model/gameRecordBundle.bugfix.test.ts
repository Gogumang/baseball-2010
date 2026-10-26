import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { EMPTY_DECISION_STATE, applyRunScored, gameEndDecisionOf } from '@/entities/game/model/winLossSave'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import { EMPTY_LEAGUE, rankingOf } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

describe('B-35 승리 투수는 6회 이후 · 정규 9이닝에서만', () => {
  /** 1회초 원정(측 0) 5점 · 4회말 홈(측 1) 2점 — 6회 뒤 무득점 (r77 의 2:5 경기) */
  const 경기 = (): DecisionState => {
    const 점수 = [0, 0]
    let state = EMPTY_DECISION_STATE
    const 득점 = (inningIndex: number, offenseSide: number, runs: number) => {
      for (let run = 0; run < runs; run += 1) {
        점수[offenseSide] += 1
        state = applyRunScored(state, {
          inningIndex,
          lastInningIndex: 8,
          offenseSide,
          defenseSide: 1 - offenseSide,
          scoreOf: (side) => 점수[side],
          moundPitcherOf: (side) => (side === 0 ? 11 : 21),
        })
      }
    }
    득점(0, 0, 5)
    득점(3, 1, 2)
    return state
  }

  it('원본: 5회까지 점수만 난 경기는 승리 투수가 없다(패전은 있다)', () => {
    const decision = gameEndDecisionOf(경기())
    expect(decision.winner).toBeNull()
    expect(decision.loser).toEqual({ side: 1, number: 21 })
  })

  it('고침: 리드를 잡은 순간의 마운드 투수가 승리 투수다', () => {
    켜기('B-35')
    const decision = gameEndDecisionOf(경기())
    expect(decision.winner).toEqual({ side: 0, number: 11 })
    expect(decision.loser).toEqual({ side: 1, number: 21 })
  })
})

describe('B-36 상대전적 비교가 배열 위치로 표를 읽는다', () => {
  /**
   * 팀 5 가 승이 가장 많아 첫 바퀴에 0 번 자리로 오고, 팀 0 은 5 번 자리로 밀린다.
   * 팀 0 과 팀 6 은 승패가 같고 상대전적은 팀 6 이 앞선다 — 원본은 표의 [위치 6][위치 5] = 팀 6 대 팀 5 칸을 읽는다.
   */
  const 리그 = (): League => {
    const wins = [5, 0, 0, 0, 0, 9, 5, 0, 0, 0]
    const losses = [3, 0, 0, 0, 0, 0, 3, 0, 0, 0]
    const headToHead = EMPTY_LEAGUE.headToHead.map((row) => [...row])
    headToHead[6][0] = 3 // 팀 6 이 팀 0 을 3번 이겼다
    headToHead[5][6] = 2 // 원본이 읽는 엉뚱한 칸 — 팀 5 가 팀 6 을 이긴 수
    return { ...EMPTY_LEAGUE, wins, losses, headToHead }
  }

  it('원본: 위치로 읽어 상대전적에서 앞선 팀 6 이 팀 0 뒤로 간다', () => {
    expect(rankingOf(리그()).slice(0, 3)).toEqual([5, 0, 6])
  })

  it('고침: 그 자리의 팀 번호로 읽어 팀 6 이 팀 0 앞이다', () => {
    켜기('B-36')
    expect(rankingOf(리그()).slice(0, 3)).toEqual([5, 6, 0])
  })
})
