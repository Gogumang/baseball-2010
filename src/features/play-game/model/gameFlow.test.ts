import { describe, expect, it } from 'vitest'
import {
  applyPlayerOutcome,
  cpuPickoff,
  opponentPitcherAbilityOf,
  resolveDefensePlay,
  startGame,
  startPlayerOutcome,
  stealBase,
  summaryOf,
  resolveBenchClearing,
  throwOpponentPitch,
} from '@/features/play-game/model/gameFlow'
import { EMPTY_AT_BAT_PITCH_TALLY, tallyPitch } from '@/features/play-at-bat/model/atBatPitchTally'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { gamePointRewardOf } from '@/entities/career/model/playerCareer'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { isPlayerTurn, PLAYER_BATTING_ORDER_INDEX, PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { opponentOf } from '@/entities/league/model/league'
import { advanceRunners, EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPickoffPlayResult, PICKOFF_RESULT } from '@/features/defense-play/model/pickoffPlay'

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
  it('9이닝이 모두 소화되고 결과가 나온다 (동점이면 연장)', () => {
    const finished = playFullGame(createSeededRandom(20100901))

    expect(finished.game.isFinished).toBe(true)
    // 이 시드가 딱 9회에 끝나는 것을 못박고 있었는데, 두 가지가 바뀌며 같은 시드가 연장으로 갔다:
    //   ① 돌발미션을 **모든 타석 준비**에서 굴리게 되어 난수 차례가 밀렸다 (K 4절 1-6)
    //   ② 간이 엔진 타석에서 희생플라이를 뺐다 — 원본 간이 엔진에는 없다 (E-2 확정)
    // 규칙으로 말할 수 있는 것은 "정규 9이닝을 다 치른다" 뿐이다 (연장 상한은 원본에 없다).
    expect(finished.game.inning).toBeGreaterThanOrEqual(9)

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

describe('사람 타석은 수비 시뮬레이션을 돌린다 — CPU 간이 엔진(0xc11f0)은 그대로 둔다', () => {
  /** 원하는 루 상황·아웃으로 사용자 타석 하나를 만든다 */
  function 내타석(bases: BaseState, outs: number): GameProgress {
    const progress = startGame(createSeededRandom(20100901))
    return { ...progress, game: { ...progress.game, bases, outs, half: '말' } }
  }

  it('인플레이 타구면 매 틱 화면 스냅샷이 남는다', () => {
    const after = applyPlayerOutcome(
      내타석(EMPTY_BASES, 0),
      { kind: '아웃', detail: '땅볼아웃' },
      createSeededRandom(3),
    )

    expect(after.lastDefensePlay).not.toBeNull()
    expect(after.lastDefensePlay!.ticks.length).toBeGreaterThan(1)
    expect(after.lastDefensePlay!.ticks[0].fielders).toHaveLength(9)
  })

  it('삼진·볼넷은 수비가 돌 일이 없다', () => {
    const after = applyPlayerOutcome(내타석(EMPTY_BASES, 0), { kind: '삼진' }, createSeededRandom(3))

    expect(after.lastDefensePlay).toBeNull()
  })

  it('홈런도 공이 날아가는 그림이 나온다 — 점수는 지금까지와 똑같다', () => {
    const 만루 = { first: true, second: true, third: true }
    const after = applyPlayerOutcome(내타석(만루, 0), { kind: '홈런' }, createSeededRandom(3))

    const play = after.lastDefensePlay
    expect(play).not.toBeNull()
    // 다른 타구(땅볼 31 · 뜬공 37~45 · 3루타 72틱)와 비슷한 길이여야 스쳐 지나가지도 지루하지도 않다
    expect(play!.ticks.length).toBeGreaterThanOrEqual(40)
    expect(play!.ticks.length).toBeLessThanOrEqual(80)
    // 만루 홈런은 4타점 — 재생을 붙였다고 점수 계산이 달라지면 안 된다
    expect(after.myStats.runsBattedIn).toBe(4)
    // 마지막 틱에는 타자주자까지 넷 모두 홈에 서 있다
    const 마지막 = play!.ticks[play!.ticks.length - 1]
    expect(마지막.runners).toHaveLength(4)
    expect(마지막.runners.every((runner) => runner.base === 0)).toBe(true)
  })

  it('깊은 뜬공은 3루 주자를 불러들이고, 얕은 뜬공은 못 불러들인다 (희생플라이 보장 제거)', () => {
    const 깊은뜬공: BattedBallPattern = [90, 900, 1500, 0]
    const 얕은뜬공: BattedBallPattern = [90, 250, 700, 0]
    const 시작 = 내타석({ first: false, second: false, third: true }, 0)
    const 뜬공아웃 = { kind: '아웃', detail: '뜬공아웃' } as const

    // 타석 뒤에는 동료 타석이 이어져 점수가 더 붙으므로, 이 타구가 만든 결과만 본다
    const 깊게 = applyPlayerOutcome(시작, 뜬공아웃, createSeededRandom(3), { pattern: 깊은뜬공 })
    const 얕게 = applyPlayerOutcome(시작, 뜬공아웃, createSeededRandom(3), { pattern: 얕은뜬공 })

    expect(깊게.lastDefensePlay!.advance).toMatchObject({ runsScored: 1, outsAdded: 1 })
    expect(얕게.lastDefensePlay!.advance).toMatchObject({
      runsScored: 0,
      outsAdded: 1,
      bases: { first: false, second: false, third: true },
    })
  })

  /**
   * S2 2-5: **타자주자가 아웃이 되어 그 플레이로 3아웃이 되면 주자 득점이 0 이다.**
   *
   * ⚠️ 예전에는 대조군으로 **땅볼**을 썼다. 포구 반경(0xb12d0)이 되살아나면서 평범한 주자(주력 500)는
   * 무사 땅볼에서도 홈 송구에 잡히게 되어, 0아웃 쪽이 0 점이 된 것이 **규칙 때문이 아니라 송구 때문**이라
   * 대조가 성립하지 않았다. 득점이 실제로 나는 **깊은 뜬공**(희생플라이)으로 바꿨다.
   */
  it('2아웃에 타자주자가 죽으면 3루 주자 득점이 무효가 된다 (S2 2-5)', () => {
    const 깊은뜬공: BattedBallPattern = [90, 900, 1500, 0]
    const 뜬공아웃 = { kind: '아웃', detail: '뜬공아웃' } as const
    const 무사 = 내타석({ first: false, second: false, third: true }, 0)
    const 이사 = 내타석({ first: false, second: false, third: true }, 2)

    expect(
      applyPlayerOutcome(무사, 뜬공아웃, createSeededRandom(3), { pattern: 깊은뜬공 })
        .lastDefensePlay!.advance.runsScored,
    ).toBe(1)
    // 2아웃이면 같은 타구인데도 점수가 0 이다
    expect(
      applyPlayerOutcome(이사, 뜬공아웃, createSeededRandom(3), { pattern: 깊은뜬공 })
        .lastDefensePlay!.advance.runsScored,
    ).toBe(0)
  })

  it('CPU 간이 엔진은 손대지 않았다 — advanceRunners 의 근사는 그대로다', () => {
    const 주자3루: BaseState = { first: false, second: false, third: true }
    // quickEngine 은 뜬공에 주자를 안 움직이고, 기본 갈래는 희생플라이 근사를 그대로 둔다
    expect(
      advanceRunners(주자3루, { kind: '아웃', detail: '뜬공아웃' }, 0, { quickEngine: true }),
    ).toEqual({ bases: 주자3루, runsScored: 0, outsAdded: 1 })
    expect(advanceRunners(주자3루, { kind: '아웃', detail: '뜬공아웃' }, 0).runsScored).toBe(1)
  })
})

describe('주자 처리는 수비 화면이 끝나야 정해진다 (상태 0x17 이 도는 동안은 붙들어 둔다)', () => {
  function 내타석(bases: BaseState, outs: number): GameProgress {
    const progress = startGame(createSeededRandom(20100901))
    return { ...progress, game: { ...progress.game, bases, outs, half: '말' } }
  }

  it('인플레이 타구는 타구만 들고 멈춘다 — 진루·아웃·득점이 하나도 안 먹는다', () => {
    const 시작 = 내타석({ first: true, second: false, third: true }, 0)

    const 진행중 = startPlayerOutcome(시작, { kind: '아웃', detail: '땅볼아웃' }, createSeededRandom(3))

    expect(진행중.pendingDefensePlay).not.toBeNull()
    expect(진행중.pendingDefensePlay!.outcome).toEqual({ kind: '아웃', detail: '땅볼아웃' })
    // 투구 때의 루 상황·아웃을 그대로 들고 간다
    expect(진행중.pendingDefensePlay!.bases).toEqual({ first: true, second: false, third: true })
    expect(진행중.pendingDefensePlay!.outs).toBe(0)
    // 경기 상태는 한 톨도 안 바뀐다 — 다음 타석도 시작되지 않았다
    expect(진행중.game).toEqual(시작.game)
    expect(진행중.myStats).toEqual(시작.myStats)
    expect(진행중.log).toEqual(시작.log)
  })

  it('화면이 돌린 결과를 먹이면 그때 진루·아웃이 정해지고 칸이 비워진다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 진행중 = startPlayerOutcome(시작, { kind: '안타', bases: 2 }, createSeededRandom(3))
    const 결과 = runDefensePlay(진행중.pendingDefensePlay!)

    const 끝 = resolveDefensePlay(진행중, 결과, createSeededRandom(3))

    expect(끝.pendingDefensePlay).toBeNull()
    expect(끝.myStats.hits).toBe(1)
    // 이미 눈으로 다 본 플레이라 재생거리로 남기지 않는다 — 남기면 같은 장면을 한 번 더 튼다
    expect(끝.lastDefensePlay).toBeNull()
  })

  it('붙들려 있는 동안 타석 결과 코드는 이미 정해져 있다 — 뒤로 미룬 것은 주자 처리뿐이다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 진행중 = startPlayerOutcome(시작, { kind: '안타', bases: 1 }, createSeededRandom(3))

    expect(진행중.pendingDefensePlay!.outcome).toEqual({ kind: '안타', bases: 1 })
    expect(진행중.myStats.hits).toBe(0)
  })

  it('삼진·볼넷·홈런은 붙들 것이 없어 곧장 끝난다', () => {
    for (const outcome of [{ kind: '삼진' }, { kind: '볼넷' }, { kind: '홈런' }] as const) {
      const 끝 = startPlayerOutcome(내타석(EMPTY_BASES, 0), outcome, createSeededRandom(3))
      expect(끝.pendingDefensePlay, `${outcome.kind}`).toBeNull()
    }
  })

  it('둘로 쪼갠 길과 한 번에 돌리는 길의 결과가 같다 — 난수 차례도 같다', () => {
    const 시작 = 내타석({ first: false, second: false, third: true }, 0)
    const 뜬공아웃 = { kind: '아웃', detail: '뜬공아웃' } as const

    const 한번에 = applyPlayerOutcome(시작, 뜬공아웃, createSeededRandom(3))
    const 쪼개서 = (() => {
      const random = createSeededRandom(3)
      const 진행중 = startPlayerOutcome(시작, 뜬공아웃, random)
      return resolveDefensePlay(진행중, runDefensePlay(진행중.pendingDefensePlay!), random)
    })()

    expect(쪼개서.game).toEqual(한번에.game)
    expect(쪼개서.myStats).toEqual(한번에.myStats)
    expect(쪼개서.log.map((entry) => entry.text)).toEqual(한번에.log.map((entry) => entry.text))
  })
})

describe('환경설정 "주루" 가 나만의리그 타자편에도 먹는다 (설정 +0xbd · 0xae690)', () => {
  // 원본 배선(매 틱 도는 경기 장면 슬롯 2 = 0x524c0 안):
  //   5261c: 설정 = 0x1f1d8([0x1400054])   /  52628: r1 = 설정+0xbd  /  5262e: 0xae690([장면+0x214], r1)
  //          = (경기[0x31 + 경기[9](공격측)] == 1) || (설정+0xbd != 0)
  //   그 값이 0 이면 52660 의 자동 진루 제어기(0xaf8c0 = vt8 = 0xaf918)를 통째로 안 돌린다.
  // 타자편은 사람이 늘 공격이라 앞 항이 늘 거짓 → 설정이 그대로 먹는다.
  const 깊은뜬공: BattedBallPattern = [90, 900, 1500, 0]
  const 땅볼: BattedBallPattern = [45, 300, 200, 0]
  const 뜬공아웃 = { kind: '아웃', detail: '뜬공아웃' } as const

  function 내타석(bases: BaseState, outs: number, runningModeManual?: boolean): GameProgress {
    const progress = startGame(createSeededRandom(20100901), 0, undefined, undefined, undefined, 0, runningModeManual)
    return { ...progress, game: { ...progress.game, bases, outs, half: '말' } }
  }

  it('안 넘기면 자동이다 — 지금까지와 한 톨도 다르지 않다', () => {
    const 기본 = startGame(createSeededRandom(20100901))

    expect(기본.runningModeManual).toBe(false)
  })

  it('타구에 실어 보내는 값은 "사람 공격 + 설정" 이다 (0xae690 의 두 항)', () => {
    const 자동 = startPlayerOutcome(내타석(EMPTY_BASES, 0, false), 뜬공아웃, createSeededRandom(3), { pattern: 깊은뜬공 })
    const 수동 = startPlayerOutcome(내타석(EMPTY_BASES, 0, true), 뜬공아웃, createSeededRandom(3), { pattern: 깊은뜬공 })

    // 타자편은 사람이 늘 공격이다 — 앞 항은 언제나 거짓이다
    expect(자동.pendingDefensePlay!.offenseIsCpu).toBe(false)
    expect(수동.pendingDefensePlay!.offenseIsCpu).toBe(false)
    expect(자동.pendingDefensePlay!.runningMode).toBe('자동')
    expect(수동.pendingDefensePlay!.runningMode).toBe('수동')
  })

  const 돌려보기 = (bases: BaseState, outs: number, manual: boolean, outcome: AtBatOutcome, pattern: BattedBallPattern) => {
    const 진행중 = startPlayerOutcome(내타석(bases, outs, manual), outcome, createSeededRandom(3), { pattern })
    return runDefensePlay(진행중.pendingDefensePlay!).advance
  }

  it('수동이면 태그업을 안 한다 — 3루 주자가 그 자리에 선다', () => {
    const 주자3루: BaseState = { first: false, second: false, third: true }

    expect(돌려보기(주자3루, 0, false, 뜬공아웃, 깊은뜬공)).toMatchObject({ runsScored: 1, outsAdded: 1 })
    expect(돌려보기(주자3루, 0, true, 뜬공아웃, 깊은뜬공)).toMatchObject({
      runsScored: 0,
      outsAdded: 1,
      bases: 주자3루,
    })
  })

  it('수동이면 태그업을 시도하다 잡히는 일도 없다 — 2·3루 1아웃 깊은 뜬공', () => {
    const 주자23루: BaseState = { first: false, second: true, third: true }

    // 자동은 둘 다 리터치한 뒤 한 루씩 간다 — 3루 주자가 홈을 밟고 2루 주자가 3루에 선다.
    // ⚠️ 예전에는 여기서 아웃이 하나 더 붙었다. 그것은 이 모델이 요구 루(+0x88)를 **한 번도
    //    안 풀어 주던** 탓이다 — 원본 0xa040c 는 도착 때 `+0x8c == +0x88` 이면 +0x88 = −1 로
    //    푼다(0xaa0a8 도 같은 일을 한다). 리터치를 즉시 성립으로 보는 이 모델에서는 되밟는
    //    순간 포스가 풀리므로 **리터치를 마친 주자를 제 루에서 다시 잡을 수 없다.**
    expect(돌려보기(주자23루, 1, false, 뜬공아웃, 깊은뜬공)).toMatchObject({
      outsAdded: 1,
      runsScored: 1,
      bases: { first: false, second: false, third: true },
    })
    // 수동은 아무도 안 뛰므로 뜬공 아웃 하나로 끝나고 루 상황이 그대로다
    expect(돌려보기(주자23루, 1, true, 뜬공아웃, 깊은뜬공)).toMatchObject({
      outsAdded: 1,
      runsScored: 0,
      bases: 주자23루,
    })
  })

  it('⚠️ 수동이어도 포스(밀려 뛰기)는 그대로 간다 — 자동 제어기와 무관한 자리다', () => {
    const 주자1루: BaseState = { first: true, second: false, third: false }
    const 만루: BaseState = { first: true, second: true, third: true }
    const 땅볼아웃 = { kind: '아웃', detail: '땅볼아웃' } as const

    expect(돌려보기(주자1루, 0, true, 땅볼아웃, 땅볼)).toEqual(돌려보기(주자1루, 0, false, 땅볼아웃, 땅볼))
    expect(돌려보기(만루, 0, true, 땅볼아웃, 땅볼)).toEqual(돌려보기(만루, 0, false, 땅볼아웃, 땅볼))
    // 만루 땅볼은 어느 쪽이든 3루 주자가 밀려 들어온다
    expect(돌려보기(만루, 0, true, 땅볼아웃, 땅볼).runsScored).toBe(1)
  })

  it('난수 굴림 차례는 수동/자동에 한 톨도 안 흔들린다', () => {
    const 굴림수 = (manual: boolean) => {
      let calls = 0
      let seed = 12345
      const 하나 = () => {
        calls += 1
        seed = (seed * 1664525 + 1013904223) >>> 0
        return (seed >>> 8) / 0x1000000
      }
      const random = {
        next: 하나,
        nextInRange: (minimum: number, maximum: number) => minimum + 하나() * (maximum - minimum),
        pick: <T,>(candidates: readonly T[]) => candidates[Math.floor(하나() * candidates.length)],
      }
      const 시작 = 내타석({ first: true, second: true, third: true }, 0, manual)
      const 진행중 = startPlayerOutcome(시작, { kind: '안타', bases: 1 }, random, { pattern: 땅볼 })
      runDefensePlay({ ...진행중.pendingDefensePlay!, random })
      return calls
    }

    expect(굴림수(true)).toBe(굴림수(false))
  })
})

describe('사람이 선공일 때 (측 0) — 설정 레코드 +8 (0x30f44)', () => {
  it('측 0 이면 1회초부터 내 타석이고, 상대 공격이 아직 로그에 없다', () => {
    const progress = startGame(createSeededRandom(20100901), 0, undefined, undefined, PLAYER_SIDE_FIRST_BAT)

    expect(progress.game.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)
    expect(progress.game.half).toBe('초')
    expect(isPlayerTurn(progress.game)).toBe(true)
    expect(progress.log.some((entry) => entry.text.includes('상대 공격'))).toBe(false)
  })

  it('측 0 으로도 경기가 끝까지 돌아간다', () => {
    const random = createSeededRandom(20100901)
    let progress = startGame(random, 0, undefined, undefined, PLAYER_SIDE_FIRST_BAT)
    let guard = 0

    while (!progress.game.isFinished && guard < 200) {
      progress = applyPlayerOutcome(progress, { kind: '아웃', detail: '땅볼아웃' }, random)
      guard += 1
    }

    expect(progress.game.isFinished).toBe(true)
    expect(progress.myStats.plateAppearances).toBeGreaterThan(0)
  })
})

describe('나만의리그 타자편(모드 4) 선발은 4인 로테이션이다 (0x1c46c → 0xb8c80)', () => {
  const 선발 = (dayCounter: number, seed: number) =>
    startGame(createSeededRandom(seed), 0, 9, opponentOf(dayCounter, 0), PLAYER_SIDE_FIRST_BAT, dayCounter)

  it('네 경기를 연달아 치르면 선발이 0 → 1 → 2 → 3 으로 돌고 다섯째 날 다시 0 이다', () => {
    const 칸들 = [0, 1, 2, 3, 4].map((day) => 선발(day, 20100901).ourStartingPitcherIndex)

    expect(칸들).toEqual([0, 1, 2, 3, 0])
  })

  it('양 팀이 같이 돌고, 씨앗이 달라도 같은 칸이다 — 무작위가 아니다', () => {
    for (const day of [0, 1, 2, 3, 6]) {
      const 갑 = 선발(day, 1)
      const 을 = 선발(day, 999)

      expect(갑.opponentStartingPitcherIndex, `${day}일차`).toBe(갑.ourStartingPitcherIndex)
      expect(을.ourStartingPitcherIndex).toBe(갑.ourStartingPitcherIndex)
      expect(을.opponentStartingPitcherIndex).toBe(갑.opponentStartingPitcherIndex)
    }
  })

  it('날짜를 안 넘기면 시즌 첫 경기(g == 0)와 같아 두 팀 다 로스터 0번이다', () => {
    const progress = startGame(createSeededRandom(20100901))

    expect(progress.ourStartingPitcherIndex).toBe(0)
    expect(progress.opponentStartingPitcherIndex).toBe(0)
  })
})

describe('상대 타순은 이닝을 넘어 이어진다 (team+0x32 · 0xaf020 · 0xaebe4, E 3b)', () => {
  /** 상대 팀 타석만 골라 낸다 — 우리 팀 동료 타석도 같은 목록에 쌓인다 */
  const 상대타석 = (progress: GameProgress) =>
    progress.leaguePlateAppearances.filter((appearance) => appearance.teamId === progress.opponentTeamId)

  it('2회초 상대 첫 타자는 1회초 마지막 타자 다음 번이다 — 1번부터 다시가 아니다', () => {
    for (const seed of [1, 7, 20100901]) {
      let progress = startGame(createSeededRandom(seed))
      // 사람은 후공(측 1)이라 첫 타석 전에 1회초가 끝나 있다
      const 일회 = 상대타석(progress).length
      expect(progress.opponentOrderIndex, `씨앗 ${seed}`).toBe(일회 % 9)

      const random = createSeededRandom(seed + 1)
      while (!progress.game.isFinished && 상대타석(progress).length === 일회) {
        progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
      }
      const 이회첫타자 = 상대타석(progress)[일회]
      expect(이회첫타자.battingOrderIndex, `씨앗 ${seed}`).toBe(일회 % 9)
    }
  })

  it('상대 타순은 아홉 칸만 돈다 — 로스터 뒤 셋(벤치)은 CPU 대타로 들어온 한 명 말고는 안 선다', () => {
    for (let seed = 30; seed < 40; seed += 1) {
      const random = createSeededRandom(seed)
      let progress = startGame(random)
      while (!progress.game.isFinished) progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)

      const 칸들 = 상대타석(progress).map((appearance) => appearance.battingOrderIndex)
      // 대타(0xac228)가 들어온 타순 칸은 그 뒤로 벤치 선수의 로스터 칸(9~11)으로 적힌다
      칸들.forEach((칸, index) => {
        expect(칸 === index % 9 || 칸 >= 9, `씨앗 ${seed} ${index}번째 타석`).toBe(true)
      })
      // 벤치에서 나와 타석에 선 선수는 쓴 대타 수(벤치 수 team+0x28c 가 준 만큼)를 넘지 않는다 —
      // state[0xe] 는 공마다 내려가(0xa5e14 a5e7c) 대타는 경기에 여러 번 나올 수 있다
      expect(new Set(칸들.filter((칸) => 칸 >= 9)).size).toBeLessThanOrEqual(3 - progress.opponentLineup.benchBatters)
    }
  })
})

