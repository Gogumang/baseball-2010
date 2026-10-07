import { describe, expect, it } from 'vitest'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  INNING_VALUE,
  MATCH_SETTING_KIND,
  FULL_PLAY_SETTINGS,
} from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  applyBatterOutcome,
  applyBatterPitch,
  autoProgressCostOf,
  availablePinchHitters,
  availablePitchers,
  burstGameRecordOf,
  canAutoProgress,
  canOpenPinchHit,
  canOpenPitcherChange,
  cancelSubstitution,
  changePitcher,
  confirmScene,
  cpuPickoff,
  currentBatterAbility,
  currentBatterEntry,
  currentPitcherAbility,
  isBatterTurn,
  isPitchTurn,
  ourPitcherStats,
  substitutionDetailAbilities,
  pickoff,
  pinchHit,
  pitchSlotsFor,
  replacementPitcherIndexOf,
  resolveDefensePlay,
  returnToPitchSelection,
  runAutoProgress,
  resolveBenchClearing,
  pitchersOfRecordOf,
  rollTeamSetup,
  startBatterOutcome,
  startTeamGame,
  startThrowPitch,
  stealableBases,
  startSteal,
  summaryOf,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, PICKOFF_RESULT } from '@/features/defense-play/model/pickoffPlay'
import {
  clearSeasonGameRecord,
  seasonReputationChangeOf,
} from '@/entities/season-mode/model/seasonReputation'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { battingPatternOdds } from '@/shared/config/original/battingPatterns'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import { aceLeveledAbility } from '@/features/play-team-game/model/teamGameRoster'

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
    // 0xe 에 서 있으면 OK 부터 (그 뒤 굴림 — 돌발 0x8f158 · 0xf 진입 0x3d954)
    if (current.sceneConfirmPending === true) {
      current = confirmScene(current, random)
      continue
    }
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

describe('사람 장면 0xf 진입 0x3d954 — 공마다 CPU 투수 교체(0xac428)·CPU 대타(0xac228)를 다시 묻는다', () => {
  const 볼 = { resolution: { kind: '볼' } as const, hasSwung: false, isBunt: false, resultCode: null, pitchTypeNumber: 1 }
  /** 우리 공격 · 상대 투수가 다 지쳐 0xac428 이 바꾸는 판 (0-기준 이닝 0 · 체력 0) */
  const 지친상대 = () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    return { ...progress, opponentStamina: 0 }
  }

  it('볼 하나 뒤 같은 타석 다음 공(판정 A → 0xf)에서 상대 투수를 바꾸고, 카운트는 이어받는다 (0x16 → 0xd 가 지우기를 건너뜀)', () => {
    const 판 = 지친상대()
    const 뒤 = applyBatterPitch(판, 볼, createSeededRandom(1))
    expect(뒤.opponentPitcherIndex).not.toBe(판.opponentPitcherIndex)
    expect(뒤.opponentUsedPitchers).toEqual([판.opponentPitcherIndex])
    expect(뒤.atBat.balls).toBe(1)
    expect(뒤.atBatPrepared).toBe(true)
    // 22 → 0x16 → 0xe 등판음을 위한 표시 — 한 번
    expect(뒤.scenePitcherChange?.serial).toBe(1)
    // 교체 뒤 state[0xd] 가 서 있어 다시 들어선 0xf(0x16 → 0xd → 0xe → 0xf)는 곧장 빠진다
    expect(뒤.pitcherJustChanged).toBe(true)
  })

  it('돌발이 진행 중이면(0x8eb94) 건너뛴다', () => {
    const 판 = 지친상대()
    const row = { id: 1 } as unknown as NonNullable<NonNullable<TeamGameProgress['burst']>['current']>
    const 돌발중 = { ...판, burst: { ...판.burst!, current: row } }
    const 뒤 = applyBatterPitch(돌발중, 볼, createSeededRandom(1))
    expect(뒤.opponentPitcherIndex).toBe(판.opponentPitcherIndex)
    expect(뒤.scenePitcherChange).toBeNull()
  })

  it('타석이 끝난 공(볼넷)은 0xf 로 안 돌아가 묻지 않는다 — 새 타석 준비(0xd → 0xe → 0xf)에서 묻는다', () => {
    const 판 = { ...지친상대(), atBat: createAtBat({ balls: 3, strikes: 0 }) }
    // 씨앗 2 — 공 도착 0x3dfac 의 0.1% 굴림(0x35034)이 하나 늘어 교체 판정 굴림이 한 칸 밀렸다
    const random = createSeededRandom(2)
    const 뒤 = applyBatterPitch(판, 볼, random)
    expect(뒤.game.bases.first).toBe(true)
    // 다음 타자는 0xe 에 서서 OK 를 기다린다 — 아직 안 묻는다
    expect(뒤.sceneConfirmPending).toBe(true)
    expect(뒤.opponentPitcherIndex).toBe(판.opponentPitcherIndex)
    // OK 뒤 0xf 진입 0x3d954 가 바꾼다 — 새 타석이라 카운트는 0-0
    const 확인 = confirmScene(뒤, random)
    expect(확인.opponentPitcherIndex).not.toBe(판.opponentPitcherIndex)
    expect(확인.atBat.balls).toBe(0)
  })
})

describe('사람 타석의 공마다 상대 투수를 깎는다 — 0x3dec6 의 0xa5e14(ctx, 구질)', () => {
  const 볼 = (pitchTypeNumber?: number) => ({
    resolution: { kind: '볼' } as const,
    hasSwung: false,
    isBunt: false,
    resultCode: null,
    ...(pitchTypeNumber === undefined ? {} : { pitchTypeNumber }),
  })

  it('투구 수 +1 · 스태미나는 구질 소모 0x66ef0 만큼 — 난수는 안 쓴다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const random = createSeededRandom(1)
    const 직구 = applyBatterPitch(progress, 볼(1), random)
    expect(직구.opponentPitcherCounters.pitches).toBe(progress.opponentPitcherCounters.pitches + 1)
    expect(직구.opponentStamina).toBeLessThan(progress.opponentStamina)
    expect(직구.pitcherJustChanged).toBe(false)
    // 깎는 데는 굴림이 없다 — 이 공에서 나간 굴림은 공 도착 0x3dfac 의 0.1% 굴림(0x35034) 하나뿐이다
    const 기준 = createSeededRandom(1)
    기준.next()
    expect(random.next()).toBe(기준.next())
  })

  it('같은 공 수면 결과는 구질 소모를 따른다 — 마구(22)는 직구와 같은 9', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const random = createSeededRandom(1)
    expect(applyBatterPitch(progress, 볼(22), random).opponentStamina).toBe(
      applyBatterPitch(progress, 볼(1), random).opponentStamina,
    )
  })

  it('같은 0xa5e14 가 CPU 대타 막음 칸 state[0xe] 도 내린다 (a5e7c) — 사람 공도 마찬가지 (0x3dec6)', () => {
    const 칠때 = { ...시작({ playerSide: PLAYER_SIDE_FIRST_BAT }).progress, cpuPinchHitUsed: true }
    expect(applyBatterPitch(칠때, 볼(1), createSeededRandom(1)).cpuPinchHitUsed).toBe(false)
    const 던질때 = { ...시작().progress, cpuPinchHitUsed: true }
    const 던진뒤 = throwPitch(던질때, { typeNumber: 첫구질(던질때), courseCell: 4, gaugeCell: 0 }, createSeededRandom(1))
    expect(던진뒤.pitchCount).toBe(1)
    expect(던진뒤.cpuPinchHitUsed).toBe(false)
  })

  it('구질을 안 실은 공(옛 호출)은 깎지 않는다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const after = applyBatterPitch(progress, 볼(), createSeededRandom(1))
    expect(after.opponentStamina).toBe(progress.opponentStamina)
    expect(after.opponentPitcherCounters).toEqual(progress.opponentPitcherCounters)
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

  it('상대 투수는 투구 AI 재료를 싣는다 — 피로 뒤 정액(팀 능력치·코치)과 지금 체력% (0xb570c · 0xaebb0)', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 100, coach: 2 } })
    const 능력 = currentPitcherAbility({ ...progress, opponentStamina: 1_999 })
    expect(능력.staminaPercent).toBe(19)
    // 코치 2(제구 +10)는 팀 검사가 없어 상대 투수에게도 붙는다 (J 4-2) — 피로 뒤에 더한다
    const 코치없음 = currentPitcherAbility({
      ...progress,
      options: { ...progress.options, season: { illness: 0, morale: 100, coach: -1 } },
    })
    expect(능력.gameAbility?.beforeFatigue).toEqual(코치없음.gameAbility?.beforeFatigue)
    expect((능력.gameAbility?.bonusAfterFatigue?.control ?? 0) - (코치없음.gameAbility?.bonusAfterFatigue?.control ?? 0)).toBe(10)
  })

  it('팀 사기가 낮으면 능력치가 정액으로 깎인다 (시즌 전용)', () => {
    const 좋음 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 100, coach: -1 } })
    const 나쁨 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 5, coach: -1 } })
    expect(currentBatterAbility(나쁨.progress).hit).toBe(currentBatterAbility(좋음.progress).hit - 200)
  })

  /*
   * 국가대항전 — 내 팀은 대한민국(10), 시즌 팀은 그대로(여기선 3).
   * 질병·보직·사기 보정은 0xb5804 의 `[시즌+1] == 팀레코드+0` 을 타서 10 ≠ 3 이라 아무 팀에도 안 붙는다.
   */
  const 대회 = (season: { illness: number; morale: number; coach: number }) =>
    시작({
      playerSide: PLAYER_SIDE_FIRST_BAT,
      ourTeamId: 10,
      seasonTeamId: 3,
      opponentTeamId: 11,
      season,
    })

  it('국가대항전 대한민국에는 시즌 팀의 질병·사기 감점이 안 붙는다 (0xb5804 [시즌+1] ≠ 10)', () => {
    const 좋음 = 대회({ illness: 0, morale: 100, coach: -1 })
    const 나쁨 = 대회({ illness: 5, morale: 5, coach: -1 })
    expect(currentBatterAbility(나쁨.progress)).toEqual(currentBatterAbility(좋음.progress))
    expect(currentPitcherAbility(나쁨.progress)).toEqual(currentPitcherAbility(좋음.progress))
    expect(ourPitcherStats(나쁨.progress)).toEqual(ourPitcherStats(좋음.progress))
  })

  it('시즌 팀으로 치면 같은 상태에서 감점이 붙는다 — seasonTeamId 를 안 넘기면 ourTeamId 가 시즌 팀이다', () => {
    const 좋음 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, ourTeamId: 3, season: { illness: 0, morale: 100, coach: -1 } })
    const 나쁨 = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, ourTeamId: 3, seasonTeamId: 3, season: { illness: 5, morale: 5, coach: -1 } })
    expect(currentBatterAbility(나쁨.progress).hit).toBeLessThan(currentBatterAbility(좋음.progress).hit)
  })
})

