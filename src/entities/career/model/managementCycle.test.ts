import { describe, expect, it } from 'vitest'
import { applyGameResult, createCareer, startNextSeason } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { blockReasonOf, runTraining } from '@/entities/career/model/training'
import { outingBlockReasonOf, restBlockReasonOf, runOuting, runRest } from '@/entities/career/model/outing'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'

/**
 * r_event_txt[176] "한번에 트레이닝, 휴식, 외출 중 딱 한 가지 일만 할 수 있으니"
 * r_event_txt[173] "단! 트레이닝이나 외출을 하면 사기가 떨어져."
 */
const 부자선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
  ...createCareer('테스트'),
  gamePoint: 9999,
  money: 9999,
  // 신인은 사기 100(최고)이라 휴식·외식이 막힌다 — 주기 규칙만 보려고 낮춰 둔다
  morale: 50,
  ...overrides,
})
const 히트 = TRAINING_MENUS[0]
const 외식 = OUTING_PLACES.flatMap((place) => place.functions).find((f) => f.id === '외식')!
const 경기결과 = { result: '승', stats: EMPTY_SEASON_STATS, recordIds: [] } as unknown as GameSummary

describe('관리 주기마다 한 가지만', () => {
  it('트레이닝을 하면 같은 주기에 트레이닝·휴식·외출을 더 할 수 없다', () => {
    const trained = runTraining(부자선수(), 히트, createSeededRandom(1)).career

    expect(blockReasonOf(trained, 히트)).toBe('이미행동함')
    expect(restBlockReasonOf(trained)).toBe('이미행동함')
    expect(outingBlockReasonOf(trained, 외식)).toBe('이미행동함')
  })

  it('휴식이나 외출도 한 번 하면 주기가 끝난다', () => {
    expect(restBlockReasonOf(runRest(부자선수(), createSeededRandom(1)).career)).toBe('이미행동함')
    expect(blockReasonOf(runOuting(부자선수(), 외식, createSeededRandom(1)), 히트)).toBe('이미행동함')
  })

  it('다음 관리 주기(2경기 뒤)가 열려야 다시 할 수 있다', () => {
    const rested = runRest(부자선수({ gamesPlayed: 2 }), createSeededRandom(1)).career
    const afterOneGame = applyGameResult(rested, 경기결과)
    expect(restBlockReasonOf(afterOneGame)).toBe('이미행동함')

    const afterTwoGames = applyGameResult(afterOneGame, 경기결과)
    expect(restBlockReasonOf(afterTwoGames)).toBeNull()
  })
})

describe('트레이닝은 사기를 깎는다', () => {
  it('사기가 줄어든다', () => {
    const before = 부자선수({ morale: 60 })
    const outcome = runTraining(before, 히트, createSeededRandom(1))

    expect(outcome.career.morale).toBe(60 - outcome.moraleLoss)
    // 신인은 병아리(0) 라 사기 감소가 1 줄어든다 (StrMODE[201])
    expect(outcome.moraleLoss).toBeGreaterThanOrEqual(4)
  })
})

describe('시즌 외출 횟수 — 칭호 "1년간 외출" 조건', () => {
  it('외출할 때마다 늘고 다음 시즌에 0 으로 돌아간다', () => {
    const outed = runOuting(부자선수(), 외식, createSeededRandom(1))
    expect(outed.outingsThisSeason).toBe(1)

    expect(startNextSeason(outed).outingsThisSeason).toBe(0)
  })
})

describe('한 경기 기록 — 칭호 조건', () => {
  it('사이클링 히트 경기와 한 경기 최다 홈런을 남긴다', () => {
    const cycle = {
      result: '승',
      stats: { ...EMPTY_SEASON_STATS, hits: 5, doubles: 1, triples: 1, homeRuns: 2 },
      recordIds: [],
    } as unknown as GameSummary
    const after = applyGameResult(부자선수(), cycle)

    expect(after.cycleHitGames).toBe(1)
    expect(after.bestHomeRunsInGame).toBe(2)
  })
})