describe('타자편 경기에서도 양 팀 투수가 지치고 바뀐다 (0xc1ba4 → 0xac428 · 0xa5e14 · 0x3d954)', () => {
  const 끝까지 = (seed: number, outcome: AtBatOutcome) => {
    const random = createSeededRandom(seed)
    let progress = startGame(random, 3)
    while (!progress.game.isFinished) progress = applyPlayerOutcome(progress, outcome, random)
    return progress
  }

  it('선발이 마운드에서 시작하고, 상대 투수는 동료 타석에 던진 만큼 지친다', () => {
    const progress = startGame(createSeededRandom(20100901), 3)

    expect(progress.ourMound.pitcherSlot).toBe(progress.ourStartingPitcherIndex)
    // 1회초 상대 공격을 우리 투수가 던졌다
    expect(progress.ourMound.pitches).toBeGreaterThan(0)
    expect(progress.ourMound.stamina).toBeLessThan(10_000)
  })

  it('동료 간이 타석이 상대 투수 투구 수·스태미나를 깎는다', () => {
    const random = createSeededRandom(5)
    let progress = startGame(random, 3)
    progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
    // 내 다음 타석까지 동료 여덟 명 중 몇은 쳤다(또는 이닝이 바뀌었다)
    const 투구 = progress.opponentMound.pitches + progress.opponentMound.usedSlots.length

    expect(투구).toBeGreaterThan(0)
  })

  it('여러 경기를 돌리면 양 팀 모두 교체가 나온다 — 예전엔 선발이 끝까지 던졌다', () => {
    let 상대교체 = 0
    let 우리교체 = 0
    for (let seed = 1; seed <= 20; seed += 1) {
      const progress = 끝까지(seed, { kind: '홈런' })
      상대교체 += progress.opponentMound.usedSlots.length
      우리교체 += progress.ourMound.usedSlots.length
    }

    expect(상대교체).toBeGreaterThan(0)
    expect(우리교체).toBeGreaterThan(0)
  })

  it('내 타석 점수도 상대 투수 실점 B 에 붙는다', () => {
    const random = createSeededRandom(11)
    let progress = startGame(random, 3)
    const 투수 = progress.opponentMound.pitcherSlot
    const 실점전 = progress.opponentMound.runsAllowed
    const 점수전 = progress.game.ourScore
    progress = applyPlayerOutcome(progress, { kind: '홈런' }, random)
    if (progress.opponentMound.pitcherSlot !== 투수) return // 그 사이 바뀌었으면 카운터가 0 으로 밀렸다

    // 홈런 뒤 동료 타석·다음 이닝 점수도 같은 투수에게 붙으므로 '적어도' 내 점수만큼은 늘었다
    expect(progress.opponentMound.runsAllowed - 실점전).toBeGreaterThanOrEqual(1)
    expect(progress.game.ourScore - 점수전).toBeGreaterThanOrEqual(1)
  })
})

