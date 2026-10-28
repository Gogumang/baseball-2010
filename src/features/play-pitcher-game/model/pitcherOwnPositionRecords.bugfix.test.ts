import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { OWN_POSITION_RECORDS_BUGFIX_ID, isDefenseSideRecord } from '@/entities/game/model/ownPositionRecords'
import {
  closeManagerHookWindow,
  confirmScene,
  isPitchTurn,
  startPitcherGame,
  summaryOf,
  throwPitch,
  type PitcherGameOptions,
  type PitcherGameProgress,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

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

/** 시드 하나로 경기를 세워 끝까지 한가운데 직구만 던진다 (`pitcherGameFlow.test` 의 도우미와 같은 꼴) */
function 끝까지던지기(seed: number): PitcherGameProgress {
  const random = createSeededRandom(seed)
  let current = startPitcherGame(기본옵션, createSeededRandom(seed))
  for (let pitch = 0; pitch < 3_000 && !current.game.isFinished; pitch += 1) {
    if (current.managerHookText !== null) current = closeManagerHookWindow(current, random)
    else if (!isPitchTurn(current)) break
    else if (current.sceneConfirmPending === true) current = confirmScene(current, random)
    else current = throwPitch(current, 한가운데직구, random)
  }
  return current
}

const isOffenseSideRecord = (id: number) => !isDefenseSideRecord(id)

/**
 * 대표 시드 — 시드 1~30 을 원본 길로 던져 본 기록 갈래를 모두 담는 넷 (r360 에 30 → 4 로 줄임).
 * 공격 쪽 0 · 1 · 2 · 3 · 9 · 10 · 12, 수비 쪽 16 · 18 · 21 · 28 · 29 — 30개 시드에서 난 기록 번호가 이 넷에 다 있다.
 */
const 대표시드 = [3, 12, 13, 22] as const

describe('B-129 고친 길 — 나만의 투수는 자기 포지션(투수 · 수비 쪽) 기록만 받는다', () => {
  it('동료 타석 · 점수차 승의 공격 쪽 기록(0~15 · 32~35 · 37~39)이 0 이고, 수비 쪽 기록 · 경기 결과는 원본 길과 같다', () => {
    let 원본공격 = 0
    let 원본수비 = 0
    for (const seed of 대표시드) {
      const 원본 = summaryOf(끝까지던지기(seed))
      setBugfixConfigForTests(bugfixConfigWith([OWN_POSITION_RECORDS_BUGFIX_ID]))
      const 고침 = summaryOf(끝까지던지기(seed))
      setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)

      원본공격 += 원본.recordIds.filter(isOffenseSideRecord).length
      원본수비 += 원본.recordIds.filter(isDefenseSideRecord).length
      expect(고침.recordIds.filter(isOffenseSideRecord), String(seed)).toEqual([])
      expect(고침.recordIds, String(seed)).toEqual(원본.recordIds.filter(isDefenseSideRecord))
      expect([고침.ourScore, 고침.opponentScore, 고침.pitchCount], String(seed)).toEqual([원본.ourScore, 원본.opponentScore, 원본.pitchCount])
    }
    // 원본 길에서는 같은 시드들이 양쪽 기록을 실제로 냈다 — 거를 것과 남길 것이 다 있었다
    expect(원본공격).toBeGreaterThan(0)
    expect(원본수비).toBeGreaterThan(0)
  })
})
