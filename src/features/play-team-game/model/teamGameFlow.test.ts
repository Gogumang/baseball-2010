import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  INNING_VALUE,
  MATCH_SETTING_KIND,
  FULL_PLAY_SETTINGS,
} from '@/features/play-team-game/model/matchSettings'
import {
  applyBatterOutcome,
  autoProgressCostOf,
  availablePitchers,
  canAutoProgress,
  canOpenPitcherChange,
  changePitcher,
  currentBatterAbility,
  currentPitcherAbility,
  isBatterTurn,
  isPitchTurn,
  ourPitcherStats,
  pitchSlotsFor,
  replacementPitcherIndexOf,
  resolveDefensePlay,
  runAutoProgress,
  startBatterOutcome,
  startTeamGame,
  startThrowPitch,
  stealableBases,
  stealBase,
  summaryOf,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

const 시작 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) => {
  const random = createSeededRandom(seed)
  return { progress: startTeamGame({ ...기본옵션, ...options }, random), random }
}

/** 던질 수 있는 첫 구질 번호 */
function 첫구질(progress: TeamGameProgress): number {
  const slot = pitchSlotsFor(progress).find((candidate) => candidate.typeNumber !== 0)
  return slot?.typeNumber ?? 1
}

/** 경기가 끝날 때까지 사람 차례를 아무렇게나 소화한다 */
function 끝까지(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < 5_000 && !current.game.isFinished; step += 1) {
    if (isPitchTurn(current)) {
      current = throwPitch(current, { typeNumber: 첫구질(current), courseCell: 4, gaugeCell: 0 }, random)
    } else if (isBatterTurn(current)) {
      current = applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
    } else {
      throw new Error('사람 차례가 아닌데 멈췄다')
    }
  }
  return current
}

describe('팀 경기 시작', () => {
  it('후공이면 1회초는 우리 수비라 **던질 차례**다', () => {
    const { progress } = 시작()
    expect(progress.game.inning).toBe(1)
    expect(progress.game.half).toBe('초')
    expect(isPitchTurn(progress)).toBe(true)
    expect(isBatterTurn(progress)).toBe(false)
  })

  it('선공이면 1회초가 우리 공격이라 **칠 차례**다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(isBatterTurn(progress)).toBe(true)
    expect(isPitchTurn(progress)).toBe(false)
  })

  it('"6이닝 자동진행"이면 7회까지 저절로 굴러간다 (이닝idx > 5)', () => {
    const { progress } = 시작({
      settings: {
        ...FULL_PLAY_SETTINGS,
        kind: MATCH_SETTING_KIND.이닝,
        value: INNING_VALUE.일곱째이닝부터,
      },
    })
    expect(progress.game.inning).toBe(7)
    // 자동 구간에서도 양 팀 타석이 리그 기록표에 쌓인다 (원본 0xa8024 가 사람 경기도 같게 쌓는다)
    expect(progress.leaguePlateAppearances.length).toBeGreaterThan(0)
  })

  it('돌발미션 표는 **시즌(모드 2)에만** 생긴다 (0x48658)', () => {
    expect(시작({ mode: 2 }).progress.burst?.table).toBe('SEASON')
    expect(시작({ mode: 1 }).progress.burst).toBeNull()
    expect(시작({ mode: 8 }).progress.burst).toBeNull()
  })
})

describe('사람이 던지는 타석', () => {
  it('공을 하나 던지면 투구 수가 오르고 스태미나가 깎인다', () => {
    const { progress, random } = 시작()
    const after = throwPitch(progress, { typeNumber: 첫구질(progress), courseCell: 4, gaugeCell: 0 }, random)

    expect(after.pitchCount).toBe(1)
    expect(after.stamina).toBeLessThan(progress.stamina)
    expect(after.lastPitch).not.toBeNull()
  })

  it('칠 차례에는 던질 수 없다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(throwPitch(progress, { typeNumber: 1, courseCell: 4, gaugeCell: 0 }, random)).toBe(progress)
  })

  it('우리 선발 구질 칸은 로스터 투수의 구질 표에서 온다', () => {
    const { progress } = 시작()
    const slots = pitchSlotsFor(progress)
    expect(slots.length).toBe(6)
    expect(slots.some((slot) => slot.typeNumber !== 0)).toBe(true)
  })
})