describe('타자편 경기에도 CPU 대타가 나온다 (0xc1ba4 → 0xac228)', () => {
  it('state[0xe] 는 공마다 내려간다(0xa5e14 a5e7c) — 한 경기에 여러 번 나올 수 있다', () => {
    let 대타경기 = 0
    let 여러번 = 0
    for (let seed = 1; seed <= 20; seed += 1) {
      const random = createSeededRandom(seed)
      let progress = startGame(random, 2)
      while (!progress.game.isFinished) {
        progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
      }
      // 로그는 최근 40줄만 남으므로 명단으로 센다 — 벤치가 줄어든 만큼이 그 팀이 쓴 대타다
      const 대타수 = (3 - progress.ourLineup.benchBatters) + (3 - progress.opponentLineup.benchBatters)
      if (대타수 > 0) 대타경기 += 1
      if (대타수 >= 2) 여러번 += 1
    }
    expect(대타경기).toBeGreaterThan(0)
    // 예전 "경기에 한 번" 이면 나올 수 없는 경기가 실제로 있다
    expect(여러번).toBeGreaterThan(0)
  })

  it('나는 대타로 안 바뀐다 — 내 타순 칸은 늘 내 자리다', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const random = createSeededRandom(seed)
      let progress = startGame(random, 2)
      while (!progress.game.isFinished) progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
      const 내칸 = progress.game.playerOrderIndex

      expect(progress.ourLineup.rosterSlots[내칸], `씨앗 ${seed}`).toBe(내칸)
    }
  })
})

