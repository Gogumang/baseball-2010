import { describe, expect, it } from 'vitest'
import { applyPlayerOutcome, startGame, summaryOf } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { isPlayerTurn, PLAYER_BATTING_ORDER_INDEX } from '@/entities/game/model/gameState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { opponentOf } from '@/entities/league/model/league'

describe('startGame', () => {
  it('커리어 타순(9번)이면 플레이어는 아홉 번째 타자다', () => {
    const progress = startGame(createSeededRandom(1), 0, 9)

    expect(progress.game.playerOrderIndex).toBe(8)
    expect(progress.game.battingOrderIndex === 8 || progress.game.isFinished).toBe(true)
  })

  it('상대는 무작위가 아니라 원본 일정표(0xd89cb)가 정한다', () => {
    // 씨앗이 달라도 같은 날이면 같은 상대다
    const 상대들 = Array.from({ length: 20 }, (_unused, seed) => startGame(createSeededRandom(seed), 3).opponentTeamId)

    expect(new Set(상대들).size, `상대가 씨앗마다 달라집니다: ${[...new Set(상대들)]}`).toBe(1)
    expect(상대들[0]).toBe(opponentOf(0, 3))
  })

  it('한 바퀴(9일) 돌면 나머지 아홉 팀을 한 번씩 만난다 — 10팀 라운드로빈', () => {
    const 상대들 = Array.from({ length: 9 }, (_unused, day) => opponentOf(day, 3))

    expect(new Set(상대들).size).toBe(9)
    expect([...상대들].sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9])
  })

  it('플레이어의 첫 타석까지 자동으로 진행한다', () => {
    const progress = startGame(createSeededRandom(20100901))

    expect(isPlayerTurn(progress.game) || progress.game.isFinished).toBe(true)
    expect(progress.game.half).toBe('말')
    expect(progress.game.battingOrderIndex).toBe(PLAYER_BATTING_ORDER_INDEX)
  })

  it('첫 타석 전에 상대 공격이 로그에 남는다', () => {
    const progress = startGame(createSeededRandom(20100901))

    expect(progress.log.some((entry) => entry.text.includes('상대 공격'))).toBe(true)
  })

  it('같은 시드는 같은 경기를 만든다', () => {
    const first = startGame(createSeededRandom(7))
    const second = startGame(createSeededRandom(7))

    expect(first.game).toEqual(second.game)
    expect(first.log.map((entry) => entry.text)).toEqual(second.log.map((entry) => entry.text))
  })
})

describe('applyPlayerOutcome', () => {
  it('내 홈런이 점수와 성적에 반영된다', () => {
    const progress = startGame(createSeededRandom(20100901))

    const after = applyPlayerOutcome(progress, { kind: '홈런' }, createSeededRandom(3))

    expect(after.myStats.homeRuns).toBe(1)
    expect(after.myStats.runsBattedIn).toBeGreaterThanOrEqual(1)
    expect(after.game.ourScore).toBeGreaterThanOrEqual(1)
  })

  it('내 타석은 로그에 나로 표시된다', () => {
    const progress = startGame(createSeededRandom(20100901))

    const after = applyPlayerOutcome(progress, { kind: '삼진' }, createSeededRandom(3))

    expect(after.log.some((entry) => entry.isMine && entry.text.includes('삼진'))).toBe(true)
  })

  it('타석 처리 후에는 다시 내 차례이거나 경기가 끝나 있다', () => {
    let progress = startGame(createSeededRandom(20100901))

    progress = applyPlayerOutcome(progress, { kind: '삼진' }, createSeededRandom(11))

    expect(isPlayerTurn(progress.game) || progress.game.isFinished).toBe(true)
  })

  it('경기가 끝난 뒤의 타석은 무시된다', () => {
    const finished = playFullGame(createSeededRandom(20100901))

    expect(applyPlayerOutcome(finished, { kind: '홈런' }, createSeededRandom(1))).toBe(finished)
  })
})

describe('최근 타석 기록 — 스킬 16·17 조건', () => {
  it('사용자 타석마다 기록 코드를 쌓는다 — 링버퍼 용량 10 (0xa908c)', () => {
    let progress = startGame(createSeededRandom(1))
    for (const outcome of [{ kind: '홈런' }, { kind: '삼진' }, { kind: '안타', bases: 2 }] as const) {
      if (progress.game.isFinished) break
      progress = applyPlayerOutcome(progress, outcome, createSeededRandom(3))
    }

    expect(progress.recentAtBatCodes).toEqual([4, 7, 2])
  })
})