describe('사람이 치는 타석', () => {
  it('아웃이 세 번 쌓이면 공수가 바뀐다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    let current = progress
    for (let out = 0; out < 3; out += 1) {
      expect(isBatterTurn(current)).toBe(true)
      current = applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
    }
    expect(current.game.half).toBe('말')
    expect(isPitchTurn(current)).toBe(true)
  })

  it('타순이 한 칸 돈다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const after = applyBatterOutcome(progress, { kind: '삼진' }, random)
    expect(after.game.battingOrderIndex).toBe(1)
  })

  it('홈런도 공이 날아가는 그림이 나온다 — 점수는 그대로다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const after = applyBatterOutcome(progress, { kind: '홈런' }, random)

    const play = after.lastDefensePlay
    expect(play).not.toBeNull()
    expect(play!.ticks.length).toBeGreaterThanOrEqual(40)
    expect(play!.ticks.length).toBeLessThanOrEqual(80)
    // 주자 없는 홈런은 1점 — 재생을 붙였다고 점수가 달라지면 안 된다
    expect(after.game.ourScore).toBe(progress.game.ourScore + 1)
    const 마지막 = play!.ticks[play!.ticks.length - 1]
    expect(마지막.runners.every((runner) => runner.base === 0)).toBe(true)
  })
})

describe('경기용 능력치가 화면까지 이어진다', () => {
  it('팀 능력치가 타자·투수 능력치에 더해진다', () => {
    // 팀 0 서울 드래곤즈의 타격은 440 → +23.8 → +23
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const ability = currentBatterAbility(progress)
    expect(ability.hit).toBeGreaterThan(0)
    expect(currentPitcherAbility(progress).control).toBeGreaterThan(0)
    expect(ourPitcherStats(progress).stamina).toBeGreaterThan(0)
  })

  it('팀 사기가 낮으면 능력치가 정액으로 깎인다 (시즌 전용)', () => {
    const 좋음 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 100, coach: -1 } })
    const 나쁨 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 5, coach: -1 } })
    expect(currentBatterAbility(나쁨.progress).hit).toBe(currentBatterAbility(좋음.progress).hit - 200)
  })
})

describe('경기 한 판을 끝까지', () => {
  it('9회까지 돌아 승패가 갈린다', () => {
    const { progress, random } = 시작()
    const finished = 끝까지(progress, random)

    expect(finished.game.isFinished).toBe(true)
    expect(finished.game.inning).toBeGreaterThanOrEqual(7)
    const summary = summaryOf(finished)
    expect(summary.ourScore).toBe(finished.game.ourScore)
    expect(summary.won).toBe(summary.ourScore > summary.opponentScore)
    expect(summary.leaguePlateAppearances.length).toBeGreaterThan(0)
  })

  it('요약에는 시즌 평가가 쓰는 완투 등급 두 칸이 들어 있다', () => {
    const { progress, random } = 시작()
    const summary = summaryOf(끝까지(progress, random))
    // 점수를 줬으면 완봉·노히트·퍼펙트가 아니다. 등급 자체는 아웃 수 조건이 맞아야 붙는다
    expect(summary.popularityCompleteGame === null || typeof summary.popularityCompleteGame === 'string').toBe(true)
    expect(summary.pitching.outsRecorded).toBeGreaterThan(0)
  })
})