describe('기록달성 남은 것 — 타자편 배선 (6·7 백투백 · 8·24 도루 · 32·33 연속 파울)', () => {
  /** 플레이어 차례가 올 때까지 — 아웃이 아니라 볼넷으로 버티면 경기가 길어지니 그냥 아웃으로 넘긴다 */
  const 내차례들 = (seed: number, 결과: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }) => {
    const random = createSeededRandom(seed)
    const 차례: GameProgress[] = []
    let progress = startGame(random)
    while (!progress.game.isFinished && 차례.length < 60) {
      차례.push(progress)
      progress = applyPlayerOutcome(progress, 결과, random)
    }
    return { 차례, 끝: progress }
  }

  it('6 백투백 — 앞 타석까지 팀 홈런 하나가 이어졌으면 내 홈런에 6 이 붙는다 (0xa794c)', () => {
    const random = createSeededRandom(5)
    const 시작 = { ...startGame(random), homeRunStreak: 1 }
    const n = 시작.recordIds.length
    const 뒤 = applyPlayerOutcome(시작, { kind: '홈런' }, random)

    // 내 타석 기록 = [홈런 단계 1~4, 6] — 이 경기 첫 안타·첫 홈런이라 연타석·멀티홈런은 없다
    const [단계, 백투백] = 뒤.recordIds.slice(n, n + 2)
    expect(단계).toBeGreaterThanOrEqual(1)
    expect(단계).toBeLessThanOrEqual(4)
    expect(백투백).toBe(6)
  })

  it('7 백투백투백 — 둘이 이어졌으면 7 을 주고 카운터를 0 으로', () => {
    const random = createSeededRandom(5)
    const 시작 = { ...startGame(random), homeRunStreak: 2 }
    const n = 시작.recordIds.length
    const 뒤 = applyPlayerOutcome(시작, { kind: '홈런' }, random)

    expect(뒤.recordIds.slice(n, n + 2)[1]).toBe(7)
  })

  it('카운터 없이 친 홈런에는 6·7 이 안 붙는다', () => {
    const random = createSeededRandom(5)
    const 시작 = startGame(random)
    const n = 시작.recordIds.length
    const 뒤 = applyPlayerOutcome(시작, { kind: '홈런' }, random)

    expect(뒤.recordIds.slice(n, n + 2)).not.toContain(6)
  })

  it('내 차례의 카운터 = 직전에 이어진 동료 홈런 수 (mod 3) — 상대 공격·홈런 아닌 타석이 끊는다', () => {
    let 홈런이어짐 = 0
    for (const seed of [1, 2, 3, 7, 42, 777, 20100901]) {
      for (const progress of 내차례들(seed, { kind: '홈런' }).차례) {
        // 로그는 새것이 앞이다 — 내 타석·상대 공격·홈런 아닌 동료 타석에서 멈춘다 (교체·대타 줄은 건너뛴다)
        let 이어짐 = 0
        for (const entry of progress.log) {
          if (!entry.text.includes(' — ')) continue
          if (entry.isMine || entry.text.includes('상대 공격')) {
            if (entry.isMine && entry.text.includes('홈런')) 이어짐 += 1
            if (entry.text.includes('상대 공격') || !entry.text.includes('홈런')) break
            continue
          }
          if (!entry.text.endsWith('홈런') && !/홈런 \(\d+점\)$/.test(entry.text)) break
          이어짐 += 1
        }
        if (이어짐 > 0) 홈런이어짐 += 1
        expect(progress.homeRunStreak, `씨앗 ${seed} · ${progress.log[0]?.text}`).toBe(이어짐 % 3)
      }
    }
    expect(홈런이어짐).toBeGreaterThan(0)
  })

  it('6·7 금액이 경기 끝 G 수입(0x4ea0c)에 들어간다', () => {
    const random = createSeededRandom(5)
    const 시작 = { ...startGame(random), homeRunStreak: 1 }
    const 뒤 = applyPlayerOutcome(시작, { kind: '홈런' }, random)
    let progress = 뒤
    while (!progress.game.isFinished) progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)
    const summary = summaryOf(progress)

    expect(summary.recordIds).toContain(6)
    expect(gamePointRewardOf(summary)).toBe(recordGamePointsOf(summary.recordIds))
    expect(gamePointRewardOf(summary)).toBeGreaterThanOrEqual(20)
  })

  it('8 도루 성공 — 내 팀 공격 중 도루가 살면 기록 8, 잡히면 24 후보는 게이트(0xa77f0)에서 버린다', () => {
    let 성공 = 0
    let 실패 = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = createSeededRandom(seed)
      const 시작 = startGame(random)
      // 1루에 주자를 세우고(2루 빈칸) 도루를 건다
      const 주자있음: GameProgress = {
        ...시작,
        game: { ...시작.game, bases: { first: true, second: false, third: false } },
      }
      const n = 주자있음.recordIds.length
      const 뒤 = stealBase(주자있음, 1, random)
      const 새기록 = 뒤.recordIds.slice(n)
      if (뒤.log[0]?.text.includes('도루 성공')) {
        성공 += 1
        expect(새기록).toEqual([8])
      } else {
        실패 += 1
        expect(새기록).toEqual([])
      }
    }
    expect(성공).toBeGreaterThan(0)
    expect(실패).toBeGreaterThan(0)
  })

  it('8 은 G 2 — 도루 하나가 경기 끝 수입을 2 올린다', () => {
    expect(recordGamePointsOf([8])).toBe(2)
    expect(recordGamePointsOf([24])).toBe(3)
  })

  it('32·33 연속 파울 — 타석 집계가 넘긴 id 를 타석 결과 앞에 얹고, G 수입에 들어간다', () => {
    let 집계 = EMPTY_AT_BAT_PITCH_TALLY
    for (let i = 0; i < 4; i += 1) 집계 = tallyPitch(집계, { kind: '파울' })
    expect(집계.foulRecordIds).toEqual([32, 33])

    const random = createSeededRandom(9)
    const 시작 = startGame(random)
    const n = 시작.recordIds.length
    let progress = applyPlayerOutcome(시작, { kind: '삼진' }, random, { foulRecordIds: 집계.foulRecordIds })
    expect(progress.recordIds.slice(n, n + 2)).toEqual([32, 33])
    while (!progress.game.isFinished) progress = applyPlayerOutcome(progress, { kind: '삼진' }, random)

    const summary = summaryOf(progress)
    const 파울없이 = (() => {
      const r = createSeededRandom(9)
      let p = startGame(r)
      while (!p.game.isFinished) p = applyPlayerOutcome(p, { kind: '삼진' }, r)
      return gamePointRewardOf(summaryOf(p))
    })()
    // 파울 기록은 난수를 쓰지 않으므로 나머지 경기는 똑같다 — 차이는 32(3G)+33(5G)
    expect(gamePointRewardOf(summary) - 파울없이).toBe(8)
  })

  it('인플레이 타구로 주자 처리가 미뤄져도 파울 기록은 그 자리에서 들어간다', () => {
    const random = createSeededRandom(9)
    const 시작 = startGame(random)
    const n = 시작.recordIds.length
    const 미룸 = startPlayerOutcome(시작, { kind: '안타', bases: 1 }, random, { foulRecordIds: [32] })

    expect(미룸.pendingDefensePlay).not.toBeNull()
    expect(미룸.recordIds.slice(n)).toEqual([32])
  })
})

