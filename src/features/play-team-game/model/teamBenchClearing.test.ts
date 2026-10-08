import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  isHumanTurn,
  resolveBenchClearing,
  startBatterOutcome,
  startTeamGame,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

const 옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

/** 첫 굴림만 비율로 정하고 나머지는 씨앗에 맡긴다 — 굴림 수도 센다 */
function 첫굴림(value: number, seed: number) {
  const rest = createSeededRandom(seed)
  let first = true
  const counter = { count: 0 }
  const 고정 = createConstantRandom(value)
  const 이번 = (): RandomPort => {
    counter.count += 1
    if (!first) return rest
    first = false
    return 고정
  }
  const random: RandomPort = {
    rand: (lo, hi) => 이번().rand(lo, hi),
    rand9d: (n) => (n <= 0 ? 0 : 이번().rand9d(n)),
  }
  return { random, counter }
}

describe('팀 경기 벤치 클리어링 연출 (상태 0x1e) — 우리 타자가 맞음', () => {
  it('들어가면 굴림 1 + 진입 45 를 쓰고 연출에서 붙든다 — 그 동안 사람 차례가 아니다', () => {
    const progress = startTeamGame(옵션, createSeededRandom(5))
    const { random, counter } = 첫굴림(0, 9)
    const 들어감 = startBatterOutcome(progress, { kind: '사구' }, random)

    expect(counter.count).toBe(46)
    expect(들어감.pendingBenchClearing).toEqual({ side: '공격', outcome: { kind: '사구' } })
    expect(들어감.game).toEqual(progress.game)
    expect(isHumanTurn(들어감)).toBe(false)
  })

  it('끝나면 사구를 보통 길로 먹인다 — 틱 10 을 지났으면 그 앞에 굴림 8 번', () => {
    const progress = startTeamGame(옵션, createSeededRandom(5))
    const 들어감 = startBatterOutcome(progress, { kind: '사구' }, 첫굴림(0, 9).random)

    const 다봄 = resolveBenchClearing(들어감, { reachedTargetTick: true }, createSeededRandom(13))
    const 앞당김 = createSeededRandom(13)
    for (let 번 = 0; 번 < 8; 번 += 1) 앞당김.rand(0, 2)
    const 건너뜀 = resolveBenchClearing(들어감, { reachedTargetTick: false }, 앞당김)

    expect(다봄.pendingBenchClearing).toBeNull()
    expect(다봄.game).toEqual(건너뜀.game)
    expect(다봄.game.bases.first || 다봄.game.half !== progress.game.half).toBe(true)
  })
})