describe('경기 중 투수 교체 (0xc1ba4 → 0xac428)', () => {
  /** 사람이 한 타석도 안 잡는 설정 — 모든 타석이 간이 엔진을 지나 0xc1ba4 를 부른다 */
  const 전부자동 = {
    ...FULL_PLAY_SETTINGS,
    kind: MATCH_SETTING_KIND.상세,
    value: 0,
  } as const

  it('자동으로 넘긴 타석에서는 선발이 9이닝을 다 던지지 않는다', () => {
    let 바뀐경기 = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const { progress } = 시작({ settings: 전부자동 }, seed)
      if (!progress.game.isFinished) continue
      if (progress.ourUsedPitchers.length > 0 || progress.opponentUsedPitchers.length > 0) {
        바뀐경기 += 1
      }
    }

    // 예전에는 양 팀 모두 선발 한 명으로 경기를 끝냈다
    expect(바뀐경기).toBeGreaterThan(0)
  })

  it('사람이 `#` 로 우리 투수를 바꾼다 — 원본도 우리 투수는 사람 손으로만 바꾼다 (R4 1b)', () => {
    const { progress } = 시작()
    const 후보 = availablePitchers(progress)

    expect(후보.length).toBeGreaterThan(0)
    expect(후보).not.toContain(progress.ourPitcherIndex)

    const 바꾼뒤 = changePitcher(progress, 후보[0])
    expect(바꾼뒤.ourPitcherIndex).toBe(후보[0])
    expect(바꾼뒤.ourUsedPitchers).toContain(progress.ourPitcherIndex)
    // 새 투수는 스태미나가 가득이고 카운터가 0 이다 (0xaec64 memset)
    expect(바꾼뒤.stamina).toBe(10_000)
    expect(바꾼뒤.ourPitcherCounters).toEqual({ inningRunsAllowed: 0, runsAllowed: 0, pitches: 0 })
    // state[0xd] — 다음 한 투구 동안은 다시 안 바뀐다
    expect(바꾼뒤.pitcherJustChanged).toBe(true)
  })

  it('벤치에 없는 칸으로는 바뀌지 않는다', () => {
    const { progress } = 시작()

    expect(changePitcher(progress, progress.ourPitcherIndex)).toBe(progress)
    expect(changePitcher(progress, 99)).toBe(progress)
  })
})

describe('자동진행 (경기 중 메뉴 동작 4 = 0x3c60c)', () => {
  it('비용은 대전모드(8·9) 100 · 그 밖 30 이다', () => {
    expect(autoProgressCostOf(1)).toBe(30)
    expect(autoProgressCostOf(2)).toBe(30)
    expect(autoProgressCostOf(8)).toBe(100)
    expect(autoProgressCostOf(9)).toBe(100)
  })

  it('시즌 경기는 이닝과 무관하게 물어볼 수 있다', () => {
    const { progress } = 시작()

    expect(canAutoProgress(progress)).toBe(true)
  })

  it('대전모드는 0-기준 이닝이 5 를 넘으면 거절한다 (StrGAME[2] "6회까지만")', () => {
    const { progress } = 시작({ mode: 8 })
    const 육회 = { ...progress, game: { ...progress.game, inning: 6 } }
    const 칠회 = { ...progress, game: { ...progress.game, inning: 7 } }

    expect(canAutoProgress(육회)).toBe(true)
    expect(canAutoProgress(칠회)).toBe(false)
  })

  it('자동진행은 사람 차례를 건너뛰고 경기를 끝까지 소화한다', () => {
    const { progress, random } = 시작()

    expect(progress.game.isFinished).toBe(false)
    expect(runAutoProgress(progress, random).game.isFinished).toBe(true)
  })

  it('⚠️ 근사 — 대전모드는 6회를 마치면 멈춘다 (원본이 멈추는 지점은 미해독)', () => {
    const { progress, random } = 시작({ mode: 8 })
    const 소화 = runAutoProgress(progress, random)

    expect(소화.game.isFinished).toBe(false)
    expect(소화.game.inning).toBe(7)
  })
})