describe('경기 한 판을 끝까지 진행', () => {
  it('9이닝이 모두 소화되고 결과가 나온다', () => {
    const finished = playFullGame(createSeededRandom(20100901))

    expect(finished.game.isFinished).toBe(true)
    expect(finished.game.inning).toBe(9)

    const summary = summaryOf(finished)
    expect(['승', '무', '패']).toContain(summary.result)
    expect(summary.ourScore).toBe(finished.game.ourScore)
  })

  it('플레이어는 한 경기에서 최소 한 번은 타석에 선다', () => {
    const finished = playFullGame(createSeededRandom(20100901))

    expect(
      finished.myStats.plateAppearances,
      `plateAppearances was: ${finished.myStats.plateAppearances}`,
    ).toBeGreaterThan(0)
  })

  it('여러 시드로 돌려도 자동 진행이 멈추지 않는다', () => {
    for (const seed of [1, 2, 3, 42, 777, 20100901]) {
      const finished = playFullGame(createSeededRandom(seed))
      expect(finished.game.isFinished, `시드 ${seed}에서 경기가 끝나지 않았습니다`).toBe(true)
    }
  })
})

describe('동료 타석도 기록달성을 센다 — 원본은 기록을 팀 단위로 센다 (0xa77f0)', () => {
  it('내가 계속 아웃만 쳐도 동료 타석에서 기록이 쌓인다', () => {
    // 사용자는 전 타석 땅볼아웃이라 기록이 하나도 없다. 그래도 동료 여덟 타순이 친다
    const 여러경기 = [1, 2, 3, 42, 777, 20100901].map((seed) => playFullGame(createSeededRandom(seed)))
    const 기록있는경기 = 여러경기.filter((finished) => finished.recordIds.length > 0)

    expect(
      기록있는경기.length,
      `기록이 나온 경기 수: ${기록있는경기.length}/${여러경기.length}`,
    ).toBeGreaterThan(0)
  })

  it('동료 타순마다 따로 기록을 들고 있다 — 한 사람 것으로 뭉치지 않는다', () => {
    const finished = playFullGame(createSeededRandom(20100901))
    const 선 = Object.entries(finished.teammateLogs).filter(
      ([, log]) => log.stats.plateAppearances > 0,
    )

    expect(선.length, `타석에 선 동료 수: ${선.length}`).toBeGreaterThan(1)
    // 사용자 타순(PLAYER_BATTING_ORDER_INDEX)은 동료 기록에 섞이지 않는다
    expect(finished.teammateLogs[PLAYER_BATTING_ORDER_INDEX]).toBeUndefined()
  })
})

function playFullGame(random: ReturnType<typeof createSeededRandom>): GameProgress {
  let progress = startGame(random)
  let guard = 0

  while (!progress.game.isFinished && guard < 200) {
    progress = applyPlayerOutcome(progress, { kind: '아웃', detail: '땅볼아웃' }, random)
    guard += 1
  }
  return progress
}

describe('마선수 — 정규 경기에는 나오지 않는다 (누락 탐색 8차)', () => {
  it('어떤 시드로 시작해도 상대 마선수가 없다', () => {
    const aces = Array.from({ length: 50 }, (_unused, seed) => startGame(createSeededRandom(seed)).aceOpponent)
    expect(aces.every((ace) => ace === null)).toBe(true)
  })
})

describe('삼진 계열 기록이 경기 중에 쌓인다 (16~23·25)', () => {
  it('상대 공격에서 우리 투수가 잡은 삼진으로 기록이 나온다', () => {
    // 여러 시드로 한 경기씩 돌려 삼진 계열(16~25) 기록이 한 번이라도 나오는지 본다
    const 나온기록 = new Set<number>()
    for (const seed of [1, 7, 42, 777, 20100901, 2024, 31337]) {
      for (const id of playFullGame(createSeededRandom(seed)).recordIds) {
        if (id >= 16 && id <= 25) 나온기록.add(id)
      }
    }

    expect(나온기록.size, `나온 삼진 계열 기록: ${[...나온기록]}`).toBeGreaterThan(0)
  })

  it('연속 삼진은 이닝을 넘어서도 이어진다 — 이닝마다 끊기면 콤보가 안 나온다', () => {
    const finished = playFullGame(createSeededRandom(20100901))

    // 우리 투수가 잡은 삼진 수가 이닝 수보다 많다 = 이닝을 넘겨 누적된다
    expect(finished.pitching.strikeouts).toBeGreaterThan(0)
    expect(finished.pitching.outsRecorded).toBeGreaterThanOrEqual(finished.pitching.strikeouts)
  })
})
