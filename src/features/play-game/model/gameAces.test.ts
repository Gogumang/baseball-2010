import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { opponentPitcherAbilityOf, startGame, summaryOf } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import {
  ACE_BATTER_ROSTER_SLOT,
  ACE_PITCHER_SLOT,
  withAceBatterLineup,
} from '@/features/play-game/model/gameAces'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import { rosterLineupOf } from '@/entities/game/model/quickLineup'
import {
  MY_PITCHER_SLOT,
  OUR_ACE_PITCHER_SLOT,
  opponentPitcherOrderOf,
  ourPitcherOrderOf,
  startPitcherGame,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'

const 마선수: GameAceSetup = { ours: { batter: 1, pitcher: 2 }, opponent: { batter: 3, pitcher: 4 } }

describe('마타자 넣기 0xb8870 → 0xb53f0 (명단 9번, 옛 9번은 맨 끝)', () => {
  it('벤치가 [마타자, 옛10, 옛11, 옛9] 가 되고 벤치 타자 수가 하나 는다', () => {
    const lineup = withAceBatterLineup(rosterLineupOf(12), 0)
    expect(lineup.rosterSlots.slice(9)).toEqual([ACE_BATTER_ROSTER_SLOT, 10, 11, 9])
    expect(lineup.benchBatters).toBe(4)
  })

  it('번호가 −1 이면 아무도 안 들어간다', () => {
    expect(withAceBatterLineup(rosterLineupOf(12), -1)).toEqual(rosterLineupOf(12))
  })
})

describe('타자편 경기에 142 마선수를 싣는다 (0x1c46c 1c62e~1c660)', () => {
  const 시작 = (aces?: GameAceSetup): GameProgress =>
    startGame(createSeededRandom(5), 0, 4, 1, PLAYER_SIDE_LAST_BAT, 3, false, undefined, aces)

  it('두 팀 투수 목록 끝(8번)에 마투수, 명단 9번에 마타자 — 마투수 칸은 레코드 +0x2c 10000 으로 선다', () => {
    const progress = 시작(마선수)
    expect(progress.ourPitcherOrder.at(-1)).toBe(ACE_PITCHER_SLOT)
    expect(progress.opponentPitcherOrder.at(-1)).toBe(ACE_PITCHER_SLOT)
    expect(progress.ourPitcherOrder).toHaveLength(9)
    expect(progress.ourPitcherStaminas[ACE_PITCHER_SLOT]).toBe(FULL_STAMINA)
    expect(progress.ourLineup.rosterSlots[9]).toBe(ACE_BATTER_ROSTER_SLOT)
    expect(progress.opponentLineup.rosterSlots[9]).toBe(ACE_BATTER_ROSTER_SLOT)
    expect(progress.opponentLineup.benchBatters).toBe(4)
  })

  it('안 넘기면 예전 그대로다', () => {
    const progress = 시작()
    expect(progress.ourPitcherOrder).toHaveLength(8)
    expect(progress.ourLineup.rosterSlots).toHaveLength(12)
  })

  it('상대 마투수가 마운드에 서면 그 레코드가 던진다 — 레벨 배율 먹은 능력치', () => {
    const progress = 시작(마선수)
    const onMound: GameProgress = {
      ...progress,
      opponentMound: { ...progress.opponentMound, pitcherSlot: ACE_PITCHER_SLOT },
    }
    const ability = opponentPitcherAbilityOf(onMound)
    const ace = ACE_PITCHERS[4]
    // 새 저장 Lv1 = 60%
    expect(ability.gameAbility?.beforeFatigue.control).toBe(Math.trunc((ace.ability.hit * 60) / 100))
  })

  it('경기 끝 레코드 스태미나 표는 로스터 여덟 칸만 잇는다 — 마투수 칸은 다음 142 가 덮는다', () => {
    const summary = summaryOf(시작(마선수))
    expect(summary.pitcherStaminas?.ours).toHaveLength(8)
    expect(summary.pitcherStaminas?.opponent).toHaveLength(8)
    expect(summary.leaguePlateAppearances?.some((appearance) => appearance.battingOrderIndex === ACE_BATTER_ROSTER_SLOT)).toBe(false)
  })
})

describe('투수편 경기에 142 마선수를 싣는다', () => {
  const 옵션: PitcherGameOptions = {
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

  it('우리 마투수는 목록 8번 자리에 앉고 옛 8번(웹의 내 자리)은 맨 끝으로 (0xb521c b527e)', () => {
    const 구원 = { ...옵션, role: PITCHER_ROLE.unknown, aces: 마선수 }
    const order = ourPitcherOrderOf(구원)
    expect(order).toHaveLength(10)
    expect(order[8]).toBe(OUR_ACE_PITCHER_SLOT)
    expect(order[9]).toBe(MY_PITCHER_SLOT)
    expect(opponentPitcherOrderOf(구원).at(-1)).toBe(ACE_PITCHER_SLOT)
  })

  it('두 팀 명단 9번에 마타자가 앉는다', () => {
    const progress = startPitcherGame({ ...옵션, aces: 마선수 }, createSeededRandom(3))
    expect(progress.opponentLineup.rosterSlots[9]).toBe(ACE_BATTER_ROSTER_SLOT)
    expect(progress.ourLineup.rosterSlots[9]).toBe(ACE_BATTER_ROSTER_SLOT)
  })

  it('안 넘기면 예전 그대로다', () => {
    expect(ourPitcherOrderOf(옵션)).toHaveLength(9)
    expect(opponentPitcherOrderOf(옵션)).toHaveLength(8)
  })

  it('마선수 표는 다섯씩이다', () => {
    expect(ACE_PITCHERS).toHaveLength(5)
    expect(ACE_BATTERS).toHaveLength(5)
  })
})