describe('내 타석의 상대 투수 — 지금 마운드 투수의 능력치 (0xae83c)', () => {
  it('로스터 투수 밑값 ÷ 10 과 그 레코드의 구질 표를 넘긴다', () => {
    const progress = startGame(createSeededRandom(1), 0, 9, 3)
    const slot = progress.opponentMound.pitcherSlot
    const 투수 = teamPitchers(3)[slot]
    const 능력 = opponentPitcherAbilityOf(progress)

    expect(능력.control).toBe(Math.round(투수.ability[0] / 10))
    expect(능력.velocity).toBe(Math.round(투수.ability[1] / 10))
    expect(능력.breaking).toBe(Math.round(투수.ability[2] / 10))
    expect(능력.repertoire?.pitchMask).toBe(ROSTER_PITCHER_REPERTOIRES[3 * 8 + slot].pitchMask)
  })

  it('CPU 교체로 마운드 칸이 바뀌면 바뀐 투수가 던진다', () => {
    const progress = startGame(createSeededRandom(1), 0, 9, 3)
    const 다른칸 = (progress.opponentMound.pitcherSlot + 5) % 8
    const 바뀜 = opponentPitcherAbilityOf({ ...progress, opponentMound: { ...progress.opponentMound, pitcherSlot: 다른칸 } })

    expect(바뀜.repertoire?.pitchMask).toBe(ROSTER_PITCHER_REPERTOIRES[3 * 8 + 다른칸].pitchMask)
    expect(바뀜.control).toBe(Math.round(teamPitchers(3)[다른칸].ability[0] / 10))
  })
})

