import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { startGame, withAutoStopLateInningSetup, type GameProgress } from '@/features/play-game/model/gameFlow'
import { PLAYER_BATTING_ORDER_INDEX } from '@/entities/game/model/gameState'
import { opponentOf } from '@/entities/league/model/league'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 비율을 정해진 차례로 내는 난수 — 쓴 횟수를 센다 */
const 차례난수 = (values: readonly number[]) => {
  let index = 0
  const random: RandomPort = createFractionRandom(() => values[index++] ?? 0)
  return { random, used: () => index }
}

/** 9회말 · 동점 · 2아웃 만루 — t = 2 + 3 = 5 · d = 0 */
const 끝내기판 = (game: Partial<GameProgress['game']> = {}): GameProgress => {
  const progress = startGame(createSeededRandom(1), 0, PLAYER_BATTING_ORDER_INDEX + 1, opponentOf(0, 0), 1)
  return {
    ...progress,
    game: {
      ...progress.game,
      inning: 9,
      half: '말',
      outs: 2,
      bases: { first: true, second: true, third: true },
      ourScore: 3,
      opponentScore: 3,
      ...game,
    },
  }
}

describe('B-13 끝내기 판 0xc22b4 — 아웃이 3 을 넘어 선다', () => {
  it('원본: n = rand(0, 6) = 0 이면 아웃 = t − n = 5', () => {
    const { random } = 차례난수([0, 0, 0, 0])
    expect(withAutoStopLateInningSetup(끝내기판(), random).game.outs).toBe(5)
  })

  it('고침: 아웃은 2 에서 자른다 — 굴림 횟수 · 주자 세우기는 원본과 같다', () => {
    const 원본 = 차례난수([0, 0, 0, 0])
    const 앞 = withAutoStopLateInningSetup(끝내기판(), 원본.random)
    setBugfixConfigForTests(bugfixConfigWith(['B-13']))
    const 고침 = 차례난수([0, 0, 0, 0])
    const 뒤 = withAutoStopLateInningSetup(끝내기판(), 고침.random)
    expect(뒤.game.outs).toBe(2)
    expect(뒤.game.bases).toEqual(앞.game.bases)
    expect(뒤.game.runners).toEqual(앞.game.runners)
    expect(고침.used()).toBe(원본.used())
  })

  it('고침: 아웃 0~2 로 떨어지는 판(n ≥ t − 2)은 원본과 똑같다', () => {
    for (const 비율 of [0.5, 0.7, 0.99]) {
      const 원본 = withAutoStopLateInningSetup(끝내기판(), 차례난수([비율, 0.5, 0.5, 0.5]).random)
      setBugfixConfigForTests(bugfixConfigWith(['B-13']))
      const 고침 = withAutoStopLateInningSetup(끝내기판(), 차례난수([비율, 0.5, 0.5, 0.5]).random)
      setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)
      expect(원본.game.outs).toBeLessThanOrEqual(2)
      expect(고침.game).toEqual(원본.game)
    }
  })
})
