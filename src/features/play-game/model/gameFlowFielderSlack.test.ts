import { describe, expect, it } from 'vitest'
import { cpuPickoff, startGame, type GameProgress } from '@/features/play-game/model/gameFlow'
import { DEFENSE_SCENE_START } from '@/features/defense-play/model/defenseScene'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 야수 +0xcc 는 경기 장면 객체 쪽이라 판 사이로 남는다(`DefenseScene.fielderSlack`, r196) — 경기 흐름은 판이 남긴 수비 장면을
 * 다음 판 입력으로 넘기고(`scene: progress.defenseScene`), 판 결과의 장면을 다시 받는다(`defenseScene: result.scene`).
 */
describe('타자편 — 판 사이 야수 +0xcc 를 넘겨받는다', () => {
  it('파울 판이 남긴 5 를 CPU 견제(vt20(0) — b28ca)가 들고 연다 · 판이 끝난 값을 다시 받는다', () => {
    const 시작 = startGame(createSeededRandom(20100905))
    const 판: GameProgress = { ...시작, game: { ...시작.game, bases: { first: true, second: false, third: false } } }
    const 그냥 = cpuPickoff(판, 1, createSeededRandom(1), { count: { strikes: 0, balls: 0 } })
    const 남은 = cpuPickoff(
      { ...판, defenseScene: { ...DEFENSE_SCENE_START, fielderSlack: Array.from({ length: 9 }, () => 5) } },
      1,
      createSeededRandom(1),
      { count: { strikes: 0, balls: 0 } },
    )
    expect(남은.lastDefensePlay?.ticks[0]?.fielders).not.toEqual(그냥.lastDefensePlay?.ticks[0]?.fielders)
    expect(남은.defenseScene?.fielderSlack).toEqual(Array.from({ length: 9 }, () => 0))
  })
})