describe('사구 — 사람 타석 결과 4 (0x35a20 → 0x9d57c) 를 경기에 먹인다', () => {
  function 내타석(bases: BaseState, outs: number): GameProgress {
    const progress = startGame(createSeededRandom(20100901))
    return { ...progress, game: { ...progress.game, bases, outs, half: '말' } }
  }

  it('수비가 돌지 않고 곧장 끝난다 — 타수에 안 들고 볼넷 수에도 안 든다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 끝 = startPlayerOutcome(시작, { kind: '사구' }, createSeededRandom(3))

    expect(끝.pendingDefensePlay).toBeNull()
    expect(끝.myStats.atBats).toBe(시작.myStats.atBats)
    expect(끝.myStats.walks).toBe(시작.myStats.walks)
    // 평판 볼넷 칸 G+0xfc(코드 12)는 볼넷만 — 사구는 코드 13(G+0x100)이라 따로다
    expect(끝.reputationCounts.walks).toBe(시작.reputationCounts.walks)
  })

  it('타석 결과 링에는 9 가 들어간다 (0xa8b9c)', () => {
    const 끝 = startPlayerOutcome(내타석(EMPTY_BASES, 0), { kind: '사구' }, createSeededRandom(3))

    expect(끝.recentAtBatCodes[끝.recentAtBatCodes.length - 1]).toBe(9)
  })

  it('만루 사구는 밀어내기 1타점이다', () => {
    const 만루 = { first: true, second: true, third: true }
    const 시작 = 내타석(만루, 0)
    const 끝 = startPlayerOutcome(시작, { kind: '사구' }, createSeededRandom(3))

    expect(끝.myStats.runsBattedIn - 시작.myStats.runsBattedIn).toBe(1)
  })

  it('사구는 2·3볼넷 기록(34·35)을 안 센다 — 0xa7a7c 를 부르지 않는다', () => {
    let progress = 내타석(EMPTY_BASES, 0)
    progress = { ...progress, myStats: { ...progress.myStats, walks: 1 } }
    const 끝 = startPlayerOutcome(progress, { kind: '사구' }, createSeededRandom(3))

    expect(끝.recordIds.filter((id) => id === 34 || id === 35)).toEqual([])
  })
})

