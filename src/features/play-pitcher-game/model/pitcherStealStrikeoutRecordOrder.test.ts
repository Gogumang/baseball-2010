import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { resolveRunnerPlay, startPitch, startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

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

/** 17 풀카운트 삼진 (삼진 콜 0xa7c4c) · 24 도루 저지 (정산 0xa8024 a83de) */
const FULL_COUNT_STRIKEOUT_RECORD = 17
const CAUGHT_STEALING_RECORD = 24
/** 26 병살 — 삼진 사건 5 + 도루 저지 아웃 사건 0xd 로 이 정산의 [sp+0x30] == 2 (a8e58, state[0x1a] 는 0) */
const DOUBLE_PLAY_RECORD = 26
/** 36 필살송구 아웃 — 정산 머리 a80f8([sp+0x30] > 0 && state[0x8b])이라 도루 루프의 24(a83de)보다 먼저 */
const LASER_THROW_RECORD = 36

/** 풀카운트 · 2루 주자에서 내 공 하나 — 화면이 도는 갈래라 도루 판(종류 5)을 붙든다 */
function 붙든도루판(seed: number) {
  const progress = startPitcherGame(기본옵션, createSeededRandom(1))
  const 주자 = {
    ...progress,
    atBat: { ...progress.atBat, balls: 3, strikes: 2 },
    game: { ...progress.game, bases: { first: false, second: true, third: false } },
  }
  const random = createSeededRandom(seed)
  const 붙듦 = startPitch(주자, { typeNumber: 1, gaugeCell: 0 }, random, true)
  return { 주자, 붙듦, random }
}

describe('삼진 + 도루 판(종류 5)의 기록 알림 차례 — 삼진 콜 16/17 → 정산 머리 36 → 도루 루프 24 → 26', () => {
  it('풀카운트 삼진에 3루 도루 주자가 잡히면 17 → 24 → 26 차례로 쌓인다', () => {
    let checked = 0
    for (let seed = 1; seed <= 3000 && checked === 0; seed += 1) {
      const { 주자, 붙듦, random } = 붙든도루판(seed)
      const pending = 붙듦.pendingRunnerPlay
      if (pending == null || pending.kind !== 'arrival' || pending.opened.kind !== 5) continue
      if (붙듦.atBat.outcome?.kind !== '삼진') continue
      checked += 1
      // 화면이 돌린 판 — 3루에서 도루 주자를 잡은 결과로 갈아 끼운다(판 진행기는 키 송구로도 이 씨앗에선 못 잡는다)
      const played = runLiveRunnerPlayWithoutKeys(pending)
      const caught = {
        ...played,
        advance: { ...played.advance, bases: { first: false, second: false, third: false }, outsAdded: 1 },
        runnerFates: played.runnerFates.map((fate) =>
          fate.fromBase === 2 ? { ...fate, retired: true, scored: false } : fate,
        ),
      }
      const 끝 = resolveRunnerPlay(붙듦, caught, random)
      const added = 끝.recordIds.slice(주자.recordIds.length)
      expect(added).toEqual([FULL_COUNT_STRIKEOUT_RECORD, CAUGHT_STEALING_RECORD, DOUBLE_PLAY_RECORD])
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('필살송구로 잡았으면 17 → 36 → 24 → 26 — 36 은 같은 정산의 머리(a80f8)라 24 앞이다', () => {
    let checked = 0
    for (let seed = 1; seed <= 3000 && checked === 0; seed += 1) {
      const { 주자, 붙듦, random } = 붙든도루판(seed)
      const pending = 붙듦.pendingRunnerPlay
      if (pending == null || pending.kind !== 'arrival' || pending.opened.kind !== 5) continue
      if (붙듦.atBat.outcome?.kind !== '삼진') continue
      checked += 1
      const played = runLiveRunnerPlayWithoutKeys(pending)
      const caught = {
        ...played,
        laserOutFlag: true,
        advance: { ...played.advance, bases: { first: false, second: false, third: false }, outsAdded: 1 },
        runnerFates: played.runnerFates.map((fate) =>
          fate.fromBase === 2 ? { ...fate, retired: true, scored: false } : fate,
        ),
      }
      const 끝 = resolveRunnerPlay(붙듦, caught, random)
      const added = 끝.recordIds.slice(주자.recordIds.length)
      expect(added).toEqual([
        FULL_COUNT_STRIKEOUT_RECORD,
        LASER_THROW_RECORD,
        CAUGHT_STEALING_RECORD,
        DOUBLE_PLAY_RECORD,
      ])
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('잡힌 주자가 없으면 17 만 한 번 준다', () => {
    let checked = 0
    for (let seed = 1; seed <= 3000 && checked === 0; seed += 1) {
      const progress = startPitcherGame(기본옵션, createSeededRandom(1))
      const 주자 = {
        ...progress,
        atBat: { ...progress.atBat, balls: 3, strikes: 2 },
        game: { ...progress.game, bases: { first: true, second: false, third: false } },
      }
      const 끝 = startPitch(주자, { typeNumber: 1, gaugeCell: 0 }, createSeededRandom(seed))
      if (끝.lastArrivalPlay?.kind !== 5 || 끝.lastArrivalPlay.result.caughtFrom.length > 0) continue
      if (끝.opponentOrderIndex === 주자.opponentOrderIndex) continue
      checked += 1
      expect(끝.recordIds.slice(주자.recordIds.length)).toEqual([FULL_COUNT_STRIKEOUT_RECORD])
    }
    expect(checked).toBeGreaterThan(0)
  })
})