describe('도루 (0x53610 → 메시지 0x583)', () => {
  /** 1루에 주자를 세운 우리 공격 상황 */
  const 일루주자 = () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    return {
      progress: {
        ...progress,
        game: { ...progress.game, bases: { first: true, second: false, third: false } },
      },
      random,
    }
  }

  it('1루 주자만 있으면 1루 도루를 걸 수 있다 — 3루 주자는 빠진다', () => {
    const { progress } = 일루주자()

    expect(stealableBases(progress)).toEqual([1])

    const 만루 = { ...progress, game: { ...progress.game, bases: { first: true, second: true, third: true } } }
    expect(stealableBases(만루)).toEqual([])
  })

  it('우리 수비 차례에는 도루가 없다 (원본도 공격일 때만 0x53610 을 탄다)', () => {
    const { progress } = 시작()

    expect(stealableBases({
      ...progress,
      game: { ...progress.game, bases: { first: true, second: false, third: false } },
    })).toEqual([])
  })

  it('성공하면 주자가 2루로 가고, 실패하면 아웃이 하나 는다', () => {
    const { progress } = 일루주자()
    // 성공·실패 둘 다 나오도록 씨앗을 여러 개 돌린다
    const 결과 = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      stealBase(progress, 1, createSeededRandom(seed)),
    )
    const 성공 = 결과.filter((next) => next.game.bases.second)
    const 실패 = 결과.filter((next) => !next.game.bases.second)

    expect(성공.length + 실패.length).toBe(8)
    for (const next of 성공) {
      expect(next.game.bases.first).toBe(false)
      expect(next.game.outs).toBe(progress.game.outs)
    }
    for (const next of 실패) {
      expect(next.game.outs).toBe(progress.game.outs + 1)
      // 타석은 이어진다 — 타순 커서가 넘어가지 않는다
      expect(next.game.battingOrderIndex).toBe(progress.game.battingOrderIndex)
    }
  })

  it('걸 수 없는 루면 그대로 돌려준다', () => {
    const { progress, random } = 일루주자()

    expect(stealBase(progress, 2, random)).toBe(progress)
    expect(stealBase(progress, 3, random)).toBe(progress)
  })
})

describe('`#` 교체 화면 진입 조건 (0x498d4 의 # 가지)', () => {
  it('우리 수비 차례이고 벤치 투수가 있으면 연다', () => {
    const { progress } = 시작()

    expect(canOpenPitcherChange(progress)).toBe(true)
  })

  it('우리 공격 차례에는 열지 않는다 — 원본은 그 자리에서 대타를 연다 (아직 안 옮겼다)', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })

    expect(canOpenPitcherChange(progress)).toBe(false)
  })
})

describe('시즌모드 선발은 4인 로테이션이다 (0x6548 → 0xb8c80 → 0xb5ca8)', () => {
  const 선발 = (dayCounter: number) => {
    // 씨앗을 바꿔도 같은 칸이어야 한다 — 시즌모드는 무작위로 뽑지 않는다
    const 갑 = 시작({ mode: 2, dayCounter }, 1).progress
    const 을 = 시작({ mode: 2, dayCounter }, 12345).progress
    expect(을.ourPitcherIndex, '씨앗이 달라도 같은 선발').toBe(갑.ourPitcherIndex)
    expect(을.opponentPitcherIndex).toBe(갑.opponentPitcherIndex)
    return { ours: 갑.ourPitcherIndex, opponent: 갑.opponentPitcherIndex }
  }

  it('네 경기를 연달아 치르면 선발이 0 → 1 → 2 → 3 으로 돌고 다섯째 날 다시 0 이다', () => {
    expect([0, 1, 2, 3, 4].map((day) => 선발(day).ours)).toEqual([0, 1, 2, 3, 0])
  })

  it('양 팀이 같이 돈다 — 원본은 경기 준비에서 두 팀 모두 한 칸 돌린다', () => {
    for (const day of [0, 1, 2, 3, 5, 9]) {
      const { ours, opponent } = 선발(day)
      expect(opponent, `${day}일차`).toBe(ours)
    }
  })

  it('날짜를 안 넘기면 시즌 첫 경기(g == 0)와 같아 두 팀 다 로스터 0번이다', () => {
    const { progress } = 시작({ mode: 2 })

    expect(progress.ourPitcherIndex).toBe(0)
    expect(progress.opponentPitcherIndex).toBe(0)
  })

  it('일반모드(1)·대전(8)은 원본대로 앞 4명 중 **무작위** 다 (0x3107a·0x31090)', () => {
    const 칸들 = new Set<number>()
    for (let seed = 1; seed <= 60; seed += 1) {
      const { progress } = 시작({ mode: 1, dayCounter: 0 }, seed)
      칸들.add(progress.ourPitcherIndex)
      칸들.add(progress.opponentPitcherIndex)
    }

    expect(칸들.size, '무작위라면 0~3 이 두루 나온다').toBeGreaterThan(1)
    expect([...칸들].every((index) => index >= 0 && index < 4)).toBe(true)

    const 대전 = 시작({ mode: 8, dayCounter: 3 }, 20100901).progress
    const 대전2 = 시작({ mode: 8, dayCounter: 3 }, 777).progress
    // 날짜를 넘겨도 로테이션을 안 탄다 — 씨앗이 다르면 갈린다
    expect(
      대전.ourPitcherIndex !== 대전2.ourPitcherIndex ||
        대전.opponentPitcherIndex !== 대전2.opponentPitcherIndex,
    ).toBe(true)
  })
})