describe('사구 뒤 벤치 클리어링 (상태 0x1e, 20%) — 내 타석', () => {
  function 내타석(bases: BaseState, outs: number): GameProgress {
    const progress = startGame(createSeededRandom(20100901))
    return { ...progress, game: { ...progress.game, bases, outs, half: '말' } }
  }
  /** 첫 next() 만 정해 두고 나머지는 씨앗 난수에 맡긴다 */
  function 첫굴림(value: number, seed: number) {
    const rest = createSeededRandom(seed)
    let first = true
    return {
      next: () => {
        if (!first) return rest.next()
        first = false
        return value
      },
      nextInRange: (minimum: number, maximum: number) => rest.nextInRange(minimum, maximum),
      pick: <T,>(items: readonly T[]) => rest.pick(items),
    }
  }

  it('사구는 맨 먼저 한 번 굴린다 — 안 들어가면 그 한 번 말고는 볼넷과 같은 차례다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 사구끝 = startPlayerOutcome(시작, { kind: '사구' }, 첫굴림(0.9, 3))
    const 볼넷끝 = startPlayerOutcome(시작, { kind: '볼넷' }, createSeededRandom(3))

    expect(사구끝.game).toEqual(볼넷끝.game)
    expect(사구끝.opponentMound).toEqual(볼넷끝.opponentMound)
    expect(사구끝.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })

  it('들어가면 상대(CPU 수비) 투수 투구 수가 10 늘고, 진입 굴림 45 번까지 쓰고 연출(0x1e)에서 붙든다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    let 굴림 = 0
    const 첫 = 첫굴림(0, 6)
    const 세는 = { ...첫, next: () => { 굴림 += 1; return 첫.next() } }
    const 들어감 = startPlayerOutcome(시작, { kind: '사구' }, 세는)

    // 들어가기 굴림 1 + 진입 0x3a5f0 의 45 — 밀어내기 주루·다음 타석은 아직 안 돌았다
    expect(굴림).toBe(46)
    expect(들어감.pendingBenchClearing).toEqual({ outcome: { kind: '사구' } })
    expect(들어감.game).toEqual(시작.game)
    expect(들어감.opponentMound.pitches - 시작.opponentMound.pitches).toBe(10)
    expect(들어감.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
  })

  it('연출이 끝나면(0xae24c) 사구를 보통 길로 먹인다 — 틱 10 을 지났으면 그 앞에 굴림 8 번이 끼어든다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 들어감 = startPlayerOutcome(시작, { kind: '사구' }, 첫굴림(0, 6))

    const 다봄 = resolveBenchClearing(들어감, { reachedTargetTick: true }, createSeededRandom(11))
    // 건너뛴 쪽에 같은 난수를 8 번 앞당겨 주면 둘이 똑같이 흘러가야 한다
    const 앞당김 = createSeededRandom(11)
    for (let 번 = 0; 번 < 8; 번 += 1) 앞당김.next()
    const 건너뜀 = resolveBenchClearing(들어감, { reachedTargetTick: false }, 앞당김)

    expect(다봄.pendingBenchClearing).toBeNull()
    expect(다봄.game).toEqual(건너뜀.game)
    expect(다봄.log.map((entry) => entry.text)).toEqual(건너뜀.log.map((entry) => entry.text))
  })

  it('미리 다 돌리는 껍데기(applyPlayerOutcome)는 연출을 끝까지 본 것으로 친다', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const 끝 = applyPlayerOutcome(시작, { kind: '사구' }, 첫굴림(0, 6))
    expect(끝.pendingBenchClearing).toBeNull()
  })

  it('돌발이 진행 중이면 굴림은 쓰지만 들어가지 않는다 (0x8eb94)', () => {
    const 시작 = 내타석(EMPTY_BASES, 0)
    const row = { id: 1 } as unknown as NonNullable<NonNullable<GameProgress['burst']>['current']>
    const 돌발중 = { ...시작, burst: { ...시작.burst!, current: row } }
    const 끝 = startPlayerOutcome(돌발중, { kind: '사구' }, 첫굴림(0, 3))

    expect(끝.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })
})

describe('내 타석의 공 하나 — 0xa5e14(ctx, 구질) (0x3dec6)', () => {
  it('공마다 상대 투수 투구 수 +1 · 구질별 소모 · 교체 직후 표시를 내린다', () => {
    const progress = startGame(createSeededRandom(20100901))
    const mound0 = { ...progress.opponentMound, justChanged: true }
    const before = { ...progress, opponentMound: mound0 }
    const 직구 = throwOpponentPitch(before, 1, { batterIntimidates: false })
    const 히든 = throwOpponentPitch(before, 18, { batterIntimidates: false })
    expect(직구.opponentMound.pitches).toBe(mound0.pitches + 1)
    expect(직구.opponentMound.justChanged).toBe(false)
    // 직구 9 < 히든 13 — 구질이 소모를 가른다 (0x66ef0)
    expect(직구.opponentMound.stamina).toBeLessThan(mound0.stamina)
    expect(히든.opponentMound.stamina).toBeLessThan(직구.opponentMound.stamina)
    // 다른 칸은 그대로다
    expect(직구.game).toBe(before.game)
  })

  it('같은 0xa5e14 가 CPU 대타 막음 칸 state[0xe] 도 내린다 (a5e7c)', () => {
    const progress = { ...startGame(createSeededRandom(20100901)), pinchHitUsed: true }
    expect(throwOpponentPitch(progress, 1, { batterIntimidates: false }).pinchHitUsed).toBe(false)
  })

  it('타자 압도(스킬 22)면 소모가 두 배 — 직구 c 9 → 18 (0xa5f0e)', () => {
    const progress = startGame(createSeededRandom(20100901))
    const 보통 = throwOpponentPitch(progress, 1, { batterIntimidates: false })
    const 압도 = throwOpponentPitch(progress, 1, { batterIntimidates: true })
    const 보통소모 = progress.opponentMound.stamina - 보통.opponentMound.stamina
    const 압도소모 = progress.opponentMound.stamina - 압도.opponentMound.stamina
    expect(압도소모).toBeGreaterThan(보통소모)
  })

  it('경기가 끝났으면 아무것도 안 한다', () => {
    const progress = startGame(createSeededRandom(1))
    const finished = { ...progress, game: { ...progress.game, isFinished: true } }
    expect(throwOpponentPitch(finished, 1, { batterIntimidates: false })).toBe(finished)
  })
})