describe('스태미나가 보는 팀 사기 (0x66e44 의 팀 레코드 +2)', () => {
  const 한공 = (options: Partial<TeamGameOptions>) => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_LAST_BAT, ...options })
    const after = throwPitch(progress, { typeNumber: 첫구질(progress), courseCell: 4, gaugeCell: 0 }, random)
    return progress.stamina - after.stamina
  }

  it('시즌 팀은 시즌 사기가 낮으면 더 많이 깎인다', () => {
    const 좋음 = 한공({ ourTeamId: 3, season: { illness: 0, morale: 100, coach: -1 } })
    const 나쁨 = 한공({ ourTeamId: 3, season: { illness: 0, morale: 5, coach: -1 } })
    expect(나쁨).toBeGreaterThan(좋음)
  })

  it('국가대항전 대한민국은 대표팀 슬롯(base+0x918)의 표값 사기 100 을 쓴다 — 시즌 사기와 무관', () => {
    const 대회 = { ourTeamId: 10, seasonTeamId: 3, opponentTeamId: 11 }
    const 좋음 = 한공({ ...대회, season: { illness: 0, morale: 100, coach: -1 } })
    const 나쁨 = 한공({ ...대회, season: { illness: 0, morale: 5, coach: -1 } })
    expect(나쁨).toBe(좋음)
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

    const 바꾼뒤 = changePitcher(progress, 후보[0], createSeededRandom(0))
    expect(바꾼뒤.ourPitcherIndex).toBe(후보[0])
    expect(바꾼뒤.ourUsedPitchers).toContain(progress.ourPitcherIndex)
    // 새 투수는 제 레코드 스태미나로 서고(시작 값을 안 넘기면 10000) 카운터가 0 이다 (0xaec64 memset)
    expect(바꾼뒤.stamina).toBe(10_000)
    expect(바꾼뒤.ourPitcherCounters).toEqual({ inningRunsAllowed: 0, runsAllowed: 0, pitches: 0 })
    // state[0xd] — 다음 한 투구 동안은 다시 안 바뀐다
    expect(바꾼뒤.pitcherJustChanged).toBe(true)
  })

  it('구원 투수는 첫 투수 보너스(0x66e44 +200)를 못 받아 한 공에 더 깎인다 (0xaeb08, P1 3-2)', () => {
    const { progress } = 시작()
    const 구원 = changePitcher(progress, availablePitchers(progress)[0], createSeededRandom(0))
    const 투구 = { typeNumber: 첫구질(구원), courseCell: 4, gaugeCell: 0 }
    const 구원뒤 = throwPitch({ ...구원, pitcherJustChanged: false }, 투구, createSeededRandom(3))
    // 같은 투수·같은 공인데 "아직 교체가 없다" 로 꾸미면 용량이 커져 덜 깎인다
    const 첫투수뒤 = throwPitch({ ...구원, pitcherJustChanged: false, ourUsedPitchers: [] }, 투구, createSeededRandom(3))
    expect(구원.stamina - 구원뒤.stamina).toBeGreaterThan(구원.stamina - 첫투수뒤.stamina)
  })

  it('벤치에 없는 칸으로는 바뀌지 않는다', () => {
    const { progress } = 시작()

    expect(changePitcher(progress, progress.ourPitcherIndex, createSeededRandom(0))).toBe(progress)
    expect(changePitcher(progress, 99, createSeededRandom(0))).toBe(progress)
  })

  it('벤치 투수가 **한 명**만 남아도 바꾼다 — 0xac428 의 최소 벤치 인자는 0 (0xc1cd8 max(r7,0), r7 = −1)', () => {
    const { progress, random } = 시작()
    const 남길칸 = progress.ourPitcherEntry.length - 1
    const 다쓴칸 = progress.ourPitcherEntry
      .map((_unused, index) => index)
      .filter((index) => index !== progress.ourPitcherIndex && index !== 남길칸)
    // 1회초 우리 수비 — 이닝 실점 A = 3 > 2 라 첫 자동 타석의 0xac428 이 교체를 부른다
    const 한명남음: TeamGameProgress = {
      ...progress,
      ourUsedPitchers: 다쓴칸,
      ourPitcherCounters: { inningRunsAllowed: 3, runsAllowed: 3, pitches: 0 },
    }
    expect(availablePitchers(한명남음)).toEqual([남길칸])

    const 뒤 = runAutoProgress(한명남음, random)

    expect(뒤.ourPitcherIndex).toBe(남길칸)
    expect(뒤.ourUsedPitchers).toContain(progress.ourPitcherIndex)
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

describe('도루 출발 (0x53610 → 메시지 0x583 → 0xa9bd4) · 공 도착 판 (0x3dfac)', () => {
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
  const 볼: PitchOutcomeDetail = { resolution: { kind: '볼' }, hasSwung: false, isBunt: false, resultCode: null }

  it('출발시킬 수 있는 루 — canStartSteal(앞길 검사). 만루면 3루 주자만 홈으로 뛸 수 있다', () => {
    const { progress } = 일루주자()

    expect(stealableBases(progress)).toEqual([1])

    const 만루 = { ...progress, game: { ...progress.game, bases: { first: true, second: true, third: true } } }
    expect(stealableBases(만루)).toEqual([3])
  })

  it('우리 수비 차례에는 도루가 없다 (원본도 공격일 때만 0x53610 을 탄다)', () => {
    const { progress } = 시작()

    expect(stealableBases({
      ...progress,
      game: { ...progress.game, bases: { first: true, second: false, third: false } },
    })).toEqual([])
  })

  it('키는 주자를 출발만 시킨다 — 루·아웃·기록은 그대로, 난수 없음', () => {
    const { progress } = 일루주자()
    const started = startSteal(progress, 1)

    expect(started.stealingFrom).toEqual([1])
    expect(started.game).toBe(progress.game)
    expect(started.recordIds).toBe(progress.recordIds)
    // 이미 출발했거나 걸 수 없는 루면 같은 객체
    expect(startSteal(started, 1)).toBe(started)
    expect(startSteal(progress, 2)).toBe(progress)
  })

  it('공이 도착하면 도루 판(종류 5)이 열린다 — 1루 도루는 늘 세이프, 기록 8 · 타석은 이어진다', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { progress } = 일루주자()
      const started = startSteal(progress, 1)
      const next = applyBatterPitch(started, 볼, createSeededRandom(seed))

      expect(next.stealingFrom).toEqual([])
      expect(next.lastArrivalPlay?.kind).toBe(5)
      expect(next.lastDefensePlay).toBe(next.lastArrivalPlay?.result)
      expect(next.game.bases.second).toBe(true)
      expect(next.game.bases.first).toBe(false)
      expect(next.game.outs).toBe(progress.game.outs)
      expect(next.game.battingOrderIndex).toBe(progress.game.battingOrderIndex)
      // 8 도루 성공 (0xa8024 @a83c6) — 사람 공격이라 게이트를 지난다
      expect(next.recordIds).toEqual([...progress.recordIds, 8])
      expect(next.atBat.balls).toBe(progress.atBat.balls + 1)
    }
  })

  it('출발하지 않은 공은 판이 없다 (0.1% 폭투·포일 굴림만 한 번)', () => {
    const { progress } = 일루주자()
    const next = applyBatterPitch(progress, 볼, createSeededRandom(1))

    expect(next.lastArrivalPlay).toBeNull()
    expect(next.game.bases).toEqual(progress.game.bases)
  })

  it('CPU 공격은 타자 결정 앞에서 0x520de 를 굴린다 — 1루 주자면 공마다 약 1.1% 로 도루 판이 열린다', () => {
    let opened = 0
    let caught = 0
    for (let seed = 1; seed <= 400; seed += 1) {
      const { progress } = 시작({}, seed)
      const 일루 = { ...progress, game: { ...progress.game, bases: { first: true, second: false, third: false } } }
      const next = throwPitch(일루, { typeNumber: 첫구질(일루), courseCell: 0, gaugeCell: 0 }, createSeededRandom(seed))
      if (next.lastArrivalPlay?.kind === 5) {
        opened += 1
        caught += next.lastArrivalPlay.result.caughtFrom.length
      }
    }
    expect(opened).toBeGreaterThan(0)
    // 1루 도루는 리드 뒤 송구할 루가 없어 늘 세이프다 (c8649a3)
    expect(caught).toBe(0)
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

  it('국가대항전 상대국은 매일 새로 복사돼 첫날 0번 · 그 뒤 늘 1번 — 대한민국만 cup.day % 4 (7dd3826)', () => {
    const 대회 = (day: number) =>
      시작({ mode: 2, ourTeamId: 10, dayCounter: day, opponentDayCounter: day === 0 ? 0 : 1 }).progress
    expect([0, 1, 2, 3, 4, 5].map((day) => 대회(day).ourPitcherIndex)).toEqual([0, 1, 2, 3, 0, 1])
    expect([0, 1, 2, 3, 4, 5].map((day) => 대회(day).opponentPitcherIndex)).toEqual([0, 1, 1, 1, 1, 1])
  })

  it('opponentDayCounter 를 안 넘기면 상대도 dayCounter 를 따른다 (기존 동작)', () => {
    expect(시작({ mode: 2, dayCounter: 3 }).progress.opponentPitcherIndex).toBe(3)
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

describe('리그 투수 줄 — 사람 경기도 정산 0xa8024 · 경기 끝 0xa7de8 을 지난다', () => {
  it('양 팀 줄의 실점 합은 점수와 같고, 우리 줄 아웃 합은 우리 수비 아웃이다 (시즌 · 전부 자동 · 마투수 없음)', () => {
    for (const seed of [1, 7, 42]) {
      const progress = startTeamGame({ ...기본옵션, settings: 전부자동 }, createSeededRandom(seed))
      const 재료 = summaryOf(progress).leaguePitchers!
      const 합 = (teamId: number, key: 'outs' | 'runsAllowed' | 'pitches') =>
        재료.lines.filter((line) => line.teamId === teamId).reduce((total, line) => total + line[key], 0)
      expect(합(0, 'runsAllowed'), `씨앗 ${seed}`).toBe(progress.game.opponentScore)
      expect(합(1, 'runsAllowed'), `씨앗 ${seed}`).toBe(progress.game.ourScore)
      expect(합(0, 'outs'), `씨앗 ${seed}`).toBe(progress.pitching.outsRecorded)
      expect(합(1, 'pitches')).toBeGreaterThan(0)
    }
  })
})

describe('시즌 상대 투수 레코드 차례 — opponentPitcherOrder', () => {
  it('리그 차례로 상대 명단을 세우고 명단 0번이 선발이다 — 칸마다 제 표 칸·보직을 든다', () => {
    const { progress } = 시작({
      playerSide: PLAYER_SIDE_FIRST_BAT,
      dayCounter: 9,
      opponentPitcherOrder: [2, 3, 0, 1, 4, 5, 6, 7],
      opponentPitcherStaminas: [10_000, 10_000, 6_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    })
    expect(progress.opponentPitcherIndex).toBe(0)
    expect(progress.opponentPitcherEntry.map((pitcher) => pitcher.orderIndex)).toEqual([2, 3, 0, 1, 4, 5, 6, 7])
    expect(progress.opponentPitcherEntry[0]?.name).toBe(teamPitchers(1)[2]?.name)
    // 표 칸 2 의 레코드 +0x2c 로 선다
    expect(progress.opponentStamina).toBe(6_000)
  })

  it('안 넘기면 예전 셈 — g % 4 칸이 선발', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, dayCounter: 9 })
    expect(progress.opponentPitcherIndex).toBe(1)
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

  it('마무리 후보가 여럿이면 능력 합 0xb5b50 큰 순 (ac0be) — benchAbilitySumOf 를 후보에 싣는다', () => {
    const 마무리둘 = {
      ...상황,
      saveSituation: true,
      benchRoleOf: (index: number) => (index === 5 || index === 7 ? (2 as const) : (0 as const)),
    }
    // 합을 안 주면 스태미나 순 근사 — 같은 스태미나면 벤치 차례 앞
    expect(replacementPitcherIndexOf(벤치, 마무리둘, createSeededRandom(1))).toBe(5)
    expect(
      replacementPitcherIndexOf(
        벤치,
        { ...마무리둘, benchAbilitySumOf: (index: number) => (index === 7 ? 2_400 : 2_000) },
        createSeededRandom(1),
      ),
    ).toBe(7)
  })

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

  it('마무리 상황이 **아니고 벤치에 마투수가 있을 때** 굴려서 참이면 벤치 마지막(마투수)을 올린다 (0xb8a8d)', () => {
    const 마투수 = { benchIsSpecialPitcherAt: (index: number) => index === 벤치[벤치.length - 1] }
    const 고른칸 = new Set<number>()
    for (let seed = 1; seed <= 40; seed += 1) {
      고른칸.add(
        replacementPitcherIndexOf(벤치, { ...상황, ...마투수, saveSituation: false }, createSeededRandom(seed)),
      )
    }

    expect(고른칸.has(벤치[벤치.length - 1]), '굴림이 참인 씨앗에서는 벤치 마지막').toBe(true)
    expect(고른칸.size, '거짓인 씨앗에서는 0xabfcc 가 고른 다른 칸').toBeGreaterThan(1)
  })

  it('벤치에 마투수가 없으면 굴리지 않고 0xabfcc 로 간다 — 마투수는 0xabfcc 가 고르지 않는다', () => {
    let 굴린횟수 = 0
    const 세는난수: RandomPort = {
      next: () => {
        굴린횟수 += 1
        return 0
      },
      nextInRange: (from: number) => {
        굴린횟수 += 1
        return from
      },
      pick: <T,>(candidates: readonly T[]) => {
        굴린횟수 += 1
        return candidates[0]
      },
    }
    expect(replacementPitcherIndexOf(벤치, { ...상황, saveSituation: false }, 세는난수)).toBe(벤치[0])
    expect(굴린횟수).toBe(0)
    // 마투수가 벤치 앞에 있어도 0xabfcc 는 건너뛴다 (마무리 상황 → 굴림 없음)
    expect(
      replacementPitcherIndexOf(
        벤치,
        { ...상황, saveSituation: true, benchIsSpecialPitcherAt: (index) => index === 벤치[0] },
        세는난수,
      ),
    ).toBe(벤치[1])
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

describe('대타 (0xaf06c → 0xaebe4 의 +0x291 가지, R4 1a·1c)', () => {
  const 공격시작 = (options: Partial<TeamGameOptions> = {}) =>
    시작({ playerSide: PLAYER_SIDE_FIRST_BAT, ...options })

  it('로스터 12명이면 타순 아홉 + 벤치 셋이다', () => {
    const { progress } = 공격시작()
    expect(progress.ourEntry).toHaveLength(12)
    expect(progress.ourBenchBatters).toBe(3)
    expect(availablePinchHitters(progress)).toEqual([9, 10, 11])
  })

  it('고른 마타자는 **벤치 첫 칸(9번)** 에 들어간다 (0xb8870 → 0xb53f0 의 0x40 가지)', () => {
    const { progress } = 공격시작({ aceBatterId: 0 })
    expect(progress.ourEntry).toHaveLength(13)
    expect(progress.ourEntry[9]?.aceIndex).toBe(0)
    expect(progress.ourEntry[9]?.name).toBe('메디카')
    // 타순 아홉 칸은 그대로다 — 마타자가 타석에 서는 길은 대타뿐이다
    expect(progress.ourEntry.slice(0, 9).every((player) => player.aceIndex < 0)).toBe(true)
    expect(progress.ourBenchBatters).toBe(4)
  })

  it('우리 공격이고 벤치가 남아 있으면 `#` 대타를 열 수 있다 (수비 중에는 투수 교체다)', () => {
    const { progress } = 공격시작()
    expect(isBatterTurn(progress)).toBe(true)
    expect(canOpenPinchHit(progress)).toBe(true)
    expect(canOpenPitcherChange(progress)).toBe(false)

    const 수비 = 시작({ playerSide: PLAYER_SIDE_LAST_BAT }).progress
    expect(canOpenPinchHit(수비)).toBe(false)
    expect(canOpenPitcherChange(수비)).toBe(true)
  })

  it('대타가 옛 타자의 수비 자리를 받고, 빠진 선수는 명단에서 지워진다 (재출장 없음)', () => {
    const { progress } = 공격시작({ aceBatterId: 0 })
    const 옛타자 = progress.ourEntry[0]!
    const 대타 = progress.ourEntry[9]!
    expect(대타.position).toBe(0)

    const 뒤 = pinchHit(progress, 9, createSeededRandom(0))
    expect(뒤.ourEntry[0]?.name).toBe(대타.name)
    expect(뒤.ourEntry[0]?.position).toBe(옛타자.position)
    expect(뒤.ourEntry).toHaveLength(12)
    expect(뒤.ourEntry.some((player) => player.name === 옛타자.name)).toBe(false)
    expect(뒤.ourBenchBatters).toBe(3)
    expect(currentBatterEntry(뒤)?.aceIndex).toBe(0)
  })

  it('대타 타자의 능력치가 타석 화면에 그대로 간다', () => {
    const { progress } = 공격시작({ aceBatterId: 2, mode: 1 })
    const 뒤 = pinchHit(progress, 9, createSeededRandom(0))
    // 로제 = 히트 580 · 파워 850 (XlsACE_BAT_DATA). 모드 1 은 팀 능력치 보정이 붙으므로
    // 값 자체가 아니라 **바뀌었는지**만 본다
    expect(currentBatterAbility(뒤)).not.toEqual(currentBatterAbility(progress))
    expect(currentBatterAbility(뒤).power).toBeGreaterThan(currentBatterAbility(뒤).hit)
  })

  it('볼카운트는 이어받는다 — 0x48d50 이 이전 상태 0x16 이면 0xb6764·0xa5bcc 를 건너뛴다 (48e94)', () => {
    const { progress } = 공격시작()
    // 볼 셋 스트라이크 하나에서 대타를 내면 새 타자가 그 카운트에서 친다
    const 카운트 = { ...progress, atBat: { ...progress.atBat, balls: 3, strikes: 1 } }
    const 뒤 = pinchHit(카운트, 9, createSeededRandom(0))
    expect(뒤.atBat.balls).toBe(3)
    expect(뒤.atBat.strikes).toBe(1)
    // 타순 칸은 그대로다 — 같은 타석을 이어받는다
    expect(뒤.game.battingOrderIndex).toBe(progress.game.battingOrderIndex)
  })

  it('대타가 그 타석에서 홈런을 치면 기록 5 (ctx+0x160, a8764) — 다음 타석은 칸이 지워져 안 붙는다', () => {
    const { progress, random } = 공격시작()
    const 뒤 = pinchHit(progress, 9, createSeededRandom(0))
    expect(뒤.pinchHitHomeRunHalf).not.toBeNull()
    expect(뒤.scenePinchHit).toMatchObject({ serial: 1, by: '사람' })

    const 친뒤 = applyBatterOutcome(뒤, { kind: '홈런' }, random)
    // 홈런 단계(솔로 1)와 **함께** 준다 (a8642 · a8764)
    expect(친뒤.recordIds).toEqual([1, 5])
    expect(친뒤.pinchHitHomeRunHalf).toBeNull()

    // 대타 없이 친 홈런은 5 가 아니다
    expect(applyBatterOutcome(progress, { kind: '홈런' }, random).recordIds).toEqual([1])
  })

  it('대타 타석이 홈런이 아니면 5 는 없고 칸만 지워진다 — 반 이닝이 바뀐 칸도 안 먹는다', () => {
    const { progress, random } = 공격시작()
    const 뒤 = pinchHit(progress, 9, createSeededRandom(0))
    const 아웃 = applyBatterOutcome(뒤, { kind: '아웃', detail: '뜬공아웃' }, random)
    expect(아웃.recordIds).toEqual([])
    expect(아웃.pinchHitHomeRunHalf).toBeNull()

    const 지난칸 = { ...뒤, pinchHitHomeRunHalf: { inning: 뒤.game.inning + 1, half: 뒤.game.half } }
    expect(applyBatterOutcome(지난칸, { kind: '홈런' }, random).recordIds).toEqual([1])
  })

  it('벤치를 다 쓰면 더는 못 연다', () => {
    const { progress } = 공격시작()
    let 현재 = progress
    for (const _ of [0, 1, 2]) 현재 = pinchHit(현재, 9, createSeededRandom(0))
    expect(현재.ourBenchBatters).toBe(0)
    expect(availablePinchHitters(현재)).toEqual([])
    expect(canOpenPinchHit(현재)).toBe(false)
    // 없는 칸을 고르면 아무 일도 안 난다
    expect(pinchHit(현재, 9, createSeededRandom(0))).toBe(현재)
  })

  it('벤치가 아닌 칸(타순 안)은 대타로 못 고른다', () => {
    const { progress } = 공격시작()
    expect(pinchHit(progress, 3, createSeededRandom(0))).toBe(progress)
  })

  it('대타가 친 타석은 **대타 선수의 로스터 칸**으로 리그 기록에 쌓인다 — 타순 칸이 아니다 (0xa8024)', () => {
    const { progress, random } = 공격시작()
    const 타순칸 = progress.game.battingOrderIndex
    // 벤치 둘째 칸(로스터 10번)을 낸다 — 빠진 타순 칸 선수의 로스터 칸과 다르다
    const 뒤 = pinchHit(progress, 10, createSeededRandom(0))
    expect(currentBatterEntry(뒤)?.rosterSlot).toBe(10)

    const 친뒤 = applyBatterOutcome(뒤, { kind: '아웃', detail: '뜬공아웃' }, random)
    const 새기록 = 친뒤.leaguePlateAppearances.slice(progress.leaguePlateAppearances.length)
    expect(새기록[0]).toMatchObject({ teamId: 기본옵션.ourTeamId, battingOrderIndex: 10 })
    expect(새기록[0]?.battingOrderIndex).not.toBe(타순칸)
  })

  it('마타자는 리그 로스터 선수가 아니라 리그 기록표에 안 쌓인다 (원본은 마타자 레코드에 쌓는다)', () => {
    const { progress, random } = 공격시작({ aceBatterId: 0, mode: 1, season: undefined })
    const 뒤 = pinchHit(progress, 9, createSeededRandom(0))
    const 친뒤 = applyBatterOutcome(뒤, { kind: '아웃', detail: '뜬공아웃' }, random)
    const 새기록 = 친뒤.leaguePlateAppearances.slice(progress.leaguePlateAppearances.length)
    // 사람 타석 하나가 끝났지만 우리 팀 첫 기록은 마타자 것이 아니다 — 빠졌다
    expect(새기록.filter((appearance) => appearance.teamId === 기본옵션.ourTeamId && appearance.battingOrderIndex === 0)).toEqual([])
  })
})


/* ── AI 팀 마선수(0x66968·0x66994)와 CPU 대타(0xac228) ─────────────────────── */

/** 굴림 횟수를 세는 껍데기 */
function 세는난수(inner: RandomPort): RandomPort & { readonly rolls: number[] } {
  const rolls: number[] = []
  return {
    rolls,
    next: () => inner.next(),
    nextInRange(minimum, maximum) {
      rolls.push(maximum)
      return inner.nextInRange(minimum, maximum)
    },
    pick: (candidates) => inner.pick(candidates),
  }
}

/** 어느 타석도 사람이 잡지 않는 설정 — 비트가 하나도 안 켜진 "상세" */
const 전부자동: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.상세,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

describe('일반모드 경기 세우기 0x30f20 — AI 팀 마선수', () => {
  it('굴림 차례가 원본과 같다 — 마투수·마타자·AI 선발·사람 선발 (31058·3106c·3107a·31090)', () => {
    const random = 세는난수(createSeededRandom(20100901))
    startTeamGame(
      { ...기본옵션, mode: 1, season: undefined, aceBatterId: 0, acePitcherId: 1, settings: FULL_PLAY_SETTINGS },
      random,
    )
    // 0x66968·0x66994 는 rand(0,5), 선발 둘은 rand(0,4) 다
    expect(random.rolls.slice(0, 4)).toEqual([5, 5, 4, 4])
  })

  it('시즌(모드 2)은 0x30f20 을 안 타서 마선수를 굴리지 않는다', () => {
    const random = 세는난수(createSeededRandom(20100901))
    const progress = startTeamGame({ ...기본옵션, aceBatterId: 0 }, random)
    expect(random.rolls.slice(0, 1)).not.toEqual([5])
    expect(progress.opponentAceBatterIndex).toBe(-1)
  })

  it('상대 팀 벤치 첫 칸(9번)에 AI 마타자가 들어간다 (31076: 0xb8870)', () => {
    const { progress } = 시작({ mode: 1, season: undefined, aceBatterId: 2, acePitcherId: 3 })
    expect(progress.opponentAceBatterIndex).toBeGreaterThanOrEqual(0)
    expect(progress.opponentAceBatterIndex).toBeLessThanOrEqual(4)
    expect(progress.opponentEntry).toHaveLength(13)
    expect(progress.opponentEntry[9]?.aceIndex).toBe(progress.opponentAceBatterIndex)
    expect(progress.opponentBenchBatters).toBe(4)
  })

  it('⚠️ 원본 버그: 사람이 마선수를 안 골라도 AI 는 마타자·마투수를 얻는다', () => {
    const { progress } = 시작({ mode: 1, season: undefined })
    expect(progress.opponentEntry).toHaveLength(13)
    expect(progress.opponentAcePitcherIndex).toBeGreaterThanOrEqual(0)
  })
})

describe('CPU 대타 0xac228 — 자동 타석에서', () => {
  it('state[0xe] 는 공마다 내려간다 — 한 경기에 여러 번 나올 수 있고, 나올 때마다 그 팀 명단이 한 칸 준다', () => {
    let 여러번 = 0
    for (let seed = 1; seed <= 24; seed += 1) {
      const progress = startTeamGame(
        { ...기본옵션, mode: 1, season: undefined, settings: 전부자동 },
        createSeededRandom(seed * 7919),
      )
      expect(progress.game.isFinished).toBe(true)
      // 명단은 우리 12(마타자 없음) · 상대 13(AI 마타자) 로 시작한다
      const 줄어든칸 = 12 - progress.ourEntry.length + (13 - progress.opponentEntry.length)
      // 대타 한 번마다 벤치 타자 수 team+0x28c 도 하나씩 준다 (aed9c~aedae)
      expect(3 - progress.ourBenchBatters + (4 - progress.opponentBenchBatters), `씨앗 ${seed * 7919}`).toBe(
        줄어든칸,
      )
      // 마지막 공(0xa5e14 a5e7c)이 칸을 내렸다
      expect(progress.cpuPinchHitUsed).toBe(false)
      // 간이 엔진(0xc1ba4) 대타는 교체 연출 0x16 을 안 지난다 — 소리 고리에 아무것도 안 남긴다
      expect(progress.scenePinchHit).toBeNull()
      if (줄어든칸 >= 2) 여러번 += 1
    }
    // 예전 "경기에 한 번" 이면 나올 수 없는 경기가 실제로 있다
    expect(여러번).toBeGreaterThan(0)
  })

  it('CPU 대타가 들어오면 그 뒤 타석은 들어온 벤치 선수(로스터 9번 이후)의 리그 기록에 쌓인다', () => {
    let 나온경기 = 0
    for (let seed = 1; seed <= 24; seed += 1) {
      const progress = startTeamGame(
        { ...기본옵션, settings: 전부자동 },
        createSeededRandom(seed * 7919),
      )
      expect(progress.game.isFinished).toBe(true)
      // 시즌(모드 2)은 마타자가 없어 두 팀 다 명단 12 로 시작한다
      const 우리대타 = 12 - progress.ourEntry.length
      const 상대대타 = 12 - progress.opponentEntry.length
      if (우리대타 + 상대대타 === 0) continue
      나온경기 += 1
      for (const [대타팀, 줄어든칸] of [
        [기본옵션.ourTeamId, 우리대타],
        [기본옵션.opponentTeamId, 상대대타],
      ] as const) {
        if (줄어든칸 === 0) continue
        const 벤치칸기록 = progress.leaguePlateAppearances.filter(
          (appearance) => appearance.teamId === 대타팀 && appearance.battingOrderIndex >= 9,
        )
        // 예전에는 타순 칸(0~8)으로만 쌓여 벤치 선수 기록이 하나도 없고 빠진 선수에게 붙었다
        expect(벤치칸기록.length, `씨앗 ${seed * 7919}`).toBeGreaterThan(0)
      }
    }
    expect(나온경기).toBeGreaterThan(0)
  })
})

describe('마투수 등판 — 0xb88c8 → 0xb521c 의 0x60 가지 (8번 칸)', () => {
  it('일반모드에서 고른 마투수가 투수 명단 8번 칸에 앉는다', () => {
    const { progress } = 시작({ mode: 1, acePitcherId: 0 })
    // 로스터 여덟(0~7) 뒤 8번이 마투수다 — 마타자의 9번과 칸이 다르다 (0xb521c 대 0xb53f0)
    expect(progress.ourPitcherEntry).toHaveLength(9)
    expect(progress.ourPitcherEntry[8]?.aceIndex).toBe(0)
    expect(progress.ourPitcherEntry[8]?.name).toBe('싸이커')
    expect(progress.ourPitcherEntry.slice(0, 8).every((p) => p.aceIndex === -1)).toBe(true)
  })

  it('마투수를 안 고르면 명단이 로스터 여덟 칸 그대로다', () => {
    const { progress } = 시작({ mode: 1 })
    expect(progress.ourPitcherEntry).toHaveLength(8)
    expect(progress.opponentPitcherEntry.some((p) => p.aceIndex >= 0)).toBe(true)
  })

  it('AI 팀도 같은 자리에서 마투수를 하나 받는다 (0x31064)', () => {
    const { progress } = 시작({ mode: 1, acePitcherId: 2 })
    expect(progress.opponentAcePitcherIndex).toBeGreaterThanOrEqual(0)
    expect(progress.opponentPitcherEntry[8]?.aceIndex).toBe(progress.opponentAcePitcherIndex)
  })

  it('마투수가 벤치 목록에 들어와 `#` 교체로 마운드에 설 수 있다', () => {
    // 레벨 배율(0xb6414)을 100% 로 두어 날 능력치끼리 견준다 — 레오니는 순번 1 = 칸 1
    const { progress } = 시작({ mode: 1, acePitcherId: 1, aceLevels: { 1: 4 } })
    // team+0x33 = 명부 − 1 이라 벤치가 일곱에서 여덟으로 는다
    expect(availablePitchers(progress)).toContain(8)
    const 바꾼뒤 = changePitcher(progress, 8, createSeededRandom(0))
    expect(바꾼뒤.ourPitcherIndex).toBe(8)
    // 마투수 능력치·구질이 그대로 마운드에 올라온다 (레오니 = 폼 7 · 마구 6)
    expect(pitchSlotsFor(바꾼뒤).some((slot) => slot.isMagic)).toBe(true)
    expect(ourPitcherStats(바꾼뒤).velocity).toBeGreaterThan(ourPitcherStats(progress).velocity)
  })

  it('마투수 능력치는 0xb6414 첫 단계에서 0xd88aa[mgr[0x13a + 순번]] 배율을 먹는다 — 모드 1 도 (팀 보정은 그 뒤)', () => {
    const 구속 = (aceLevels?: Readonly<Record<number, number>>) =>
      ourPitcherStats(changePitcher(시작({ mode: 1, acePitcherId: 1, ...(aceLevels === undefined ? {} : { aceLevels }) }).progress, 8, createSeededRandom(0)))
        .velocity
    // 레오니 구속 850: Lv1 60% = 510 · Lv5 100% = 850. 팀 능력치 보정은 더하기라 차이가 그대로 남는다
    expect(구속({ 1: 4 }) - 구속()).toBe(850 - 510)
    // 안 넘기면 새 저장 기본값 Lv1 과 같다. 다른 칸(마타자 칸 6)의 레벨은 상관없다
    expect(구속({ 1: 0, 6: 4 })).toBe(구속())
  })

  it('교체 상세 창 능력치는 0xb6414(rec, 칸, 1) — 레벨 배율만 먹고 0xb570c 팀·시즌 보정은 안 먹는다 (0x5aefc ctx 0)', () => {
    const { progress } = 시작({ mode: 1, acePitcherId: 1 })
    // 레오니 구속 850 · Lv1 60% = 510. 경기용 값(ourPitcherStats)과 달리 팀 능력치 보정이 없다
    expect(substitutionDetailAbilities(progress, '투수', 8)?.[1]).toBe(510)
    expect(substitutionDetailAbilities({ ...progress, options: { ...progress.options, aceLevels: { 1: 4 } } }, '투수', 8)?.[1]).toBe(850)
    // 마선수가 아니면 명단 값 그대로
    expect(substitutionDetailAbilities(progress, '투수', 1)).toEqual(progress.ourPitcherEntry[1]?.ability)
    expect(substitutionDetailAbilities(progress, '대타', 9)).toEqual(
      aceLeveledAbility(progress.ourEntry[9]!.ability, '타자', progress.ourEntry[9]!.aceIndex, undefined),
    )
    expect(substitutionDetailAbilities(progress, '대타', 99)).toBeNull()
  })

  it('마선수 레벨 배율 — 타자는 칸 +5 (0xb6442), 마선수가 아니면 그대로', () => {
    expect(aceLeveledAbility([600, 700, 800, 900], '타자', 0, { 0: 4, 5: 2 })).toEqual([480, 560, 640, 720])
    expect(aceLeveledAbility([600, 700, 800, 900], '투수', 0, { 0: 4, 5: 2 })).toEqual([600, 700, 800, 900])
    expect(aceLeveledAbility([600, 700, 800, 900], '투수', 4, undefined)).toEqual([360, 420, 480, 540])
    expect(aceLeveledAbility([600, 700, 800, 999], '타자', -1, { 5: 0 })).toEqual([600, 700, 800, 999])
  })

  it('시즌모드는 0x30f20 을 안 타므로 seasonOpponentAces 가 없으면 상대 팀 마투수가 없다', () => {
    const { progress } = 시작({ mode: 2, acePitcherId: 3 })
    expect(progress.ourPitcherEntry).toHaveLength(9)
    expect(progress.opponentPitcherEntry).toHaveLength(8)
  })

  it('마투수를 넣어도 경기 세우기의 난수 굴림 수는 그대로다', () => {
    const 굴림수 = (options: Partial<TeamGameOptions>) => {
      const base = createSeededRandom(20100901)
      let count = 0
      const random: RandomPort = {
        ...base,
        nextInRange: (from: number, to: number) => {
          count += 1
          return base.nextInRange(from, to)
        },
      }
      startTeamGame({ ...기본옵션, ...options }, random)
      return count
    }
    // 마투수·마타자·AI 선발·사람 선발 넉 장 (0x31058·0x3106c·0x3107a·0x31090) + 상태 9 의 시뮬 초기화 rand(0, 2) (0x3fa0e → 0xc0dac)
    expect(굴림수({ mode: 1 })).toBe(5)
    expect(굴림수({ mode: 1, acePitcherId: 0 })).toBe(5)
    expect(굴림수({ mode: 1, acePitcherId: 0, aceBatterId: 0 })).toBe(5)
  })
})

describe('환경설정 "송구" (+0xf4) — 0xae6c8', () => {
  const 인플레이 = { kind: '안타', bases: 1 } as const

  /** 사람이 던지는 타석에서 인플레이 타구가 나올 때까지 민다 */
  const 사람수비타구 = (options: Partial<TeamGameOptions>) => {
    const { progress, random } = 시작({ mode: 1, ...options })
    let 현재 = progress
    for (let step = 0; step < 2_000 && 현재.pendingDefensePlay === null; step += 1) {
      if (isPitchTurn(현재)) {
        현재 = startThrowPitch(현재, { typeNumber: 첫구질(현재), courseCell: 4, gaugeCell: 0 }, random)
      } else if (isBatterTurn(현재)) {
        현재 = applyBatterOutcome(현재, { kind: '아웃', detail: '뜬공아웃' }, random)
      } else break
    }
    return 현재.pendingDefensePlay
  }

  it('사람이 던지는 타석은 설정이 그대로 먹는다 (수비가 사람이라 앞 항이 거짓)', () => {
    const pending = 사람수비타구({ throwModeManual: false })
    expect(pending?.side).toBe('수비')
    expect(pending?.input.throwMode).toBe('자동')
  })

  it('안 넘기면 원본 기본값인 수동이다', () => {
    const pending = 사람수비타구({})
    expect(pending?.side).toBe('수비')
    expect(pending?.input.throwMode).toBe('수동')
  })

  it('우리 공격 타석은 수비가 CPU 라 설정과 무관하다 (0xae6c8 의 앞 항이 참)', () => {
    const { progress, random } = 시작({ mode: 1, throwModeManual: true })
    const 시작한뒤 = startBatterOutcome(progress, 인플레이, random)
    // 이 자리는 throwMode 를 아예 안 싣는다 — 실어도 defenseIsCpu 가 먼저 참이라 결과가 같다
    expect(시작한뒤.pendingDefensePlay?.input.defenseIsCpu).toBe(true)
  })
})

/* ── 시즌 평판 평가 16칸 (SR+0x1a0, S4 2b·3절) ───────────────────────────────── */

describe('시즌 평판 16칸을 경기가 채운다 (0xa8024 → 0xa755c → 0xa3440)', () => {
  const 홈런 = { kind: '홈런' } as const
  const 삼진 = { kind: '삼진' } as const
  const 일루타 = { kind: '안타', bases: 1 } as const
  const 이루타 = { kind: '안타', bases: 2 } as const
  const 삼루타 = { kind: '안타', bases: 3 } as const

  /** 우리 공격 반 이닝을 만든다 (선공이면 1회 초가 우리 차례다) */
  const 우리공격 = (seed = 20100901) => 시작({ playerSide: PLAYER_SIDE_FIRST_BAT }, seed)

  it('경기를 세우면 16칸이 전부 0 이다 (0xa3424 memset 16)', () => {
    const { progress } = 시작()
    expect(progress.gameRecord).toEqual(Array.from({ length: 16 }, () => 0))
  })

  it('안타 칸 S[7] 은 홈런도 올린다 — a8518 이 루타를 가르기 전이다', () => {
    const { progress, random } = 우리공격()
    expect(applyBatterOutcome(progress, 홈런, random).gameRecord[7]).toBe(1)
  })

  it('2루타·3루타는 S[7] 과 S[8]/S[9] 를 둘 다 올린다 (a856e·a85b8)', () => {
    const { progress, random } = 우리공격()
    const 둘 = applyBatterOutcome(applyBatterOutcome(progress, 이루타, random), 삼루타, random)
    expect(둘.gameRecord[7]).toBe(2)
    expect(둘.gameRecord[8]).toBe(1)
    expect(둘.gameRecord[9]).toBe(1)
  })

  it('홈런은 타점 1~4 가 S[10]~S[13] 을 가른다 (a8648/a867e/a868c/a86a4)', () => {
    const { progress, random } = 우리공격()
    const 솔로 = applyBatterOutcome(progress, 홈런, random)
    expect(솔로.gameRecord[10]).toBe(1)
    // 주자를 하나 세우고 친 홈런은 2점 홈런 칸이다
    const 투런 = applyBatterOutcome(applyBatterOutcome(솔로, 일루타, random), 홈런, random)
    expect(투런.gameRecord[11]).toBe(1)
    expect(투런.gameRecord[10]).toBe(1)
  })

  it('내 타자 삼진은 S[6] 이다 (a8a46 — 수비가 CPU 인 쪽)', () => {
    const { progress, random } = 우리공격()
    const 친뒤 = applyBatterOutcome(progress, 삼진, random)
    expect(친뒤.gameRecord[6]).toBe(1)
    // 탈삼진 칸(뒤집혀 S[5])은 우리 공격에서 서지 않는다 — 게이트 0xa755c
    expect(친뒤.gameRecord[5]).toBe(0)
  })

  it('사이클은 네 루타를 다 채운 그 타석에서 한 번만 선다 (a878a)', () => {
    const { progress, random } = 우리공격()
    // 같은 타순 칸이 돌아오도록 아홉 타석씩 띄워 친다
    let 지금 = progress
    const 한바퀴 = (outcome: Parameters<typeof applyBatterOutcome>[1]) => {
      지금 = applyBatterOutcome(지금, outcome, random)
      // 나머지 여덟 칸은 단타로 채워 아웃 없이 타순만 한 바퀴 돌린다
      for (let i = 0; i < 8; i += 1) 지금 = applyBatterOutcome(지금, 일루타, random)
    }
    한바퀴(일루타)
    한바퀴(이루타)
    한바퀴(삼루타)
    expect(지금.gameRecord[14]).toBe(0)
    한바퀴(홈런)
    expect(지금.gameRecord[14]).toBe(1)
    // 한 번 더 쳐도 다시 서지 않는다 (a876e 의 [sp+0x1c])
    한바퀴(일루타)
    expect(지금.gameRecord[14]).toBe(1)
  })

  it('시즌(모드 2)이 아니면 한 칸도 안 오른다 — 게이트 0xa755c 의 `st[1] == 2`', () => {
    const { progress, random } = 시작({ mode: 1, playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(applyBatterOutcome(progress, 홈런, random).gameRecord[7]).toBe(0)
  })

  it('요약이 16칸을 그대로 싣는다', () => {
    const { progress, random } = 우리공격()
    const 친뒤 = applyBatterOutcome(progress, 홈런, random)
    expect(summaryOf(친뒤).gameRecord).toEqual(친뒤.gameRecord)
  })
})

describe('한 경기를 끝까지 돌리면 16칸이 실제로 찬다', () => {
  it('자동으로 소화한 시즌 한 경기 — 16칸과 평판 등급 (seed 20100901)', () => {
    const random = createSeededRandom(20100901)
    const 끝 = runAutoProgress(startTeamGame({ ...기본옵션, settings: 전부자동 }, random), random)
    const summary = summaryOf(끝)

    // 장면 덱 섞기(상태 7 0x3e340 → 0xb08e8) · 경기 시작 rand(0, 2)(상태 9 0x3fa0e → 0xc0dac)와 자동진행 rand(0, 2)가
    // 앞에 서는 차례 — 1-2 완투패
    expect(summary.ourScore).toBe(1)
    expect(summary.opponentScore).toBe(2)
    expect(summary.pitching.outsRecorded).toBe(27)
    expect(summary.gameRecord).toEqual([0, 0, 6, 0, 0, 8, 10, 12, 4, 0, 0, 0, 0, 0, 0, 0])

    const context = {
      opponentRuns: summary.opponentScore,
      myRuns: summary.ourScore,
      won: summary.won,
      completeGame: summary.reputationCompleteGame,
    }
    // 16칸이 비었을 때는 패배·완투·상대 득점만 남아 −1 이다
    expect(seasonReputationChangeOf(clearSeasonGameRecord(), context)).toBe(-1)
    // 채워진 16칸이 그만큼을 메우고 넘어 +1 이 된다
    expect(seasonReputationChangeOf(summary.gameRecord, context)).toBe(1)
  })
})

describe('견제 — 메시지 0x10 → 0x50f28 → 플레이 종류 4 (사람 수비 0x53548 · CPU 0x34848)', () => {
  const 주자 = (progress: TeamGameProgress, bases: TeamGameProgress['game']['bases']): TeamGameProgress => ({
    ...progress,
    game: { ...progress.game, bases },
  })
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

  it('사람 수비: 그 루에 주자가 없거나 견제 키가 아니면 아무 일도 없다 — 같은 객체를 돌려준다', () => {
    const { progress, random } = 시작()
    const 판 = 주자(progress, { first: true, second: false, third: false })
    expect(isPitchTurn(판)).toBe(true)
    expect(pickoff(판, '1', random)).toBe(판) // 2루 견제인데 2루가 비었다
    expect(pickoff(판, '2', random)).toBe(판) // 견제 키가 아니다
    // 칠 차례에는 사람 견제 키가 없다 (0x53548 은 수비일 때만)
    const { progress: 공격 } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 공격판 = 주자(공격, { first: true, second: false, third: false })
    expect(pickoff(공격판, '3', random)).toBe(공격판)
  })

  it('사람 수비: 견제는 투구가 아니다 — 투구 수·스태미나·볼카운트·타순이 그대로고 재생할 판만 생긴다', () => {
    const { progress } = 시작()
    const 판 = 주자(progress, { first: true, second: false, third: true })
    const { random, counter } = 세는난수(7)
    const after = pickoff(판, '7', random)
    expect(after).not.toBe(판)
    expect(after.pitchCount).toBe(판.pitchCount)
    expect(after.stamina).toBe(판.stamina)
    expect(after.magicRemaining).toBe(판.magicRemaining)
    expect(after.atBat).toEqual(판.atBat)
    expect(after.opponentOrderIndex).toBe(판.opponentOrderIndex)
    expect(after.game).toEqual(판.game)
    expect(after.atBatPrepared).toBe(true)
    expect(isPickoffPlayResult(after.lastDefensePlay)).toBe(true)
    const play = after.lastDefensePlay
    if (!isPickoffPlayResult(play)) throw new Error('견제 판이 아니다')
    expect(play.throwBase).toBe(3)
    expect(play.ticks.length).toBeGreaterThan(0)
    // 루에 붙은 주자는 견제로 안 죽는다 (0xb36d0 · 0x4677a) — 악송구가 아니면 결과 9
    if (!play.errantThrow) expect(play.resultCode).toBe(PICKOFF_RESULT.SAFE)
    // 주자마다 리드 rand(0,100) 1번(0x3d7b8) → 악송구 굴림 1번 → 받는 펌블 굴림 1번(b4224)
    // (악송구면 흔들기 넷 · 줍는 야수의 펌블 굴림 · 튕김이 더 붙는다)
    if (play.errantThrow) expect(counter.draws).toBeGreaterThan(2 + 2)
    else expect(counter.draws).toBe(2 + 2)
    expect(after.log[0]?.text).toContain('3루 견제')
    // 다시 던질 수 있다 — 상태 0xf 로 돌아온다 (0xae592)
    expect(isPitchTurn(after)).toBe(true)
  })

  it('정산 0xa8024 는 종류 4 라 타석 칸(+0x14)이 안 오른다 — 대타 AI(0xac228) 가 보는 그 칸', () => {
    const { progress } = 시작()
    const 판 = 주자(progress, { first: true, second: false, third: false })
    const after = pickoff(판, '3', createSeededRandom(3))
    expect(after.opponentEntryRecords).toEqual(판.opponentEntryRecords)
    expect(after.leaguePlateAppearances).toEqual(판.leaguePlateAppearances)

    const { progress: 공격 } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 공격판 = 주자(공격, { first: false, second: true, third: false })
    const cpu = cpuPickoff(공격판, 2, createSeededRandom(3))
    expect(cpu).not.toBe(공격판)
    expect(cpu.ourEntryRecords).toEqual(공격판.ourEntryRecords)
  })

  it('CPU 견제: 사람이 칠 차례에만, 주자 있는 루에만 걸린다 — 타석은 그대로 이어진다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 판 = 주자(progress, { first: true, second: false, third: false })
    expect(isBatterTurn(판)).toBe(true)
    // 0x34848 은 주자 있는 루까지 다시 굴리므로 빈 루가 들어오면 부르는 쪽 잘못이다
    expect(cpuPickoff(판, 2, createSeededRandom(1))).toBe(판)
    const { random, counter } = 세는난수(11)
    const after = cpuPickoff(판, 1, random)
    const play = after.lastDefensePlay
    if (!isPickoffPlayResult(play)) throw new Error('견제 판이 아니다')
    expect(play.throwBase).toBe(1)
    // 리드 1번 → 악송구 굴림 1번 → 받는 펌블 굴림 1번(b4224) (악송구면 더 붙는다)
    if (play.errantThrow) expect(counter.draws).toBeGreaterThan(1 + 2)
    else expect(counter.draws).toBe(1 + 2)
    expect(after.atBat).toEqual(판.atBat)
    expect(after.game.battingOrderIndex).toBe(판.game.battingOrderIndex)
    expect(isBatterTurn(after)).toBe(true)
    expect(after.log[0]?.text).toContain('상대 1루 견제')
    // 던질 차례에는 CPU 견제가 없다 (CPU 가 공을 쥔 쪽이 아니다)
    const { progress: 수비 } = 시작()
    const 수비판 = 주자(수비, { first: true, second: false, third: false })
    expect(cpuPickoff(수비판, 1, createSeededRandom(1))).toBe(수비판)
  })

  it('견제를 끼워도 기존 경로의 난수 차례는 그대로다 — 견제 판의 굴림만큼만 밀린다', () => {
    const { progress } = 시작()
    const 판 = 주자(progress, { first: true, second: false, third: false })
    const 투구 = { typeNumber: 첫구질(판), courseCell: 4, gaugeCell: 0 }
    const 그냥 = throwPitch(판, 투구, createSeededRandom(5))
    // 견제 판이 굴린 수만큼 앞에서 먹여 둔 난수와 같은 차례가 된다
    const { random, counter } = 세는난수(5)
    const 견제뒤 = pickoff(판, '3', random)
    const 소모 = counter.draws
    const 다시 = createSeededRandom(5)
    for (let index = 0; index < 소모; index += 1) 다시.nextInRange(0, 10000)
    const 기준 = throwPitch(판, 투구, 다시)
    const 견제후투구 = throwPitch(견제뒤, 투구, random)
    expect(견제후투구.lastResolution).toEqual(기준.lastResolution)
    expect(견제후투구.pitchCount).toBe(그냥.pitchCount)
  })
})

/** `index` 번째 굴림만 `hit` 을, 나머지는 늘 `rest` 를 내는 각본 난수 — 굴림 수도 센다 */
function 각본난수(rest: number, index = -1, hit = rest) {
  let calls = 0
  const value = () => {
    const out = calls === index ? hit : rest
    calls += 1
    return out
  }
  return {
    next: value,
    nextInRange: (minimum: number, maximum: number) => minimum + value() * (maximum - minimum),
    pick: <T,>(candidates: readonly T[]) => candidates[Math.floor(value() * candidates.length)],
    calls: () => calls,
  }
}

describe('실투 판정 0x33cbc — 사람이 던지는 공', () => {
  it('궤적 뒤 · CPU 타자 결정 앞에서 rand(0,100) 한 번 — 실투면 지켜볼 공도 친다', () => {
    const { progress } = 시작()
    const input = { typeNumber: 첫구질(progress), courseCell: 4, gaugeCell: 0 }

    // 모든 굴림이 0.7 이면 존 안 공이고, 실투가 아니며(70 ≥ p) 타자는 지켜본다
    const 평소 = 각본난수(0.7)
    expect(startThrowPitch(progress, input, 평소).lastResolution).toEqual({
      kind: '스트라이크',
      isSwinging: false,
    })
    // 지켜보면 타자 쪽 굴림은 표 하나뿐이고, 그 뒤가 공 도착 0x3dfac 의 0.1% 굴림(0x35034)이다 —
    // 표 바로 앞이 실투 판정이다 (주자가 없어 CPU 도루 0x520de 는 안 굴린다)
    const 실투자리 = 평소.calls() - 3

    const 실투 = startThrowPitch(progress, input, 각본난수(0.7, 실투자리, 0))
    expect(실투.lastResolution?.kind).toBe('타구')
  })
})

describe('마타자 0xb633d — 번트 칸을 뽑아도 친다', () => {
  /** `index` 번째 굴림만 `hit`, 나머지는 0.7 */
  function 굴림(index: number, hit: number) {
    return 각본난수(0.7, index, hit)
  }

  it('같은 굴림에서 일반 타자는 번트, 마타자는 치기 칸과 똑같이 휘두른다', () => {
    const { progress } = 시작()
    const input = { typeNumber: 첫구질(progress), courseCell: 4, gaugeCell: 0 }
    // 표 굴림 자리 = 0.7 일 때 지켜보는 공의 마지막 굴림
    const 기준 = 각본난수(0.7)
    startThrowPitch(progress, input, 기준)
    const 표자리 = 기준.calls() - 1

    // 1루 주자 · 무사 — 표에 번트 칸이 있는 행
    const 주자있음: TeamGameProgress = {
      ...progress,
      game: { ...progress.game, bases: { first: true, second: false, third: false } },
    }
    const odds = battingPatternOdds(0, 0, 0, true)
    expect(odds.bunt).toBeGreaterThan(0)
    const 번트굴림 = (odds.swing + odds.bunt / 2) / 100
    const 치기굴림 = odds.swing / 2 / 100

    const ace = ACE_BATTERS[0]
    const 마타자: TeamGameProgress = {
      ...주자있음,
      opponentEntry: 주자있음.opponentEntry.map((entry, slot) =>
        slot === 주자있음.opponentOrderIndex
          ? { ...entry, aceIndex: 0, ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run] }
          : entry,
      ),
    }
    const 일반번트 = startThrowPitch(주자있음, input, 굴림(표자리, 번트굴림)).lastResolution
    const 마번트 = startThrowPitch(마타자, input, 굴림(표자리, 번트굴림)).lastResolution
    const 마치기 = startThrowPitch(마타자, input, 굴림(표자리, 치기굴림)).lastResolution

    expect(마번트).toEqual(마치기)
    expect(일반번트).not.toEqual(마번트)
  })
})

describe('사구 — 우리 타석 결과 4 와 벤치 클리어링 (상태 0x1e, 20%)', () => {
  /** 첫 next() 만 정해 두고 나머지는 씨앗 난수에 맡긴다 */
  function 첫굴림(value: number, seed: number): RandomPort {
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

  it('사구는 붙들 것이 없어 곧장 끝나고 1루가 찬다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 끝 = startBatterOutcome(progress, { kind: '사구' }, 첫굴림(0.9, 3))

    expect(끝.pendingDefensePlay).toBeNull()
    expect(끝.game.bases.first).toBe(true)
  })

  it('들어가면 상대 투수 투구 수 +10 — 우리 공격이라 시즌 평판 S[1] 은 게이트에서 버려진다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 들어감 = startBatterOutcome(progress, { kind: '사구' }, 첫굴림(0, 3))
    const 안들어감 = startBatterOutcome(progress, { kind: '사구' }, 첫굴림(0.9, 3))

    // 들어가면 연출(상태 0x1e)에서 사구를 붙든다 — 밀어내기는 연출이 끝난 뒤 (`teamBenchClearing.test`)
    expect(들어감.pendingBenchClearing).toEqual({ side: '공격', outcome: { kind: '사구' } })
    expect(들어감.game).toEqual(progress.game)
    expect(들어감.opponentPitcherCounters.pitches - 안들어감.opponentPitcherCounters.pitches).toBe(10)
    expect(들어감.gameRecord).toEqual(안들어감.gameRecord)
    expect(들어감.gameRecord[1]).toBe(0)
    expect(들어감.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
    expect(안들어감.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })

  it('안 들어가면 굴림 한 번 말고는 볼넷과 같은 차례다', () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 사구끝 = startBatterOutcome(progress, { kind: '사구' }, 첫굴림(0.9, 3))
    const 볼넷끝 = startBatterOutcome(progress, { kind: '볼넷' }, createSeededRandom(3))

    expect(사구끝.game).toEqual(볼넷끝.game)
    expect(사구끝.opponentPitcherCounters).toEqual(볼넷끝.opponentPitcherCounters)
  })
})

/**
 * 우리가 던진 공에 CPU 타자가 맞는다 — 0x35a20. 기본 배치 side 1(좌타)에서 바깥 칸 2 를 노린 공이
 * 흩어져 상자 [271, 309] 에 닿는 씨앗을 골랐다 (35: 벤치 클리어링 안 들어감 · 86: 들어감 — 공 도착 0.1% 굴림 뒤).
 */
describe('사구 — 우리 수비에서 CPU 타자가 맞는다 (0x35a20 · 벤치 클리어링 수비 사람 갈래)', () => {
  function 맞히기(seed: number): { 전: TeamGameProgress; 후: TeamGameProgress } {
    const { progress } = 시작()
    const input = { typeNumber: 첫구질(progress), courseCell: 2, gaugeCell: 0 }
    const 후 = startThrowPitch(progress, input, createSeededRandom(seed))
    return { 전: progress, 후 }
  }

  it('밀어내기 1루 · 출루 허용 · 투수 볼넷+사구 칸', () => {
    const { 후 } = 맞히기(35)
    expect(후.lastResolution).toEqual({ kind: '사구' })
    expect(후.pendingDefensePlay).toBeNull()
    expect(후.game.bases.first).toBe(true)
    expect(후.pitching.walksAllowed).toBe(1)
    expect(후.pitching.allowedBaserunner).toBe(true)
    expect(후.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })

  it('벤치 클리어링에 들어가면 우리 투수 스태미나 −1000 · 시즌 평판 S[1] +1 (공격측 CPU)', () => {
    const 보통 = 맞히기(35).후
    const 벤치 = 맞히기(86).후
    expect(벤치.lastResolution).toEqual({ kind: '사구' })
    expect(보통.stamina - 벤치.stamina).toBe(1000)
    expect(벤치.gameRecord[1] - 보통.gameRecord[1]).toBe(1)
    // 연출(상태 0x1e)에서 붙든다 — 끝나면 보통 길(밀어내기 1루)
    expect(벤치.pendingBenchClearing).toEqual({ side: '수비', outcome: { kind: '사구' } })
    expect(resolveBenchClearing(벤치, { reachedTargetTick: false }, createSeededRandom(1)).game.bases.first).toBe(true)
    // 수비가 사람이라 상대(공격) 투수 투구 수는 건드리지 않는다
    expect(벤치.opponentPitcherCounters).toEqual(보통.opponentPitcherCounters)
    expect(벤치.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
  })

  it('시즌이 아니면(모드 ≠ 2) S[1] 이 안 남는다', () => {
    const { progress } = 시작({ mode: 1 })
    const input = { typeNumber: 첫구질(progress), courseCell: 2, gaugeCell: 0 }
    const 벤치 = startThrowPitch(progress, input, createSeededRandom(86))
    expect(벤치.lastResolution).toEqual({ kind: '사구' })
    expect(벤치.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
    expect(벤치.gameRecord).toEqual(progress.gameRecord)
  })
})

describe('승·패·세 칸 — 결과 판(0x4fe9c)이 읽는 state+0x44/0x50/0x5c', () => {
  it('끝까지 돌린 경기의 패전 투수는 진 팀 투수 명단에서 나온다 (0xa5c34 — 이닝 조건 없음)', () => {
    for (const seed of [11, 12, 13]) {
      const random = createSeededRandom(seed)
      const 끝 = runAutoProgress(startTeamGame(기본옵션, random), random)
      const summary = summaryOf(끝)
      if (summary.result === '무') continue
      const 진팀 = summary.result === '승' ? 끝.opponentPitcherEntry : 끝.ourPitcherEntry
      expect(진팀.map((투수) => 투수.name)).toContain(pitchersOfRecordOf(끝).loss)
    }
  })
})

describe('공수 교대 판 (상태 0x18 교대 가지 — 앞뒤 장면이 모두 사람일 때만 선다)', () => {
  it('시즌(모드 2) 첫 타석이 사람이면 1회초 판이 선다 — 인트로 0xc 끝이 0x18 로 보낸다', () => {
    const { progress } = 시작()
    expect(progress.halfInningBoard).toEqual({ serial: 1, inning: 1, half: '초' })
  })

  it('일반(모드 1)·이닝/전체 설정이면 인트로가 곧장 0xd 로 가 1회초 판이 없다 (0x39e3c)', () => {
    const { progress } = 시작({ mode: 1, season: undefined })
    expect(progress.halfInningBoard).toBeNull()
  })

  it('전부 사람이 잡으면 반 이닝이 바뀔 때마다 판이 하나씩 선다', () => {
    const { progress, random } = 시작()
    let current = progress
    for (let step = 0; step < 400 && current.game.inning === 1; step += 1) {
      current = isPitchTurn(current)
        ? throwPitch(current, { typeNumber: 첫구질(current), courseCell: 4, gaugeCell: 0 }, random)
        : applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
    }
    // 1회초 판 · 1회말 판 · 2회초 판
    expect(current.halfInningBoard).toEqual({ serial: 3, inning: 2, half: '초' })
  })
})

describe('기록달성 — 팀 경기도 0xa77f0 으로 쌓고 경기 끝 0x4ea0c 가 G 로 준다 (모드 1·2·8·9)', () => {
  const 우리공격 = () => 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
  const 공 = (kind: '볼' | '파울') => ({
    resolution: kind === '볼' ? ({ kind: '볼' } as const) : ({ kind: '파울' } as const),
    hasSwung: kind === '파울',
    isBunt: false,
    resultCode: null,
    pitchTypeNumber: 1,
  })

  it('3루타 0 · 홈런 단계 1~4 — 우리 타석 정산 (a85b2 · a8642~a869e)', () => {
    const { progress, random } = 우리공격()
    expect(applyBatterOutcome(progress, { kind: '안타', bases: 3 }, random).recordIds).toEqual([0])
    const 만루 = { ...progress, game: { ...progress.game, bases: { first: true, second: true, third: true } } }
    expect(applyBatterOutcome(만루, { kind: '홈런' }, random).recordIds).toEqual([4])
  })

  it('백투백 6 — 우리 팀 연속 타석 홈런, 홈런 아닌 결과가 끼면 끊긴다 (ctx+0x162, 0xa794c)', () => {
    const { progress, random } = 우리공격()
    const 한방 = applyBatterOutcome(progress, { kind: '홈런' }, random)
    expect(한방.recordTally.homeRunStreak).toBe(1)
    const 두방 = applyBatterOutcome(한방, { kind: '홈런' }, random)
    expect(두방.recordIds).toEqual([1, 1, 6])
    const 끊김 = applyBatterOutcome(한방, { kind: '아웃', detail: '뜬공아웃' }, random)
    expect(끊김.recordTally.homeRunStreak).toBe(0)
  })

  it('연타석·한 타자 볼넷은 타순 칸 결과 목록으로 본다 — 대타가 오면 목록도 같이 움직인다 (aed02~aed16)', () => {
    const { progress, random } = 우리공격()
    const 슬롯 = progress.game.battingOrderIndex
    const 두번안타 = recordBatterAtBat(
      recordBatterAtBat(EMPTY_BATTER_GAME_LOG, { kind: '안타', bases: 1 }, 0).log,
      { kind: '안타', bases: 1 },
      0,
    ).log
    const 판 = { ...progress, ourBatterLogs: progress.ourBatterLogs.map((log, index) => (index === 슬롯 ? 두번안타 : log)) }
    // 세 번째 연속 안타 → 9 연타석 x3 (0xa7b90)
    expect(applyBatterOutcome(판, { kind: '안타', bases: 1 }, random).recordIds).toEqual([9])
    // 대타가 들어오면 그 칸은 벤치 선수의 빈 목록이다 — 이어지지 않는다
    expect(applyBatterOutcome(pinchHit(판, 9, createSeededRandom(0)), { kind: '안타', bases: 1 }, random).recordIds).toEqual([])
  })

  it('32·33 연속 파울 — 공마다, 파울 아닌 공이면 끊긴다 (0xa7dbc · 0xa5fdc 유력)', () => {
    const { progress } = 우리공격()
    const random = createSeededRandom(1)
    let 판 = progress
    for (let 번 = 0; 번 < 4; 번 += 1) 판 = applyBatterPitch(판, 공('파울'), random)
    expect(판.recordIds).toEqual([32, 33])
    const 끊김 = applyBatterPitch(applyBatterPitch(progress, 공('파울'), random), 공('볼'), random)
    expect(끊김.recordTally.foulStreak).toBe(0)
  })

  it('경기 끝 0xa7de8 — 10점차 승 37, 완투 계열은 코스 확정·현재 투수 아웃 == 3×이닝 일 때만', () => {
    const { progress } = 시작()
    const 끝 = (tally: Partial<TeamGameProgress['recordTally']>, runsAllowed: number) => ({
      ...progress,
      game: { ...progress.game, inning: 9, ourScore: 10, opponentScore: 0, isFinished: true },
      pitching: { ...progress.pitching, outsRecorded: 27, hitsAllowed: 3, runsAllowed },
      recordTally: { ...progress.recordTally, ...tally },
    })
    // 사람이 공을 한 번도 안 던졌으면(state[0x8c] = 0) 완투 계열은 없다
    expect(summaryOf(끝({ moundOuts: 27 }, 0)).recordIds).toEqual([37])
    // 완봉 29 — 피안타는 있으나 실점 0
    const 완봉 = summaryOf(끝({ moundOuts: 27, pitchCourseConfirmed: true }, 0))
    expect(완봉.recordIds).toEqual([37, 29])
    expect(완봉.gamePoints).toBe(recordGamePointsOf([37, 29]))
    // 구원으로 올라온 현재 투수는 3×이닝 아웃을 못 채운다
    expect(summaryOf(끝({ moundOuts: 20, pitchCourseConfirmed: true }, 0)).recordIds).toEqual([37])
  })

  it('30G 자동진행은 기록을 막지 않는다 — [ctx+0x24] 를 세우는 0xc1b48 은 투수편 강판 길뿐이다 (R15 10-3)', () => {
    let 쌓인경기 = 0
    for (let seed = 1; seed <= 8; seed += 1) {
      const random = createSeededRandom(seed * 104729)
      const progress = startTeamGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, random)
      const 끝 = runAutoProgress(progress, random)
      expect(끝.game.isFinished).toBe(true)
      if (summaryOf(끝).recordIds!.length > progress.recordIds.length) 쌓인경기 += 1
    }
    expect(쌓인경기).toBeGreaterThan(0)
  })

  it('들어갈 때 시뮬 초기화 0xc0dac 가 rand(0, 2) 를 한 번 굴린다 (c0df6) — 그 뒤가 간이 타석이다', () => {
    const { progress } = 우리공격()
    const random = 세는난수(createSeededRandom(5))
    runAutoProgress(progress, random)
    expect(random.rolls[0]).toBe(2)
  })

  it('경기진행 설정으로 넘긴 타석(간이 엔진)은 자동진행이 아니라 기록이 쌓인다 — 게이트를 지난 번호뿐이다', () => {
    let 쌓인경기 = 0
    const 수비기록 = new Set<number>()
    for (let seed = 1; seed <= 12; seed += 1) {
      const progress = startTeamGame({ ...기본옵션, settings: 전부자동 }, createSeededRandom(seed * 7919))
      expect(progress.game.isFinished).toBe(true)
      const summary = summaryOf(progress)
      const ids = summary.recordIds ?? []
      if (ids.length > 0) 쌓인경기 += 1
      // 간이 엔진에는 파울(0x51408)·필살송구가 없다
      expect(ids.filter((id) => id === 32 || id === 33 || id === 36)).toEqual([])
      for (const id of ids) if (id >= 16 && id <= 27) 수비기록.add(id)
      expect(summary.gamePoints).toBe(recordGamePointsOf(ids))
    }
    expect(쌓인경기).toBeGreaterThan(0)
    // 우리 수비 간이 타석의 삼진도 우리 팀 기록이다 (모드 1·2 는 우리 팀이 사람 팀 — 0xa7c4c · 0xa7998)
    expect(수비기록.size).toBeGreaterThan(0)
  })
})

describe('엔트리 편집기(0x55864)가 고친 명단으로 경기를 세운다 — ourEntryOrder', () => {
  const 차례 = {
    // 표 타자 열둘을 거꾸로 — 수비 위치도 차례가 든 값이다
    batters: Array.from({ length: 12 }, (_unused, index) => ({ rosterSlot: 11 - index, position: index < 9 ? index + 1 : 0 })),
    pitchers: [3, 2, 1, 0, 4, 5, 6, 7],
  }

  it('타순·벤치·수비 위치가 차례 그대로다 (0xb891c 는 첨자만 든다)', () => {
    const { progress } = 시작({ ourEntryOrder: 차례 })
    expect(progress.ourEntry.map((batter) => batter.rosterSlot)).toEqual(차례.batters.map((batter) => batter.rosterSlot))
    expect(progress.ourEntry.map((batter) => batter.position)).toEqual(차례.batters.map((batter) => batter.position))
    expect(progress.ourBenchBatters).toBe(3)
    // 상대 팀은 표 차례 그대로
    expect(progress.opponentEntry.map((batter) => batter.rosterSlot)).toEqual(Array.from({ length: 12 }, (_u, i) => i))
  })

  it('시즌 선발은 차례의 rotationSlotOf(g) 번 — 원본 "g 번 돈 레코드의 0번" 과 같다', () => {
    for (const dayCounter of [0, 1, 2, 3, 4, 5]) {
      const { progress } = 시작({ ourEntryOrder: 차례, dayCounter })
      expect(progress.ourPitcherIndex).toBe(dayCounter % 4)
      expect(progress.ourPitcherEntry[progress.ourPitcherIndex]?.orderIndex).toBe(dayCounter % 4)
      // 차례 [3,2,1,0,…] 의 g%4 번 = 표 3−g%4 번 투수
      const 표선발 = startTeamGame({ ...기본옵션, dayCounter: 3 - (dayCounter % 4) }, createSeededRandom(1))
      expect(progress.ourPitcherEntry[progress.ourPitcherIndex]?.name).toBe(
        표선발.ourPitcherEntry[표선발.ourPitcherIndex]?.name,
      )
    }
  })

  it('표에 없는 칸(영입 선수 −1)은 안 쓴 표 칸을 작은 번호부터 채운다 (근사)', () => {
    const { progress } = 시작({
      ourEntryOrder: {
        batters: [{ rosterSlot: -1, position: 2 }, ...Array.from({ length: 11 }, (_u, i) => ({ rosterSlot: i + 1, position: 0 }))],
        pitchers: [-1, 1, 2, 3, 4, 5, 6, 7],
      },
    })
    expect(progress.ourEntry[0]?.rosterSlot).toBe(0)
    expect(progress.ourEntry[0]?.position).toBe(2)
    expect(progress.ourPitcherEntry[0]?.name).toBe(startTeamGame(기본옵션, createSeededRandom(1)).ourPitcherEntry[0]?.name)
  })

  it('표 밖 선수(영입 id ≥ 0xb4)는 실어 준 자기 기록으로 그 칸에 선다 — 0xb891c 는 id 로 거르지 않는다', () => {
    const 명전타자 = { name: '명전타자', ability: [901, 802, 703, 604] as const }
    const 명전투수 = {
      name: '명전투수',
      ability: [880, 870, 860, 850] as const,
      repertoire: { name: '명전투수', form: 2, magicId: 0, pitchMask: 0b1011 },
    }
    const { progress } = 시작({
      dayCounter: 0,
      ourEntryOrder: {
        batters: [
          { rosterSlot: -1, position: 6, record: 명전타자 },
          ...Array.from({ length: 11 }, (_u, i) => ({ rosterSlot: i + 1, position: i < 8 ? i + 1 : 0 })),
        ],
        pitchers: [명전투수, 1, 2, 3, 4, 5, 6, 7],
      },
    })
    const 타자 = progress.ourEntry[0]
    expect(타자?.name).toBe('명전타자')
    expect(타자?.ability).toEqual([901, 802, 703, 604])
    expect(타자?.position).toBe(6)
    // 리그 로스터 칸이 아니다 — 표 칸을 차지하지도 않는다
    expect(타자?.rosterSlot).toBe(-1)
    expect(progress.ourEntry.slice(1).map((batter) => batter.rosterSlot)).toEqual(Array.from({ length: 11 }, (_u, i) => i + 1))

    const 투수 = progress.ourPitcherEntry[0]
    expect(투수?.name).toBe('명전투수')
    expect(투수?.ability).toEqual([880, 870, 860, 850])
    expect(투수?.repertoire.pitchMask).toBe(0b1011)
    expect(투수?.tableSlot).toBeUndefined()
    expect(투수?.orderIndex).toBe(0)
    expect(progress.ourPitcherEntry.slice(1).map((pitcher) => pitcher.tableSlot)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('명단을 넘겨도 경기 세우기의 난수 굴림은 그대로다', () => {
    const 없음 = 세는난수(createSeededRandom(7))
    const 있음 = 세는난수(createSeededRandom(7))
    startTeamGame({ ...기본옵션, mode: 1, season: undefined }, 없음)
    startTeamGame({ ...기본옵션, mode: 1, season: undefined, ourEntryOrder: 차례 }, 있음)
    expect(있음.rolls.slice(0, 4)).toEqual(없음.rolls.slice(0, 4))
  })
})

describe('미리 굴린 0x30f20 넷 — 일반모드 상태 22 진입(0x314b0)이 굴린다', () => {
  it('rollTeamSetup 을 먼저 부르고 넘기면 경기는 같은 결과에 같은 난수 차례다 (위치만 앞당김)', () => {
    const 옵션: TeamGameOptions = {
      ...기본옵션, mode: 1, season: undefined, acePitcherId: 1, aceBatterId: 0, settings: 전부자동,
    }
    const 그대로 = startTeamGame(옵션, createSeededRandom(20100901))
    const random = createSeededRandom(20100901)
    const 굴림 = rollTeamSetup(1, 0, random)
    const 앞당김 = startTeamGame({ ...옵션, ...굴림 }, random)
    expect(앞당김.opponentAcePitcherIndex).toBe(그대로.opponentAcePitcherIndex)
    expect(앞당김.opponentAceBatterIndex).toBe(그대로.opponentAceBatterIndex)
    expect(앞당김.game).toEqual(그대로.game)
    expect(앞당김.log).toEqual(그대로.log)
  })

  it('넘기면 startTeamGame 은 상태 9 의 시뮬 초기화 rand(0, 2) 하나만 굴린다 (0x3fa0e → 0xc0dac c0df6)', () => {
    const random = 세는난수(createSeededRandom(3))
    startTeamGame(
      {
        ...기본옵션, mode: 1, season: undefined,
        opponentAces: { pitcher: 2, batter: 3 }, startingPitcherSlots: { opponent: 1, ours: 2 },
      },
      random,
    )
    expect(random.rolls).toEqual([2])
  })
})

describe('시즌 상대 팀 마선수 — 0xdd 진입 0x6548 (66ee 0x66968 → 6700 0x66994)', () => {
  it('seasonOpponentAces 면 상대 팀에 마투수 8번·마타자 9번이 들어간다 — 난수 +2 (rand(0,5) 둘)', () => {
    const random = 세는난수(createSeededRandom(20100901))
    const progress = startTeamGame({ ...기본옵션, acePitcherId: 1, aceBatterId: 2, seasonOpponentAces: true }, random)
    expect(random.rolls.slice(0, 2)).toEqual([5, 5])
    expect(progress.opponentAcePitcherIndex).not.toBe(1)
    expect(progress.opponentAceBatterIndex).not.toBe(2)
    expect(progress.opponentPitcherEntry[8]?.aceIndex).toBe(progress.opponentAcePitcherIndex)
    expect(progress.opponentEntry[9]?.aceIndex).toBe(progress.opponentAceBatterIndex)
  })

  it('표시가 없으면(국가대항전·0xdd 를 안 지나는 길) 굴리지 않는다', () => {
    const random = 세는난수(createSeededRandom(20100901))
    const progress = startTeamGame({ ...기본옵션, acePitcherId: 1, aceBatterId: 2 }, random)
    expect(random.rolls.slice(0, 2)).not.toEqual([5, 5])
    expect(progress.opponentAcePitcherIndex).toBe(-1)
  })
})

describe('투수 스태미나를 경기 사이에 잇는다 — 레코드 +0x2c (a583fe0)', () => {
  const 전부자동설정 = { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } as const

  it('선발은 넘긴 시작 스태미나로 선다 — 명단 차례로 찾는다', () => {
    const { progress } = 시작({
      dayCounter: 1,
      ourEntryOrder: { batters: Array.from({ length: 12 }, (_u, i) => ({ rosterSlot: i, position: 0 })), pitchers: [0, 1, 2, 3, 4, 5, 6, 7] },
      ourPitcherStaminas: [10_000, 6_000, 10_000, 10_000],
      opponentPitcherStaminas: [10_000, 4_500],
    })
    expect(progress.stamina).toBe(6_000)
    expect(progress.opponentStamina).toBe(4_500)
    // 모자란 칸·마투수는 10000
    expect(progress.ourPitcherStaminas[7]).toBe(10_000)
  })

  it('내려간 투수의 깎인 값은 남고 올라온 투수는 제 값으로 선다', () => {
    const { progress } = 시작({ ourPitcherStaminas: [10_000, 3_000] })
    const 깎임 = { ...progress, stamina: 7_000 }
    const 바꾼뒤 = changePitcher(깎임, 1, createSeededRandom(0))
    expect(바꾼뒤.stamina).toBe(3_000)
    expect(바꾼뒤.ourPitcherStaminas[0]).toBe(7_000)
  })

  it('요약의 끝 스태미나는 명단 차례 그대로이고 던진 투수는 깎여 있다 (간이 엔진 소모 0xa5e14 포함)', () => {
    const { progress } = 시작({ settings: 전부자동설정, acePitcherId: 0 })
    expect(progress.game.isFinished).toBe(true)
    const summary = summaryOf(progress)
    // 마투수는 빼고 표 여덟 칸
    expect(summary.ourPitcherStaminas).toHaveLength(8)
    expect(summary.opponentPitcherStaminas).toHaveLength(8)
    expect(summary.ourPitcherStaminas?.[0]).toBeLessThan(10_000)
    expect(summary.opponentPitcherStaminas?.[0]).toBeLessThan(10_000)
    // 안 던진 투수는 그대로
    const 던진칸 = new Set([...progress.ourUsedPitchers, progress.ourPitcherIndex])
    summary.ourPitcherStaminas?.forEach((value, index) => {
      if (!던진칸.has(index)) expect(value).toBe(10_000)
    })
  })

  it('끝 값을 다음 경기에 넘기면 그 투수가 깎인 채로 선다', () => {
    const 첫경기 = summaryOf(시작({ settings: 전부자동설정 }).progress)
    // 사람이 첫 공을 잡는 설정이라 아직 한 공도 안 나갔다 (후공 — 1회초 우리 수비)
    const { progress } = 시작({ ourPitcherStaminas: 첫경기.ourPitcherStaminas }, 99)
    expect(progress.pitchCount).toBe(0)
    // 같은 날(g = 0)이면 같은 선발 — 깎인 값에서 시작한다
    expect(progress.ourPitcherIndex).toBe(0)
    expect(progress.stamina).toBe(첫경기.ourPitcherStaminas?.[0])
    expect(progress.stamina).toBeLessThan(10_000)
  })
})

describe('돌발 경기 기록 검사 0x8ec9c — 공격 팀 지금 타순 칸 +0x12·+0x13 · 수비 투수 0xb8cec[0]', () => {
  it('사람 공격이면 우리 타순 칸 안타·홈런과 상대 지금 투수의 탈삼진을 본다 (팀 누계가 아니다)', () => {
    const { progress } = 시작()
    const slot = progress.game.battingOrderIndex
    const ourEntryRecords = progress.ourEntryRecords.map((record, index) =>
      index === slot ? { ...record, hits: 2, homeRuns: 1 } : { ...record, hits: 5, homeRuns: 3 },
    )
    const 상대투수 = progress.opponentPitcherEntry[progress.opponentPitcherIndex]
    const pitcherLines =
      상대투수?.tableSlot === undefined
        ? progress.pitcherLines
        : [
            {
              teamId: progress.options.opponentTeamId,
              pitcherSlot: 상대투수.tableSlot,
              outs: 3,
              runsAllowed: 0,
              strikeouts: 4,
              pitches: 20,
            },
          ]
    const 기록 = burstGameRecordOf({ ...progress, ourEntryRecords, ourHits: 9, pitcherLines }, true)
    expect(기록.hitsInGame).toBe(2)
    expect(기록.homeRunsInGame).toBe(1)
    expect(기록.strikeoutsInGame).toBe(상대투수?.tableSlot === undefined ? 0 : 4)
  })

  it('사람 수비면 상대 타순 칸 안타·홈런(+0x12·+0x13)과 우리 지금 투수의 탈삼진(R[0])을 본다', () => {
    const { progress } = 시작()
    const slot = progress.opponentOrderIndex
    const opponentEntryRecords = progress.opponentEntryRecords.map((record, index) =>
      index === slot ? { ...record, hits: 1, homeRuns: 1 } : record,
    )
    const 기록 = burstGameRecordOf(
      { ...progress, opponentEntryRecords, recordTally: { ...progress.recordTally, moundStrikeouts: 6 } },
      false,
    )
    expect(기록).toEqual({ hitsInGame: 1, homeRunsInGame: 1, strikeoutsInGame: 6 })
  })
})

describe("사람 '#' 교체 뒤 0x16 → 0xd → 0xe → 0xf 재진입 · 교체 창 취소(→ 0xe) · 코스 CLR(0x10 → 0xf, 0x50ee6)", () => {
  /** 우리 공격 · 상대 투수가 다 지쳐 0xf 진입 0x3d954 의 0xac428 이 바꾸는 판 */
  const 지친상대 = () => {
    const { progress } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    return { ...progress, opponentStamina: 0 }
  }

  it('대타를 내면 다시 들어선 0xf 진입이 상대 투수 교체를 묻는다 — 카운트·연속 파울은 그대로 (0x16 → 0xd 가 지우기를 건너뜀)', () => {
    const 판 = {
      ...지친상대(),
      atBat: createAtBat({ balls: 2, strikes: 1 }),
      recordTally: { ...지친상대().recordTally, foulStreak: 2 },
    }
    const 대타 = pinchHit(판, 9)
    expect(대타.ourEntry[판.game.battingOrderIndex]?.name).toBe(판.ourEntry[9]?.name)
    // 0x16 → 0xd → 0xe 에 서서 OK 를 기다린다 — 0xf 진입은 OK 뒤
    expect(대타.sceneConfirmPending).toBe(true)
    expect(대타.opponentPitcherIndex).toBe(판.opponentPitcherIndex)
    const 뒤 = confirmScene(대타, createSeededRandom(1))
    expect(뒤.opponentPitcherIndex).not.toBe(판.opponentPitcherIndex)
    expect(뒤.scenePitcherChange?.serial).toBe(1)
    expect(뒤.atBatPrepared).toBe(true)
    expect(뒤.atBat.balls).toBe(2)
    expect(뒤.atBat.strikes).toBe(1)
    expect(뒤.recordTally.foulStreak).toBe(2)
  })

  it('교체 창을 취소해도(0x495fc 의 #·CLR → 0xe) 0xf 진입을 다시 지난다', () => {
    const 판 = 지친상대()
    const 취소 = cancelSubstitution(판)
    expect(취소.sceneConfirm).not.toBe(판.sceneConfirm)
    expect(취소.opponentPitcherIndex).toBe(판.opponentPitcherIndex)
    const 뒤 = confirmScene(취소, createSeededRandom(1))
    expect(뒤.opponentPitcherIndex).not.toBe(판.opponentPitcherIndex)
    // 경기가 끝났거나 사람 차례가 아니면 아무 일도 없다
    expect(cancelSubstitution({ ...판, atBatPrepared: false }, createSeededRandom(1))).toEqual({ ...판, atBatPrepared: false })
  })

  it('투수를 바꾸면 다시 들어선 0xf 진입이 CPU 대타(0xac228)를 묻는다 — 굴림 rand(0,1000)', () => {
    // 모드 1 — 돌발 객체가 없어 rand(0,1000) 이 돌발 확률 굴림(0x8ec64)과 섞이지 않는다
    const { progress } = 시작({ mode: 1 })
    const slot = progress.opponentOrderIndex
    // 막음 조건을 다 지나는 타순 칸 기록 (타석 둘 · 안타 없음)
    const 판 = {
      ...progress,
      opponentEntryRecords: progress.opponentEntryRecords.map((record, index) =>
        index === slot ? { hits: 0, homeRuns: 0, plateAppearances: 2 } : record,
      ),
    }
    const random = 세는난수(createSeededRandom(1))
    const 바꾼뒤 = changePitcher(판, availablePitchers(판)[0]!, random)
    // 확정은 0x16 → 0xd → 0xe 까지 — 굴림은 OK 뒤다
    expect(random.rolls).toEqual([])
    confirmScene(바꾼뒤, random)
    expect(random.rolls).toContain(1000)
  })

  it('코스 고르기에서 CLR 로 구질 고르기로 돌아가면 0xf 진입이 다시 돈다 — 사람 수비라 CPU 대타를 묻는다', () => {
    const { progress } = 시작({ mode: 1 })
    const slot = progress.opponentOrderIndex
    const 판 = {
      ...progress,
      opponentEntryRecords: progress.opponentEntryRecords.map((record, index) =>
        index === slot ? { hits: 0, homeRuns: 0, plateAppearances: 2 } : record,
      ),
    }
    expect(isPitchTurn(판)).toBe(true)
    const random = 세는난수(createSeededRandom(1))
    returnToPitchSelection(판, random)
    expect(random.rolls).toContain(1000)
    // 돌발 굴림(0xe 메시지 1 몫)은 없다 — 사람이 칠 차례에는 아무 일도 없다
    const 공격 = 지친상대()
    expect(returnToPitchSelection(공격, createSeededRandom(1))).toBe(공격)
  })
})

describe('출루 허용 state[0x88] — 정산 0xa8c5c~0xa8ca6 은 주자 목록의 마지막 원소만 본다', () => {
  /** 사람 수비 타석에서 인플레이 타구가 붙들린 판 (수비 화면 전) */
  function 수비판(): { progress: TeamGameProgress; random: RandomPort } {
    for (let seed = 1; seed < 200; seed += 1) {
      const random = createSeededRandom(seed)
      let current = startTeamGame(기본옵션, random)
      for (let pitch = 0; pitch < 60 && isPitchTurn(current); pitch += 1) {
        current = startThrowPitch(current, { typeNumber: 첫구질(current), courseCell: 4, gaugeCell: 0 }, random)
        if (current.pendingDefensePlay !== null) {
          if (current.pitching.allowedBaserunner) break
          return { progress: current, random }
        }
      }
    }
    throw new Error('붙들린 수비 판을 못 찾았다')
  }

  it('야수선택(타자주자 살고 앞 주자 아웃)은 출루로 안 친다 — 목록 [타자주자, 1루] 의 마지막이 처리 끝', () => {
    const { progress, random } = 수비판()
    const 결과 = runDefensePlay(progress.pendingDefensePlay!.input)
    const 야수선택 = {
      ...결과,
      runnerFates: [
        { fromBase: 0, scored: false, retired: false },
        { fromBase: 1, scored: false, retired: true },
      ],
    }
    expect(resolveDefensePlay(progress, 야수선택, random).pitching.allowedBaserunner).toBe(false)
  })

  it('에러로 산 타자주자(목록 마지막이 살아 있음)는 출루다', () => {
    const { progress, random } = 수비판()
    const 결과 = runDefensePlay(progress.pendingDefensePlay!.input)
    const 에러출루 = { ...결과, runnerFates: [{ fromBase: 0, scored: false, retired: false }] }
    expect(resolveDefensePlay(progress, 에러출루, random).pitching.allowedBaserunner).toBe(true)
  })
})

describe('36 필살송구 아웃 — 결과 코드 0xd(그 판의 아웃 판정) · 0x46892 → state[0x8b] → 0xa80f8', () => {
  /** 사람 수비 타석에서 인플레이 타구가 붙들린 판 */
  function 수비판(): { progress: TeamGameProgress; random: RandomPort } {
    for (let seed = 1; seed < 200; seed += 1) {
      const random = createSeededRandom(seed)
      let current = startTeamGame(기본옵션, random)
      for (let pitch = 0; pitch < 60 && isPitchTurn(current); pitch += 1) {
        current = startThrowPitch(current, { typeNumber: 첫구질(current), courseCell: 4, gaugeCell: 0 }, random)
        if (current.pendingDefensePlay !== null && current.game.outs === 0) return { progress: current, random }
        if (current.pendingDefensePlay !== null) break
      }
    }
    throw new Error('붙들린 수비 판을 못 찾았다')
  }

  it('안타 타석이라도 레이저 판에 아웃이 나면 36 — 타석 결과가 아니라 판의 아웃이다', () => {
    const { progress, random } = 수비판()
    const 안타판 = {
      ...progress,
      pendingDefensePlay: { ...progress.pendingDefensePlay!, outcome: { kind: '안타', bases: 1 } as const },
    }
    const 결과 = runDefensePlay(progress.pendingDefensePlay!.input)
    const 레이저 = { ...결과, laserThrow: true, advance: { ...결과.advance, outsAdded: 1, runsScored: 0 } }
    expect(resolveDefensePlay(안타판, 레이저, random).recordIds).toContain(36)
  })

  it('아웃 타석이라도 판에 아웃이 없으면(에러로 삶) 36 이 없다', () => {
    const { progress, random } = 수비판()
    const 결과 = runDefensePlay(progress.pendingDefensePlay!.input)
    const 아웃없음 = { ...결과, laserThrow: true, advance: { ...결과.advance, outsAdded: 0, runsScored: 0 } }
    const 아웃타석 = {
      ...progress,
      pendingDefensePlay: { ...progress.pendingDefensePlay!, outcome: { kind: '아웃', detail: '땅볼아웃' } as const },
    }
    expect(resolveDefensePlay(아웃타석, 아웃없음, random).recordIds).not.toContain(36)
  })
})

describe('트레이드로 옮겨 온 선수 — 표 팀 + 칸으로 서고 그 자리로 쌓는다 (0xb8680 레코드 · 0xa8024 +0x20~)', () => {
  /** 1팀 레코드: 0번 타자 자리에 5팀 표 0번 타자, 0번 투수 자리에 5팀 표 0번 투수 */
  const 상대차례 = {
    batters: Array.from({ length: 12 }, (_u, i) =>
      i === 0 ? { rosterSlot: 0, position: 2, tableTeamId: 5 } : { rosterSlot: i, position: teamBatters(1)[i]?.position ?? 0 }),
    pitchers: [{ tableTeamId: 5, tableSlot: 0 }, 1, 2, 3, 4, 5, 6, 7],
  }

  it('상대 명단을 그 팀 레코드 차례(opponentEntryOrder)로 세운다 — 옮겨 온 선수는 옛 팀 표 행이다', () => {
    const { progress } = 시작({ opponentEntryOrder: 상대차례, opponentPitcherOrder: [0, 1, 2, 3, 4, 5, 6, 7] })
    expect(progress.opponentEntry[0]).toMatchObject({ name: teamBatters(5)[0]!.name, rosterSlot: 0, tableTeamId: 5, position: 2 })
    expect(progress.opponentEntry[1]).toMatchObject({ name: teamBatters(1)[1]!.name, rosterSlot: 1 })
    expect(progress.opponentEntry[1]?.tableTeamId).toBeUndefined()
    expect(progress.opponentPitcherEntry[0]).toMatchObject({ name: teamPitchers(5)[0]!.name, tableSlot: 0, tableTeamId: 5, orderIndex: 0 })
  })

  it('표와 같은 차례를 넘기면 명단·난수가 넘기지 않은 것과 같다', () => {
    const 표차례 = {
      batters: teamBatters(1).map((player, i) => ({ rosterSlot: i, position: player.position ?? 0 })),
      pitchers: [0, 1, 2, 3, 4, 5, 6, 7],
    }
    const plain = 시작({ opponentPitcherOrder: [1, 2, 3, 0, 4, 5, 6, 7] })
    const same = 시작({ opponentEntryOrder: 표차례, opponentPitcherOrder: [1, 2, 3, 0, 4, 5, 6, 7] })
    expect(same.progress.opponentEntry).toEqual(plain.progress.opponentEntry)
    expect(same.progress.opponentPitcherEntry).toEqual(plain.progress.opponentPitcherEntry)
    expect(summaryOf(끝까지(same.progress, same.random))).toEqual({
      ...summaryOf(끝까지(plain.progress, plain.random)),
    })
  })

  it('옮겨 온 타자·투수의 타석·투구 줄은 옛 팀 표 자리로 쌓인다 — 경기 팀 표의 같은 칸이 아니다', () => {
    const { progress, random } = 시작({ opponentEntryOrder: 상대차례, opponentPitcherOrder: [0, 1, 2, 3, 4, 5, 6, 7] })
    const summary = summaryOf(끝까지(progress, random))
    expect(summary.leaguePlateAppearances.some((line) => line.teamId === 5 && line.battingOrderIndex === 0)).toBe(true)
    expect(summary.leaguePlateAppearances.some((line) => line.teamId === 1 && line.battingOrderIndex === 0)).toBe(false)
    const lines = summary.leaguePitchers!.lines
    expect(lines.some((line) => line.teamId === 5 && line.pitcherSlot === 0)).toBe(true)
    expect(lines.some((line) => line.teamId === 1 && line.pitcherSlot === 0)).toBe(false)
  })

  it('판정 받은 투수가 옮겨 온 투수면 요약에 그 표 팀을 싣는다 (decisionTableTeams) — 없으면 칸째 없다', () => {
    let seen = false
    for (let seed = 1; seed < 30 && !seen; seed += 1) {
      const { progress, random } = 시작({ opponentEntryOrder: 상대차례, opponentPitcherOrder: [0, 1, 2, 3, 4, 5, 6, 7] }, seed)
      const pitchers = summaryOf(끝까지(progress, random)).leaguePitchers!
      const teams = pitchers.decisionTableTeams
      if (teams === undefined) continue
      for (const key of ['winner', 'loser', 'save'] as const) {
        if (teams[key] === undefined) continue
        expect(teams[key]).toBe(5)
        expect(pitchers.decision[key]?.number).toBe(0)
        seen = true
      }
    }
    expect(seen).toBe(true)
    const { progress, random } = 시작()
    expect(summaryOf(끝까지(progress, random)).leaguePitchers).not.toHaveProperty('decisionTableTeams')
  })

  it('내 팀 차례에 실린 표 팀 + 칸(ourEntryOrder)도 같다', () => {
    const { progress } = 시작({
      ourEntryOrder: {
        batters: Array.from({ length: 12 }, (_u, i) =>
          i === 3 ? { rosterSlot: 7, position: 4, tableTeamId: 6 } : { rosterSlot: i, position: 0 }),
        pitchers: [0, 1, { tableTeamId: 6, tableSlot: 5 }, 3, 4, 5, 6, 7],
      },
    })
    expect(progress.ourEntry[3]).toMatchObject({ name: teamBatters(6)[7]!.name, rosterSlot: 7, tableTeamId: 6 })
    // 다른 표 팀의 칸은 경기 팀 표 칸을 차지하지 않는다
    expect(progress.ourEntry.map((batter) => batter.rosterSlot)).toEqual([0, 1, 2, 7, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(progress.ourPitcherEntry[2]).toMatchObject({ name: teamPitchers(6)[5]!.name, tableSlot: 5, tableTeamId: 6 })
  })
})

describe('영입한 표 밖 선수(명전·나리)는 원본 id 로 제 줄에 쌓는다 (0xa8024 → 0xa56dc 모드 2 갈래 0xa56fa)', () => {
  const 명전타자 = { name: '명전타자', ability: [901, 802, 703, 604] as const, recordId: 0xc8 }
  const 명전투수 = {
    name: '명전투수',
    ability: [880, 870, 860, 850] as const,
    repertoire: { name: '명전투수', form: 2, magicId: 0, pitchMask: 0b1011 },
    recordId: 0xb4,
  }
  const 차례 = {
    batters: [
      { rosterSlot: -1, position: 6, record: 명전타자 },
      ...Array.from({ length: 11 }, (_u, i) => ({ rosterSlot: i + 1, position: i < 8 ? i + 1 : 0 })),
    ],
    pitchers: [명전투수, 1, 2, 3, 4, 5, 6, 7],
  }

  it('타석은 recordId 로, 투수 줄은 칸 −1 · recordId 로 실린다', () => {
    const { progress, random } = 시작({ ourEntryOrder: 차례, dayCounter: 0, playerSide: PLAYER_SIDE_LAST_BAT })
    expect(progress.ourEntry[0]).toMatchObject({ rosterSlot: -1, recordId: 0xc8 })
    expect(progress.ourPitcherEntry[0]).toMatchObject({ recordId: 0xb4 })
    const summary = summaryOf(끝까지(progress, random))
    const 명전타석 = summary.leaguePlateAppearances.filter((line) => line.recordId === 0xc8)
    expect(명전타석.length).toBeGreaterThan(0)
    expect(명전타석.every((line) => line.teamId === 0 && line.battingOrderIndex === -1)).toBe(true)
    const 명전줄 = summary.leaguePitchers!.lines.filter((line) => line.recordId === 0xb4)
    expect(명전줄).toHaveLength(1)
    expect(명전줄[0]).toMatchObject({ teamId: 0, pitcherSlot: -1 })
    expect(명전줄[0]!.pitches).toBeGreaterThan(0)
  })

  it('recordId 없이 실린 기록(예전 모양)은 예전처럼 쌓지 않는다', () => {
    const { progress, random } = 시작({
      ourEntryOrder: {
        batters: [{ rosterSlot: -1, position: 6, record: { name: '명전타자', ability: [901, 802, 703, 604] } }, ...차례.batters.slice(1)],
        pitchers: [{ ...명전투수, recordId: undefined }, 1, 2, 3, 4, 5, 6, 7],
      },
      dayCounter: 0,
    })
    const summary = summaryOf(끝까지(progress, random))
    expect(summary.leaguePlateAppearances.some((line) => line.recordId !== undefined)).toBe(false)
    expect(summary.leaguePitchers!.lines.some((line) => line.recordId !== undefined || line.pitcherSlot < 0)).toBe(false)
  })
})

describe('상태 0xe 의 OK 대기 (0x39e14 → 0x532b0) — 진행기가 0xe 에 들어설 때마다 새 대기를 싣는다', () => {
  it('첫 사람 타석 앞(0x18 → 0xd → 0xe)에 대기가 서 있다 — 공격이든 수비든', () => {
    expect(시작().progress.sceneConfirm).not.toBeNull()
    expect(시작({ playerSide: PLAYER_SIDE_FIRST_BAT }).progress.sceneConfirm).not.toBeNull()
  })

  it('타석이 끝나 다음 타자(0xd)면 새 대기, 같은 타석 다음 공(0xf)이면 그대로다', () => {
    const { progress, random } = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    const 처음 = progress.sceneConfirm
    const 다음타자 = applyBatterOutcome(progress, { kind: '아웃', detail: '뜬공아웃' }, random)
    expect(isBatterTurn(다음타자)).toBe(true)
    expect(다음타자.sceneConfirm).not.toBe(처음)
    expect(다음타자.sceneConfirm?.entries).toBeGreaterThanOrEqual(1)

    const 수비 = 시작()
    const 한공 = throwPitch(수비.progress, { typeNumber: 첫구질(수비.progress), courseCell: 4, gaugeCell: 0 }, 수비.random)
    if (한공.atBat.balls + 한공.atBat.strikes > 0 && 한공.scenePinchHit === 수비.progress.scenePinchHit) {
      expect(한공.sceneConfirm).toBe(수비.progress.sceneConfirm)
    }
  })

  it('# 교체 확정·교체 창 취소 뒤는 0x16(또는 곧장) → 0xe 라 새 대기다 (0x495fc)', () => {
    const { progress } = 시작()
    const 바꾼뒤 = changePitcher(progress, availablePitchers(progress)[0]!, createSeededRandom(0))
    expect(바꾼뒤.sceneConfirm).not.toBe(progress.sceneConfirm)
    const 취소 = cancelSubstitution(progress, createSeededRandom(0))
    expect(취소.sceneConfirm).not.toBe(progress.sceneConfirm)
  })

  it('OK 뒤 0xf 진입이 CPU 교체를 내면 0x16 → 0xd → 0xe 로 다시 서서 OK 를 또 기다린다 — 그 OK 뒤에 다시 굴린다', () => {
    let 다시섬 = 0
    for (let seed = 0; seed < 6; seed += 1) {
      const random = createSeededRandom(seed)
      let current = startTeamGame({ ...기본옵션, mode: 1 }, random)
      for (let step = 0; step < 3_000 && !current.game.isFinished; step += 1) {
        const before = current
        if (current.sceneConfirmPending === true) {
          current = confirmScene(current, random)
          const 교체 =
            current.scenePinchHit?.serial !== before.scenePinchHit?.serial ||
            current.scenePitcherChange?.serial !== before.scenePitcherChange?.serial
          if (교체) {
            다시섬 += 1
            expect(current.sceneConfirmPending).toBe(true)
            expect(current.sceneConfirm).not.toBe(before.sceneConfirm)
          } else {
            expect(current.sceneConfirmPending).toBe(false)
          }
          continue
        }
        current = isPitchTurn(current)
          ? throwPitch(current, { typeNumber: 첫구질(current), courseCell: 4, gaugeCell: 0 }, random)
          : applyBatterOutcome(current, { kind: '아웃', detail: '뜬공아웃' }, random)
      }
    }
    expect(다시섬).toBeGreaterThan(0)
  })

  it("0xe 에서 '#' 교체 창을 열어 취소하거나 투수를 바꿔도 OK 뒤 굴림은 한 번 — 안 열고 OK 한 것과 굴림 차례가 같다", () => {
    /** 모든 굴림(next · nextInRange · pick)을 차례대로 적는다 */
    const 적는난수 = (seed: number) => {
      const inner = createSeededRandom(seed)
      const log: string[] = []
      const random: RandomPort = {
        next: () => {
          const value = inner.next()
          log.push(`next ${value}`)
          return value
        },
        nextInRange: (minimum, maximum) => {
          const value = inner.nextInRange(minimum, maximum)
          log.push(`range ${minimum}..${maximum} ${value}`)
          return value
        },
        pick: (candidates) => {
          const value = inner.pick(candidates)
          log.push('pick')
          return value
        },
      }
      return { random, log }
    }
    /** 사람 수비 · 0xf 진입의 CPU 대타 0xac228 이 rand(0,1000) 을 굴리는 판 (막음 조건을 다 지나는 타순 칸 기록) */
    const 대타판 = (mode: number) => {
      const { progress } = 시작({ mode })
      const slot = progress.opponentOrderIndex
      return {
        ...progress,
        opponentEntryRecords: progress.opponentEntryRecords.map((record, index) =>
          index === slot ? { hits: 0, homeRuns: 0, plateAppearances: 2 } : record,
        ),
      }
    }
    /** 사람 공격 · 상대 투수가 다 지쳐 0xac428 이 바꾸는 판 */
    const 지친판 = (mode: number) => ({ ...시작({ mode, playerSide: PLAYER_SIDE_FIRST_BAT }).progress, opponentStamina: 0 })
    for (const progress of [대타판(1), 대타판(2), 지친판(1), 지친판(2)]) {
      const 대타판임 = !isBatterTurn(progress)
      expect(progress.sceneConfirmPending).toBe(true)
      // 안 열고 OK
      const 그냥 = 적는난수(7)
      const 바로 = confirmScene(progress, 그냥.random)
      // 0xe 에서 '#' → 취소(→ 0xe) → OK
      const 취소길 = 적는난수(7)
      const 취소 = cancelSubstitution(progress)
      expect(취소길.log).toEqual([])
      const 취소뒤 = confirmScene(취소, 취소길.random)
      if (대타판임) expect(그냥.log.length).toBeGreaterThan(0)
      expect(취소길.log).toEqual(그냥.log)
      expect(취소뒤.burst).toEqual(바로.burst)
      expect(취소뒤.opponentPitcherIndex).toBe(바로.opponentPitcherIndex)
      expect(취소뒤.ourEntry).toEqual(바로.ourEntry)
    }
    // 우리 수비 — '#' 투수 교체 확정(0x16 → 0xd → 0xe)도 굴림 없이 0xe 에 다시 서고, OK 뒤에야 굴린다
    const progress = 대타판(1)
    const 바꾼뒤 = changePitcher(progress, availablePitchers(progress)[0]!)
    expect(바꾼뒤.sceneConfirmPending).toBe(true)
    expect(바꾼뒤.sceneConfirm).not.toBe(progress.sceneConfirm)
    const 교체길 = 적는난수(7)
    confirmScene(바꾼뒤, 교체길.random)
    expect(교체길.log.length).toBeGreaterThan(0)
  })
})