describe('새 투수 고르기 방향 (0xac5d8, V3-E 정정)', () => {
  const 벤치 = [1, 2, 3, 5, 7]
  const 상황 = {
    inningIndex: 8,
    lead: 1,
    runnerCount: 0,
    currentStamina: 5_000,
  } as const

  it('마무리 상황이면 굴리지 않고 0xabfcc 로 간다 — 벤치 마지막이 아니다', () => {
    // 굴림 칸 1(9회)은 45% 라 씨앗을 여럿 훑어도 **한 번도** 벤치 마지막이 나오면 안 된다
    for (let seed = 1; seed <= 40; seed += 1) {
      const picked = replacementPitcherIndexOf(
        벤치,
        { ...상황, saveSituation: true },
        createSeededRandom(seed),
      )
      expect(picked, `씨앗 ${seed}`).not.toBe(벤치[벤치.length - 1])
    }
  })

  it('마무리 상황이 **아닐 때** 굴려서 참이면 벤치 마지막을 올린다', () => {
    const 고른칸 = new Set<number>()
    for (let seed = 1; seed <= 40; seed += 1) {
      고른칸.add(
        replacementPitcherIndexOf(벤치, { ...상황, saveSituation: false }, createSeededRandom(seed)),
      )
    }

    expect(고른칸.has(벤치[벤치.length - 1]), '굴림이 참인 씨앗에서는 벤치 마지막').toBe(true)
    expect(고른칸.size, '거짓인 씨앗에서는 0xabfcc 가 고른 다른 칸').toBeGreaterThan(1)
  })

  it('마무리 상황이면 난수를 아예 쓰지 않는다 (0xac360 을 건너뛴다)', () => {
    let 굴린횟수 = 0
    const 세는난수: RandomPort = {
      next: () => {
        굴린횟수 += 1
        return 0.5
      },
      nextInRange: (from: number, to: number) => {
        굴린횟수 += 1
        return from + (to - from) / 2
      },
      pick: <T,>(candidates: readonly T[]) => {
        굴린횟수 += 1
        return candidates[0]
      },
    }

    replacementPitcherIndexOf(벤치, { ...상황, saveSituation: true }, 세는난수)

    expect(굴린횟수).toBe(0)
  })
})

