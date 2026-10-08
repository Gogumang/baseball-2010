import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import {
  applyBatterOutcome,
  isBatterTurn,
  isPitchTurn,
  pitchSlotsFor,
  resumeTeamGame,
  startTeamGame,
  throwPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 일반옵션: TeamGameOptions = {
  mode: 1,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_FIRST_BAT,
  settings: FULL_PLAY_SETTINGS,
}

function 첫구질(progress: TeamGameProgress): number {
  return pitchSlotsFor(progress).find((slot) => slot.typeNumber !== 0)?.typeNumber ?? 1
}

/** 사람 차례 하나를 아웃으로 소화한다 (치면 뜬공 아웃, 던지면 첫 구질) */
function 한타석(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (isBatterTurn(progress)) return applyBatterOutcome(progress, { kind: '아웃', detail: '뜬공아웃' }, random)
  if (isPitchTurn(progress)) return throwPitch(progress, { typeNumber: 첫구질(progress), courseCell: 4, gaugeCell: 0 }, random)
  throw new Error('사람 차례가 아니다')
}

/** 반 이닝이 바뀔 때까지 */
function 반이닝끝까지(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const { inning, half } = progress.game
  let current = progress
  for (let step = 0; step < 500 && current.game.inning === inning && current.game.half === half; step += 1) {
    current = 한타석(current, random)
  }
  return current
}

/** 난수를 몇 번 먹었는지 센다 */
function 세는난수(seed: number): { random: RandomPort; count: () => number } {
  const inner = createSeededRandom(seed)
  let calls = 0
  return {
    random: {
      rand: (lo, hi) => {
        calls += 1
        return inner.rand(lo, hi)
      },
      rand9d: (n) => {
        calls += 1
        return inner.rand9d(n)
      },
    } as RandomPort,
    count: () => calls,
  }
}

describe('이어하기 자동 저장 0x4f928 — 상태 0x18 틱 0', () => {
  it('경기를 세우면 경기정보 OK(0x3136e)의 저장이 서 있다 — 1회초 아웃 0, 저장 안의 저장은 비어 있다', () => {
    const progress = startTeamGame(일반옵션, createSeededRandom(1))
    const save = progress.halfInningSave
    expect(save).toBeTruthy()
    expect(save?.game.inning).toBe(1)
    expect(save?.game.half).toBe('초')
    expect(save?.game.outs).toBe(0)
    expect(save?.halfInningSave).toBeNull()
  })

  it('3아웃으로 반 이닝이 뒤집히면 새 반 이닝 첫머리(아웃 0)를 저장한다 — 같은 반 이닝 안에서는 안 바뀐다', () => {
    const random = createSeededRandom(7)
    const start = startTeamGame(일반옵션, random)
    const oneOut = 한타석(start, random)
    expect(oneOut.halfInningSave).toBe(start.halfInningSave)

    const flipped = 반이닝끝까지(oneOut, random)
    const save = flipped.halfInningSave
    expect(save).not.toBe(start.halfInningSave)
    expect(save?.game.inning).toBe(1)
    expect(save?.game.half).toBe('말')
    expect(save?.game.outs).toBe(0)
    // 판·타석 준비보다 앞이다 — 저장 진행은 아직 타석을 세우지 않았다
    expect(save?.atBatPrepared).toBe(false)
    expect(save?.halfInningSave).toBeNull()
  })

  it('JSON 으로 담았다 꺼내 이어하면 그 반 이닝·점수·명단에서 다시 선다', () => {
    const random = createSeededRandom(11)
    let progress = startTeamGame(일반옵션, random)
    progress = 반이닝끝까지(progress, random)
    progress = 반이닝끝까지(progress, random)
    const save = progress.halfInningSave as TeamGameProgress
    const stored = JSON.parse(JSON.stringify(save)) as TeamGameProgress

    const resumed = resumeTeamGame(stored, createSeededRandom(99))
    expect(resumed.game.inning).toBe(save.game.inning)
    expect(resumed.game.half).toBe(save.game.half)
    expect(resumed.game.ourScore).toBe(save.game.ourScore)
    expect(resumed.game.opponentScore).toBe(save.game.opponentScore)
    expect(resumed.game.battingOrderIndex).toBe(save.game.battingOrderIndex)
    expect(resumed.opponentOrderIndex).toBe(save.opponentOrderIndex)
    expect(resumed.ourEntry).toEqual(save.ourEntry)
    expect(resumed.stamina).toBe(save.stamina)
    expect(resumed.recordIds).toEqual(save.recordIds)
    // 이어 세운 경기도 바로 다음 사람 차례에서 멈춘다
    expect(isBatterTurn(resumed) || isPitchTurn(resumed)).toBe(true)
  })

  it('이어하기는 장면 쪽(기록 ctx·공 +0x10·판)을 비운다 — 저장 블록 쪽(st·팀)은 남긴다', () => {
    const random = createSeededRandom(3)
    const progress = 반이닝끝까지(startTeamGame(일반옵션, random), random)
    const save = progress.halfInningSave as TeamGameProgress
    const dirty: TeamGameProgress = {
      ...save,
      ballMagicNumber: 3,
      recordTally: { ...save.recordTally, homeRunStreak: 2, foulStreak: 2, atBatPitches: 4, pitchCourseConfirmed: true },
      pinchHitHomeRunHalf: { inning: 1, half: '초' },
    }
    const resumed = resumeTeamGame(dirty, createSeededRandom(5))
    expect(resumed.ballMagicNumber).toBe(0)
    expect(resumed.recordTally.homeRunStreak).toBe(0)
    expect(resumed.recordTally.foulStreak).toBe(0)
    // st[0x8c] 는 저장 블록(st 0xa4 바이트) 안이다
    expect(resumed.recordTally.pitchCourseConfirmed).toBe(true)
    expect(resumed.pinchHitHomeRunHalf).toBeNull()
  })

  it('이어 세우는 첫머리 굴림 — 시뮬 초기화 rand(0, 2) 하나 뒤, 판이 서면 0x3fac4 의 36 개', () => {
    const random = createSeededRandom(13)
    // 시즌(모드 2)은 인트로 끝이 늘 0x18 로 간다 — 판이 선다
    const season = { ...일반옵션, mode: 2, season: { illness: 0, morale: 100, coach: -1 } }
    const save = 반이닝끝까지(startTeamGame(season, random), random).halfInningSave as TeamGameProgress

    const counted = 세는난수(21)
    const resumed = resumeTeamGame(save, counted.random)
    expect(resumed.halfInningBoard?.inning).toBe(save.game.inning)
    expect(resumed.halfInningBoard?.half).toBe(save.game.half)
    expect(counted.count()).toBeGreaterThanOrEqual(1 + 36)

    // 일반모드·이닝/전체 설정은 인트로 끝이 곧장 0xd — 판도, 그 굴림도 없다
    const general = 반이닝끝까지(startTeamGame(일반옵션, createSeededRandom(13)), createSeededRandom(14))
    const generalResumed = resumeTeamGame(general.halfInningSave as TeamGameProgress, createSeededRandom(2))
    expect(generalResumed.halfInningBoard).toBeNull()
  })
})
