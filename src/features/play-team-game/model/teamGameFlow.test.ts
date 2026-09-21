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
  currentBatterAbility,
  currentPitcherAbility,
  isBatterTurn,
  isPitchTurn,
  ourPitcherStats,
  pitchSlotsFor,
  startTeamGame,
  summaryOf,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
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
