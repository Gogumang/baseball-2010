import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  pitchSlotsFor,
  resolveRunnerPlay,
  startTeamGame,
  startThrowPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { aimAfterTicks } from '@/features/play-pitcher-game/model/pitchAim'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

/** 0.1% 폭투·포일 굴림 `T > rand(0, 10000)`(0x35058)을 `n` 번째 rand(0, 10000) 에서 세운다 — 굴림 수는 그대로 */
function 폭투난수(seed: number, n: number): RandomPort {
  const base = createSeededRandom(seed)
  let count = 0
  return {
    ...base,
    rand: (lo: number, hi: number) => {
      const value = base.rand(lo, hi)
      if (lo === 0 && hi === 10_000 && count++ === n) return 0
      return value
    },
  }
}

function 첫구질(progress: TeamGameProgress): number {
  return pitchSlotsFor(progress).find((slot) => slot.typeNumber !== 0)?.typeNumber ?? 1
}

/** 우리 수비 · 2루 주자 · 2스트라이크에서 공 하나 — 화면이 도는 갈래라 주자 판을 붙든다 */
function 붙든판(outs: number, balls: number, random: RandomPort) {
  const progress = startTeamGame(기본옵션, createSeededRandom(20100901))
  const before: TeamGameProgress = {
    ...progress,
    game: { ...progress.game, outs, bases: { first: false, second: true, third: false } },
    atBat: { ...progress.atBat, balls, strikes: 2 },
  }
  const pitch = { typeNumber: 첫구질(before), aim: aimAfterTicks(1, { dx: -1, dy: 1 }, 11), gaugeCell: 0 }
  return { before, 붙듦: startThrowPitch(before, pitch, random), random }
}

describe('팀 경기 우리 수비 삼진 + 도루 판 — 같은 정산 안에서 36(a80f8)이 24(a83de)보다 먼저', () => {
  it('필살송구로 도루 주자를 잡으면 삼진 콜 → 36 → 24 → 26', () => {
    const random = createSeededRandom(1273)
    const { before, 붙듦 } = 붙든판(0, 0, random)
    const pending = 붙듦.pendingRunnerPlay
    if (pending?.kind !== 'arrival' || pending.opened.kind !== 5) throw new Error('삼진 + 도루 판이 안 열렸다')
    expect(붙듦.atBat.outcome?.kind).toBe('삼진')
    const played = runLiveRunnerPlayWithoutKeys(pending)
    const caught = {
      ...played,
      laserOutFlag: true,
      advance: { ...played.advance, bases: { first: false, second: false, third: false }, outsAdded: 1, runsScored: 0 },
      runnerFates: played.runnerFates.map((fate) => (fate.fromBase === 2 ? { ...fate, retired: true, scored: false } : fate)),
    }
    const 끝 = resolveRunnerPlay(붙듦, caught, random)
    const added = 끝.recordIds.slice(before.recordIds.length)
    expect(added.filter((id) => id === 36 || id === 24 || id === 26)).toEqual([36, 24, 26])
    expect(added.filter((id) => id === 36)).toHaveLength(1)
  })
})

describe('팀 경기 우리 수비 낫아웃(state[0x1a]) — 삼진 사건 5 가 [sp+0x30] 에 하나 더 든다', () => {
  const 낫아웃 = () => 붙든판(1, 3, 폭투난수(23, 1))

  it('타자주자 · 2루 주자를 함께 잡으면 26 이 아니라 27 · R[3] 은 판의 아웃 · 투수 줄 +0x20 은 하나 더', () => {
    const { before, 붙듦, random } = 낫아웃()
    const pending = 붙듦.pendingRunnerPlay
    if (pending?.kind !== 'arrival' || pending.opened.kind !== 9) throw new Error('낫아웃 판이 안 열렸다')
    const played = runLiveRunnerPlayWithoutKeys(pending)
    const 둘잡음 = {
      ...played,
      advance: { ...played.advance, bases: { first: false, second: false, third: false }, outsAdded: 2, runsScored: 0 },
      runnerFates: [
        { fromBase: 0, scored: false, retired: true },
        { fromBase: 2, scored: false, retired: true },
      ],
    }
    const 끝 = resolveRunnerPlay(붙듦, 둘잡음, random)
    const added = 끝.recordIds.slice(before.recordIds.length)
    expect(added).toContain(27)
    expect(added).not.toContain(26)
    // a8f8c R[3] += 3 · a8fa8 −1
    expect(끝.recordTally.moundOuts).toBe(before.recordTally.moundOuts + 2)
    const 우리줄아웃 = (progress: TeamGameProgress) =>
      progress.pitcherLines
        .filter((line) => line.teamId === progress.options.ourTeamId)
        .reduce((sum, line) => sum + line.outs, 0)
    // a8cb0 +0x20 += [sp+0x30] — 보정 없음(원본 그대로)
    expect(우리줄아웃(끝) - 우리줄아웃(before)).toBe(3)
  })

  it('타자주자만 잡히면 [sp+0x30] 2 여도 26 이 없고 R[1] 콤보가 끊긴다', () => {
    const { before, 붙듦, random } = 낫아웃()
    const pending = 붙듦.pendingRunnerPlay
    if (pending?.kind !== 'arrival' || pending.opened.kind !== 9) throw new Error('낫아웃 판이 안 열렸다')
    const played = runLiveRunnerPlayWithoutKeys(pending)
    const 타자잡음 = {
      ...played,
      advance: { ...played.advance, bases: { first: false, second: true, third: false }, outsAdded: 1, runsScored: 0 },
      runnerFates: [
        { fromBase: 0, scored: false, retired: true },
        { fromBase: 2, scored: false, retired: false },
      ],
    }
    const 끝 = resolveRunnerPlay(
      { ...붙듦, recordTally: { ...붙듦.recordTally, moundStrikeoutCombo: 1 } },
      타자잡음,
      random,
    )
    expect(끝.recordIds.slice(before.recordIds.length)).not.toContain(26)
    expect(끝.recordTally.moundStrikeoutCombo).toBe(0)
    expect(끝.recordTally.moundStrikeouts).toBe(before.recordTally.moundStrikeouts + 1)
  })
})