describe('CPU 견제 — 모드 4 도 0x345fc 종류 4 → 0x34848 → 메시지 0x10 (0x644/0x645 · 0x509a0 에 모드 갈림 없음)', () => {
  /** 굴림 수를 센다 — 견제 판이 굴리는 것은 악송구 굴림(0xa1828)뿐이다 */
  const 세는난수 = (seed: number) => {
    const inner = createSeededRandom(seed)
    const counter = { draws: 0 }
    const random: RandomPort = {
      next: () => {
        counter.draws += 1
        return inner.next()
      },
      nextInRange: (minimum, maximum) => {
        counter.draws += 1
        return inner.nextInRange(minimum, maximum)
      },
      pick: (candidates) => {
        counter.draws += 1
        return inner.pick(candidates)
      },
    }
    return { random, counter }
  }
  const 주자 = (progress: GameProgress, bases: BaseState): GameProgress => ({
    ...progress,
    game: { ...progress.game, bases },
  })

  it('내 타석이 아니거나 그 루에 주자가 없으면 아무 일도 없다 — 같은 객체', () => {
    const progress = startGame(createSeededRandom(20100905))
    expect(isPlayerTurn(progress.game)).toBe(true)
    const 판 = 주자(progress, { first: true, second: false, third: false })
    expect(cpuPickoff(판, 2, createSeededRandom(1))).toBe(판)
    const 끝 = { ...판, game: { ...판.game, isFinished: true } }
    expect(cpuPickoff(끝, 1, createSeededRandom(1))).toBe(끝)
    // 타구 진행 중(상태 0x17)에는 투구가 안 나간다
    const 진행중 = startPlayerOutcome(판, { kind: '안타', bases: 1 }, createSeededRandom(1))
    if (진행중.pendingDefensePlay !== null) expect(cpuPickoff(진행중, 1, createSeededRandom(1))).toBe(진행중)
  })

  it('견제는 공이 아니다 — 투구 수·스태미나·타순이 그대로고 재생할 견제 판만 생긴다', () => {
    const progress = startGame(createSeededRandom(20100905))
    const 판 = 주자(progress, { first: true, second: false, third: true })
    const { random, counter } = 세는난수(7)
    const after = cpuPickoff(판, 3, random)
    expect(after).not.toBe(판)
    const play = after.lastDefensePlay
    if (!isPickoffPlayResult(play)) throw new Error('견제 판이 아니다')
    expect(play.throwBase).toBe(3)
    expect(play.ticks.length).toBeGreaterThan(0)
    // 악송구 굴림 1번(악송구면 +2번)뿐이다
    expect(counter.draws).toBe(play.errantThrow ? 3 : 1)
    expect(after.opponentMound.pitches).toBe(판.opponentMound.pitches)
    expect(after.opponentMound.stamina).toBe(판.opponentMound.stamina)
    expect(after.game.battingOrderIndex).toBe(판.game.battingOrderIndex)
    expect(after.myStats).toEqual(판.myStats)
    expect(after.recentAtBatCodes).toEqual(판.recentAtBatCodes)
    // 정산 0xa8024 는 종류 4 라 타석 칸(+0x14)이 안 오른다
    expect(after.ourLineup.records).toEqual(판.ourLineup.records)
    if (!play.errantThrow) {
      // 루에 붙은 주자는 견제로 안 죽는다 (0xb36d0 · 0x4677a) — 결과 9
      expect(play.resultCode).toBe(PICKOFF_RESULT.SAFE)
      expect(after.game).toEqual(판.game)
    }
    expect(after.log[0]?.text).toContain('상대 3루 견제')
    // 같은 타석 다음 공(0xae592 → 0xf)
    expect(isPlayerTurn(after.game)).toBe(true)
  })

  it('견제를 끼워도 뒤 굴림 차례는 견제 판이 쓴 만큼만 밀린다', () => {
    const progress = startGame(createSeededRandom(20100905))
    const 판 = 주자(progress, { first: true, second: false, third: false })
    const { random, counter } = 세는난수(5)
    cpuPickoff(판, 1, random)
    const 다시 = createSeededRandom(5)
    for (let index = 0; index < counter.draws; index += 1) 다시.nextInRange(0, 10000)
    expect(random.nextInRange(0, 10000)).toBe(다시.nextInRange(0, 10000))
  })
})

describe('승·패·세 칸 — 결과 판(0x4fe9c)이 그대로 읽는 state+0x44/0x50/0x5c', () => {
  it('경기 끝까지 돌리면 진 팀이 있는 한 패전 투수 이름이 그 팀 투수 명단에서 나온다', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = createSeededRandom(seed)
      let progress = startGame(random)
      for (let step = 0; step < 200 && !progress.game.isFinished; step += 1) {
        progress = applyPlayerOutcome(progress, { kind: step % 3 === 0 ? '홈런' : '삼진' }, random)
      }
      const summary = summaryOf(progress)
      const names = summary.pitchersOfRecord
      expect(names).toBeDefined()
      if (summary.result === '무') continue
      // 패전 투수 = 지는 팀의 그 순간 마운드 투수 — 이닝 조건이 없어 진 팀이 점수를 내줬다면 늘 있다
      const loserTeam = summary.result === '승' ? summary.opponentTeamId : summary.ourTeamId
      const loserNames = teamPitchers(loserTeam).map((player) => player.name)
      expect(loserNames).toContain(names?.loss)
    }
  })
})

/**
 * 1회초 판(상태 0x18) — 모드 4 의 0xc1e04 칸 0xc1ed6 은 내 타자가 타석에 선 사람 팀 공격만 사람 장면으로 본다.
 * 인트로 뒤 첫 장면이 그것이면(선공·1번 타자) 판이 서고, 그 밖의 반 이닝 앞은 늘 0x21(자동)이라 판이 없다.
 */
describe('1회초 판 (상태 0x18) — 선공·1번 타자일 때만', () => {
  /** 앞 n 개는 고정값, 그 뒤는 씨앗 77 */
  const 앞값 = (n: number, value: number): RandomPort => {
    const rest = createSeededRandom(77)
    let 번 = 0
    return { ...rest, next: () => (번++ < n ? value : rest.next()) }
  }

  it('선공·1번 타자면 판이 서고, 후공이거나 1번이 아니면 안 선다', () => {
    const 선공1번 = startGame(createSeededRandom(3), 0, 1, undefined, PLAYER_SIDE_FIRST_BAT)
    expect(선공1번.halfInningBoard).toEqual({ serial: 1, inning: 1, half: '초' })
    expect(isPlayerTurn(선공1번.game)).toBe(true)

    expect(startGame(createSeededRandom(3), 0, 1).halfInningBoard).toBeNull()
    expect(startGame(createSeededRandom(3), 0, 2, undefined, PLAYER_SIDE_FIRST_BAT).halfInningBoard).toBeNull()
  })

  it('판의 걸음 굴림 36 개(0x3fac4)가 첫 타석 준비보다 앞에 끼어든다 — 값은 버려진다', () => {
    const 세우기 = (n: number, value: number) => startGame(앞값(n, value), 0, 1, undefined, PLAYER_SIDE_FIRST_BAT)
    // 판이 첫 36 개를 먹고 버리므로 그 값이 무엇이든 경기는 같다
    expect(세우기(36, 0.001)).toEqual(세우기(36, 0.999))
    // 경기를 세우는 동안 쓴 굴림 = 판 36 + 첫 타석 준비(1회초 첫 타석이라 CPU 투수 교체·돌발 후보가 없어 0)
    let 수 = 0
    const 씨 = createSeededRandom(77)
    startGame({ ...씨, next: () => { 수 += 1; return 씨.next() } }, 0, 1, undefined, PLAYER_SIDE_FIRST_BAT)
    expect(수).toBe(36)
  })
})