describe('주자 처리는 수비 화면이 끝나야 정해진다 (상태 0x17 이 도는 동안은 붙들어 둔다)', () => {
  const 땅볼 = { kind: '아웃', detail: '땅볼아웃' } as const

  const 같은코스 = (progress: TeamGameProgress) => ({
    typeNumber: 첫구질(progress),
    courseCell: 4,
    gaugeCell: 0,
  })

  /** 인플레이 타구가 나 붙들리는 투구가 **몇 번째**인지 센다 (0-기준). 없으면 null */
  function 붙들리는투구번호(seed: number): number | null {
    const random = createSeededRandom(seed)
    let current = startTeamGame(기본옵션, random)
    for (let pitch = 0; pitch < 300; pitch += 1) {
      if (!isPitchTurn(current)) return null
      const next = startThrowPitch(current, 같은코스(current), random)
      if (next.pendingDefensePlay !== null) return pitch
      current = next
    }
    return null
  }

  /**
   * 같은 씨앗을 처음부터 다시 돌려 그 투구 **직전**으로 간다 — 난수 포트까지 같은 자리에 둔다.
   * 두 길(한 번에 · 쪼개서)을 정확히 같은 난수 상태에서 견주려면 이렇게 두 번 재현해야 한다.
   */
  function 송구직전(seed: number, pitchIndex: number) {
    const random = createSeededRandom(seed)
    let current = startTeamGame(기본옵션, random)
    for (let pitch = 0; pitch < pitchIndex; pitch += 1) {
      current = startThrowPitch(current, 같은코스(current), random)
    }
    return { progress: current, input: 같은코스(current), random }
  }

  it('우리 공격의 인플레이 타구는 타구만 들고 멈춘다 — 진루·아웃·득점이 하나도 안 먹는다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })

    const 진행중 = startBatterOutcome(progress, 땅볼, random)

    expect(진행중.pendingDefensePlay).not.toBeNull()
    expect(진행중.pendingDefensePlay!.outcome).toEqual(땅볼)
    // 투구 때의 루 상황·아웃을 그대로 들고 간다
    expect(진행중.pendingDefensePlay!.input.bases).toEqual(progress.game.bases)
    expect(진행중.pendingDefensePlay!.input.outs).toBe(progress.game.outs)
    // 경기 상태는 한 톨도 안 바뀐다 — 타순도 안 돌고 기록도 안 쌓인다
    expect(진행중.game).toEqual(progress.game)
    expect(진행중.leaguePlateAppearances).toEqual(progress.leaguePlateAppearances)
    expect(진행중.log).toEqual(progress.log)
  })

  it('붙들려 있는 동안은 칠 차례도 던질 차례도 아니다 — 다음 투구가 못 나간다 (0x17 → 0xf 안 감)', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 진행중 = startBatterOutcome(progress, 땅볼, random)

    expect(isBatterTurn(진행중)).toBe(false)
    expect(isPitchTurn(진행중)).toBe(false)
    // 도루·자동진행도 그 사이에는 안 먹는다
    expect(stealableBases(진행중)).toEqual([])
    expect(runAutoProgress(진행중, random)).toBe(진행중)
  })

  it('화면이 돌린 결과를 먹이면 그때 진루·아웃이 정해지고 칸이 비워진다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 진행중 = startBatterOutcome(progress, { kind: '안타', bases: 2 }, random)
    const 결과 = runDefensePlay(진행중.pendingDefensePlay!.input)

    const 끝 = resolveDefensePlay(진행중, 결과, random)

    expect(끝.pendingDefensePlay).toBeNull()
    expect(끝.ourHits).toBe(1)
    expect(끝.game.battingOrderIndex).toBe(1)
    // 이미 눈으로 다 본 플레이라 재생거리로 남기지 않는다 — 남기면 같은 장면을 한 번 더 튼다
    expect(끝.lastDefensePlay).toBeNull()
  })

  it('삼진·볼넷·홈런은 붙들 것이 없어 곧장 끝난다', () => {
    for (const outcome of [{ kind: '삼진' }, { kind: '볼넷' }, { kind: '홈런' }] as const) {
      const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
      const 끝 = startBatterOutcome(progress, outcome, random)
      expect(끝.pendingDefensePlay, `${outcome.kind}`).toBeNull()
    }
  })

  it('우리 공격 타석은 사람이 **공격**(주루 0x5331c)을 잡는다 — I 0절 상태 0x17 표', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 진행중 = startBatterOutcome(progress, 땅볼, random)

    expect(진행중.pendingDefensePlay!.side).toBe('공격')
    // 우리 공격이므로 수비는 상대 CPU 다 → 협살(AI 상태 8)이 돈다
    expect(진행중.pendingDefensePlay!.input.defenseIsCpu).toBe(true)
  })

  it('사람이 던진 타석은 사람이 **수비**(송구 0x533c8)를 잡는다 — 같은 표의 반대 갈래', () => {
    const 번호 = 붙들리는투구번호(20100901)
    expect(번호).not.toBeNull()
    const { progress, input, random } = 송구직전(20100901, 번호!)

    const 진행중 = startThrowPitch(progress, input, random)

    expect(진행중.pendingDefensePlay!.side).toBe('수비')
    // 이 타석의 수비는 사람이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    expect(진행중.pendingDefensePlay!.input.defenseIsCpu).toBe(false)
    // 붙들려 있는 동안은 던질 차례가 아니다
    expect(isPitchTurn(진행중)).toBe(false)
    // 경기 상태는 한 톨도 안 바뀐다 (투구 수·스태미나만 이미 깎여 있다)
    expect(진행중.game).toEqual(progress.game)
    expect(진행중.pitching).toEqual(progress.pitching)
  })

  it('자동으로 넘긴 타석은 붙들지 않는다 — 원본도 그 구간은 0x17 을 지나지 않는다', () => {
    // "7회부터 직접" 설정이면 시작하자마자 여섯 이닝이 간이 엔진으로 지나간다
    const { progress } = 시작({
      settings: {
        ...FULL_PLAY_SETTINGS,
        kind: MATCH_SETTING_KIND.이닝,
        value: INNING_VALUE.일곱째이닝부터,
      },
    })
    expect(progress.pendingDefensePlay).toBeNull()
  })

  it('타자편 — 둘로 쪼갠 길과 한 번에 돌리는 길의 결과가 같다 (난수 차례도 같다)', () => {
    const 기준 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT }).progress
    const 뜬공 = { kind: '아웃', detail: '뜬공아웃' } as const

    const 한번에 = applyBatterOutcome(기준, 뜬공, createSeededRandom(3))
    const 쪼개서 = (() => {
      const random = createSeededRandom(3)
      const 진행중 = startBatterOutcome(기준, 뜬공, random)
      return resolveDefensePlay(진행중, runDefensePlay(진행중.pendingDefensePlay!.input), random)
    })()

    expect(쪼개서.game).toEqual(한번에.game)
    expect(쪼개서.ourHits).toBe(한번에.ourHits)
    expect(쪼개서.leaguePlateAppearances).toEqual(한번에.leaguePlateAppearances)
    expect(쪼개서.opponentPitcherCounters).toEqual(한번에.opponentPitcherCounters)
    expect(쪼개서.burst).toEqual(한번에.burst)
    expect(쪼개서.log.map((entry) => entry.text)).toEqual(한번에.log.map((entry) => entry.text))
  })

  it('투수편 — 둘로 쪼갠 길과 한 번에 돌리는 길의 결과가 같다 (난수 차례도 같다)', () => {
    const 번호 = 붙들리는투구번호(20100901)
    expect(번호).not.toBeNull()

    const 한번에 = (() => {
      const { progress, input, random } = 송구직전(20100901, 번호!)
      return throwPitch(progress, input, random)
    })()
    const 쪼개서 = (() => {
      const { progress, input, random } = 송구직전(20100901, 번호!)
      const 진행중 = startThrowPitch(progress, input, random)
      expect(진행중.pendingDefensePlay).not.toBeNull()
      return resolveDefensePlay(진행중, runDefensePlay(진행중.pendingDefensePlay!.input), random)
    })()

    expect(쪼개서.pendingDefensePlay).toBeNull()
    expect(쪼개서.game).toEqual(한번에.game)
    expect(쪼개서.pitching).toEqual(한번에.pitching)
    expect(쪼개서.leaguePlateAppearances).toEqual(한번에.leaguePlateAppearances)
    expect(쪼개서.ourPitcherCounters).toEqual(한번에.ourPitcherCounters)
    expect(쪼개서.burst).toEqual(한번에.burst)
    expect(쪼개서.log.map((entry) => entry.text)).toEqual(한번에.log.map((entry) => entry.text))
  })
})
