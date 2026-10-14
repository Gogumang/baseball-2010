import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { resolveRunnerPlay, startPitch, startPitcherGame, summaryOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  dayCounter: 2,
  isPostseason: false,
  stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
  staminaAbility: 400,
  stamina: FULL_STAMINA,
  repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 },
  magicCount: 4,
  teamMorale: 80,
  reputation: 500,
  gaugeSettingOn: false,
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

/** 1아웃 · 2루 주자 · 풀카운트에서 헛스윙 삼진 공이 뒤로 빠진다 — 1루가 비어 낫아웃(0x3e09e, state[0x1a])이다 */
function 붙든낫아웃판() {
  const progress = startPitcherGame(기본옵션, createSeededRandom(1))
  const 주자 = {
    ...progress,
    atBat: { ...progress.atBat, balls: 3, strikes: 2 },
    game: { ...progress.game, outs: 1, bases: { first: false, second: true, third: false } },
  }
  const random = 폭투난수(23, 1)
  const 붙듦 = startPitch(주자, { typeNumber: 1, gaugeCell: 0 }, random, true)
  return { 주자, 붙듦, random }
}

describe('낫아웃(state[0x1a]) 정산 — 삼진 사건 5 가 [sp+0x30] 에 하나 더 든다 (0x3e09e · 0xa8024)', () => {
  it('판이 낫아웃으로 열린다', () => {
    const { 붙듦 } = 붙든낫아웃판()
    const pending = 붙듦.pendingRunnerPlay
    expect(pending?.kind).toBe('arrival')
    if (pending?.kind !== 'arrival') return
    expect(pending.opened.kind).toBe(9)
    expect(붙듦.atBat.outcome?.kind).toBe('삼진')
  })

  it('타자주자와 2루 주자를 함께 잡으면 [sp+0x30] 3 — 병살 26 이 아니라 삼중살 27 (a8e58 은 3 을 막지 않는다)', () => {
    const { 주자, 붙듦, random } = 붙든낫아웃판()
    const pending = 붙듦.pendingRunnerPlay
    if (pending?.kind !== 'arrival') throw new Error('낫아웃 판이 안 열렸다')
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
    const added = 끝.recordIds.slice(주자.recordIds.length)
    expect(added).toContain(27)
    expect(added).not.toContain(26)
    // R+0x13c 아웃 콜 칸 — 삼진 +1 · 판의 아웃 콜 2 · 정산 보정 −1(a8cfc) = 판의 아웃 2
    expect(끝.record.outsRecorded).toBe(주자.record.outsRecorded + 2)
    // 시즌 아웃 +0x20 — a8cb0 은 [sp+0x30](3)을 그대로 더하고 보정이 없다(원본 그대로)
    expect(summaryOf(끝).seasonDelta.outs - summaryOf(주자).seasonDelta.outs).toBe(3)
  })

  it('타자주자만 1루에서 잡히면 [sp+0x30] 2 지만 state[0x1a] 가 26 을 막는다 — 낫아웃은 R[1] 콤보도 끊는다', () => {
    const { 주자, 붙듦, random } = 붙든낫아웃판()
    const pending = 붙듦.pendingRunnerPlay
    if (pending?.kind !== 'arrival') throw new Error('낫아웃 판이 안 열렸다')
    const played = runLiveRunnerPlayWithoutKeys(pending)
    const 타자잡음 = {
      ...played,
      advance: { ...played.advance, bases: { first: false, second: true, third: false }, outsAdded: 1, runsScored: 0 },
      runnerFates: [
        { fromBase: 0, scored: false, retired: true },
        { fromBase: 2, scored: false, retired: false },
      ],
    }
    const 끝 = resolveRunnerPlay({ ...붙듦, moundStrikeoutCombo: 1 }, 타자잡음, random)
    expect(끝.recordIds.slice(주자.recordIds.length)).not.toContain(26)
    // 정산 끝 a8fb2~a8ff8 — 삼진이어도 state[0x1a] 면 R[1] = 0
    expect(끝.moundStrikeoutCombo).toBe(0)
    expect(끝.moundStrikeouts).toBe(주자.moundStrikeouts + 1)
  })
})

describe('삼진 없이 경기 끝으로 정산되는 폭투·포일 판(종류 9) — 거르기 없는 정산이 상대 타석 칸 · 타자 수까지 올린다', () => {
  it('9회말 동점 3루에서 공이 빠져 상대 끝내기 — 상대 타순 칸 타석 +0x14 · R+0x138 타자 수 · R[1] · R+0x14c 지우기', () => {
    let checked = 0
    for (let seed = 1; seed <= 300 && checked === 0; seed += 1) {
      for (let n = 0; n < 3 && checked === 0; n += 1) {
        const progress = startPitcherGame({ ...기본옵션, playerSide: 0 }, createSeededRandom(1))
        const 끝내기판 = {
          ...progress,
          moundStrikeoutCombo: 2,
          record: { ...progress.record, strikeoutCombo: 2 },
          game: {
            ...progress.game,
            inning: 9,
            half: '말' as const,
            outs: 2,
            ourScore: 3,
            opponentScore: 3,
            bases: { first: false, second: false, third: true },
            runners: { first: null, second: null, third: 4 },
          },
        }
        const 끝 = startPitch(끝내기판, { typeNumber: 1, gaugeCell: 0 }, 폭투난수(seed, n))
        if (끝.lastArrivalPlay?.kind !== 9 || !끝.game.isFinished || 끝.atBat.outcome !== null) continue
        checked += 1
        const slot = 끝내기판.opponentOrderIndex % 9
        expect(끝.opponentLineup.records[slot]?.plateAppearances ?? 0).toBe(
          (끝내기판.opponentLineup.records[slot]?.plateAppearances ?? 0) + 1,
        )
        expect(끝.pitcherRecord.battersFaced).toBe(끝내기판.pitcherRecord.battersFaced + 1)
        expect(끝.moundStrikeoutCombo).toBe(0)
        expect(끝.record.strikeoutCombo).toBe(0)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
