import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import {
  isPitchTurn,
  resolveDefensePlay,
  startPitch,
  startPitcherGame,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
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

const 한가운데직구 = { typeNumber: 1, gaugeCell: 0 }

/** 첫 페어 타구 판이 붙들린 자리 — 파울 각 공 판은 돈 것으로 치고 넘긴다 */
function 붙들린자리(isPostseason: boolean) {
  const random = createSeededRandom(3)
  let current = startPitcherGame({ ...기본옵션, isPostseason }, random)
  for (let pitch = 0; pitch < 300; pitch += 1) {
    if (!isPitchTurn(current)) break
    const next = startPitch(current, 한가운데직구, random)
    if (next.pendingDefensePlay !== null && next.atBat.outcome === null) {
      current = resolveDefensePlay(next, runDefensePlay(next.pendingDefensePlay), random)
      continue
    }
    if (next.pendingDefensePlay !== null) return { 진행중: next, random }
    current = next
  }
  throw new Error('인플레이 타구가 나오지 않았습니다')
}

/** 판을 상대 타자의 장내 홈런(state[0x25] — 사건 8 없음)으로 갈아 끼워 먹인다 */
function 장내홈런을먹인다(isPostseason: boolean, groundHomeRun = true) {
  const { 진행중, random } = 붙들린자리(isPostseason)
  const bases = 진행중.game.bases
  const runners = [bases.first, bases.second, bases.third].filter(Boolean).length
  const played = runDefensePlay(진행중.pendingDefensePlay!)
  const result: DefensePlayResult = {
    ...played,
    outcome: { kind: '홈런' },
    groundHomeRun,
    advance: { bases: EMPTY_BASES, runsScored: runners + 1, outsAdded: 0 },
  }
  const slot = 진행중.opponentOrderIndex
  const 끝 = resolveDefensePlay(진행중, result, random)
  return {
    lineupHomeRuns: 끝.opponentLineup.records[lineupSlotOf(slot)]?.homeRuns ?? 0,
    logHomeRuns: (끝 as PitcherGameProgress).opponentBatterLogs[slot]?.homeRuns ?? 0,
  }
}

describe('투수편 정산 0xa8024 — 상대 타자의 장내 홈런과 타자 게이트 [sp+0x34] (a84d6)', () => {
  it('정규시즌이면 장내 홈런도 타순 칸 홈런 +0x13 에 든다', () => {
    expect(장내홈런을먹인다(false)).toEqual({ lineupHomeRuns: 1, logHomeRuns: 1 })
  })

  it('포스트시즌(0xa571c 거짓)이면 루타 4 안타로만 적혀 +0x13 을 건너뛴다', () => {
    expect(장내홈런을먹인다(true)).toEqual({ lineupHomeRuns: 0, logHomeRuns: 0 })
  })

  it('담장을 넘긴 홈런(사건 8)은 포스트시즌에도 +0x13 에 든다', () => {
    expect(장내홈런을먹인다(true, false)).toEqual({ lineupHomeRuns: 1, logHomeRuns: 1 })
  })
})
