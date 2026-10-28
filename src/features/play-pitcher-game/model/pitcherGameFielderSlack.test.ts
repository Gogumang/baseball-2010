import { describe, expect, it } from 'vitest'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { DEFENSE_SCENE_START } from '@/features/defense-play/model/defenseScene'
import { pickoff, startPitcherGame, type PitcherGameOptions, type PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
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

describe('투수편 — 판 사이 야수 +0xcc 를 넘겨받는다 (`DefenseScene.fielderSlack`, r196)', () => {
  it('파울 판이 남긴 5 를 사람 견제(vt20(0) — b28ca)가 들고 연다 · 판이 끝난 값을 다시 받는다', () => {
    const 시작 = startPitcherGame(기본옵션, createSeededRandom(3))
    const 판: PitcherGameProgress = { ...시작, game: { ...시작.game, bases: { first: true, second: false, third: false } } }
    const 그냥 = pickoff(판, '3', createSeededRandom(1))
    const 남은 = pickoff(
      { ...판, defenseScene: { ...DEFENSE_SCENE_START, fielderSlack: Array.from({ length: 9 }, () => 5) } },
      '3',
      createSeededRandom(1),
    )
    expect(남은.lastDefensePlay?.ticks[0]?.fielders).not.toEqual(그냥.lastDefensePlay?.ticks[0]?.fielders)
    expect(남은.defenseScene?.fielderSlack).toEqual(Array.from({ length: 9 }, () => 0))
  })
})
