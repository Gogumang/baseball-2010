import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { batterNameAt, startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { RELAY_RESULT_WORDS } from '@/entities/mission/model/missionAutoRelay'
import { pitcherAutoRelayStepsOf } from '@/pages/pitching/lib/pitcherAutoRelay'

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

describe('나리 투수편 자동진행 중계 칸 (상태 0x21 — 0xc262c 한 번마다 한 칸, 그리기 0x4258c 의 모드 3 몫)', () => {
  it('선공이면 1회초 우리 공격이 경기 시작 자동진행이다 — 타석 틱마다 친 타자 이름 + 결과 낱말, 3아웃 타석은 앞 반 이닝 그대로', () => {
    const progress = startPitcherGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, createSeededRandom(1))
    const relay = progress.autoRelay
    expect(relay?.serial).toBe(1)
    const ticks = relay?.ticks ?? []
    const steps = pitcherAutoRelayStepsOf(ticks, '나')
    expect(steps.length).toBe(ticks.length)
    const atBats = ticks.filter((tick) => tick.atBat !== null)
    expect(atBats.length).toBeGreaterThanOrEqual(3)
    // 1회초 — 우리(측 0) 공격, 모든 칸이 같은 반 이닝으로 그려진다(마지막 3아웃 타석까지)
    expect(steps.every((step) => step.inning === 0 && step.offenseSide === 0)).toBe(true)
    expect(steps[steps.length - 1].cards?.outs).toBe(3)
    // 타석 칸의 글은 그 타순 칸 타자의 이름으로 시작한다(코드 0 뜬공 아웃은 글이 없을 수 있다)
    ticks.forEach((tick, index) => {
      const line = steps[index].line
      if (tick.atBat === null) {
        expect(line).toBeNull()
        return
      }
      if (line === null) return
      const name = batterNameAt(tick.progress, true, tick.atBat.orderIndex)
      expect(line.startsWith(`${name} `)).toBe(true)
      expect(RELAY_RESULT_WORDS.some((word) => line.endsWith(word))).toBe(true)
    })
  })

  it('후공 · 선발이면 경기 시작에 자동진행이 없다 — 1회초는 내가 던진다', () => {
    const progress = startPitcherGame({ ...기본옵션, playerSide: PLAYER_SIDE_LAST_BAT }, createSeededRandom(1))
    expect(progress.autoRelay ?? null).toBeNull()
  })
})
