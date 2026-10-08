import { describe, expect, it } from 'vitest'
import { startDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import {
  isPitchTurn,
  pinchHit,
  specialSwingRemainingAt,
  spendOurSpecialSwing,
  startTeamGame,
  startThrowPitch,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

const 기본옵션: TeamGameOptions = {
  mode: 1,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
}

const 시작 = (options: Partial<TeamGameOptions> = {}, seed = 20100901) =>
  startTeamGame({ ...기본옵션, opponentAces: { pitcher: -1, batter: -1 }, ...options }, createSeededRandom(seed))

/** 상대 지금 타순 칸에 마타자를 세운다 */
function 상대마타자(progress: TeamGameProgress, aceIndex = 0): TeamGameProgress {
  const ace = ACE_BATTERS[aceIndex]!
  return {
    ...progress,
    opponentEntry: progress.opponentEntry.map((entry, slot) =>
      slot === progress.opponentOrderIndex
        ? { ...entry, aceIndex, ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run] }
        : entry,
    ),
  }
}

const 한가운데직구 = { typeNumber: 1, courseCell: 4, gaugeCell: 0 }

describe('필살 남은 횟수 — 타순 칸 s8 팀[+0x29 + 타순], 0xaebe4 가 채운다', () => {
  it('일반 로스터 타자는 +0x18 == 0 이라 0 이다 — "0" 키가 무시된다 (0x51e14)', () => {
    const progress = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT })
    expect(specialSwingRemainingAt(progress, '우리')).toBe(0)
    expect(specialSwingRemainingAt(progress, '상대')).toBe(0)
  })

  it('마타자는 0xd84fa[레벨] = 2,2,3,4,5 — 레벨은 전역 mgr[0x13f + 순번] (aceLevels 칸 5 + 순번)', () => {
    const progress = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 1 })
    const 대타 = pinchHit(progress, 9, createSeededRandom(0))
    expect(specialSwingRemainingAt(대타, '우리')).toBe(2)
    const 레벨4 = pinchHit({ ...progress, options: { ...progress.options, aceLevels: { 6: 4 } } }, 9, createSeededRandom(0))
    expect(specialSwingRemainingAt(레벨4, '우리')).toBe(5)
    const 레벨2 = pinchHit({ ...progress, options: { ...progress.options, aceLevels: { 6: 2 } } }, 9, createSeededRandom(0))
    expect(specialSwingRemainingAt(레벨2, '우리')).toBe(3)
  })

  it('필살 스윙(0x4e136)이 줄인 값을 그 타순 칸에 든다 — 이닝이 바뀌어도 다시 차지 않는다', () => {
    const progress = pinchHit(시작({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 0 }), 9, createSeededRandom(0))
    const 씀 = spendOurSpecialSwing(progress, 1)
    expect(specialSwingRemainingAt(씀, '우리')).toBe(1)
    expect(씀.ourSpecialSwingRemaining[progress.game.battingOrderIndex]).toBe(1)
  })

  it('대타(0xaede0)는 그 칸을 −1 로 되돌려 새 선수가 자기 횟수를 받는다', () => {
    const progress = 시작({ playerSide: PLAYER_SIDE_FIRST_BAT, aceBatterId: 0 })
    const 앞칸 = { ...progress, ourSpecialSwingRemaining: progress.ourSpecialSwingRemaining.map(() => 0) }
    const 대타 = pinchHit(앞칸, 9, createSeededRandom(0))
    expect(대타.ourSpecialSwingRemaining[progress.game.battingOrderIndex]).toBe(-1)
    expect(specialSwingRemainingAt(대타, '우리')).toBe(2)
  })
})

describe('사람이 던지는 타석의 CPU 마타자 필살 — 0x34488 → 0x4e136 → 0x34d6c → 0x517e6', () => {
  it('마타자가 휘두르면 그 타순 칸이 하나 준다 (헛스윙도) · 지켜보면 그대로다', () => {
    let 휘두름 = 0
    let 지켜봄 = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      const progress = 상대마타자(시작({}, seed))
      if (!isPitchTurn(progress)) continue
      const before = specialSwingRemainingAt(progress, '상대')
      expect(before).toBe(2)
      const after = startThrowPitch(progress, 한가운데직구, createSeededRandom(seed + 1000))
      const resolution = after.lastResolution
      const swung =
        resolution !== null &&
        (resolution.kind === '파울' || resolution.kind === '타구' || (resolution.kind === '스트라이크' && resolution.isSwinging))
      const stored = after.opponentSpecialSwingRemaining[progress.opponentOrderIndex]
      if (swung) {
        휘두름 += 1
        expect(stored, `씨앗 ${seed}`).toBe(1)
      } else {
        지켜봄 += 1
        expect(stored === -1 || stored === 2, `씨앗 ${seed}`).toBe(true)
      }
    }
    expect(휘두름).toBeGreaterThan(0)
    expect(지켜봄).toBeGreaterThan(0)
  })

  it('필살로 맞힌 인플레이 타구 일부(30%)는 판 시작(0x517e6 — 메시지 0x11 뒤)에서 필살타법 표시가 선다 · 남은 0 이면 하나도 없다', () => {
    // 굴림은 타석 판정이 아니라 수비 판 시작이 한다 — 수비 입력에는 쏜 공(필살 스윙 재료)만 실린다
    const 판의필살 = (progress: TeamGameProgress): boolean => {
      const input = progress.pendingDefensePlay?.input
      return input !== undefined && input.isUncatchable !== true && startDefensePlay(input).input.isUncatchable === true
    }
    let 송구공 = 0
    let 남은0송구공 = 0
    for (let seed = 1; seed <= 200; seed += 1) {
      const progress = 상대마타자(시작({}, seed))
      const after = startThrowPitch(progress, 한가운데직구, createSeededRandom(seed + 5000))
      if (판의필살(after)) 송구공 += 1

      const 다씀 = {
        ...progress,
        opponentSpecialSwingRemaining: progress.opponentSpecialSwingRemaining.map(() => 0),
      }
      const 뒤 = startThrowPitch(다씀, 한가운데직구, createSeededRandom(seed + 5000))
      if (판의필살(뒤)) 남은0송구공 += 1
      expect(뒤.opponentSpecialSwingRemaining[progress.opponentOrderIndex]).toBe(0)
    }
    expect(송구공).toBeGreaterThan(0)
    expect(남은0송구공).toBe(0)
  })

  it('일반 타자의 타석은 필살 칸을 건드리지 않는다', () => {
    const progress = 시작({}, 3)
    const after = startThrowPitch(progress, 한가운데직구, createSeededRandom(4))
    // 일반 타자는 traits.specialSwing 을 안 받아(0x34468 은 마타자만) 칸이 −1(안 채움) 그대로다
    expect(after.opponentSpecialSwingRemaining).toEqual(progress.opponentSpecialSwingRemaining)
    expect(specialSwingRemainingAt(after, '상대')).toBe(0)
  })
})

describe('사람 투구의 공+0x10 (0x3de10) — CPU 타석 판정의 0x34d6c 투수 쪽', () => {
  it('마구가 아닌 공은 0 이고 투수 +0x18 을 함께 싣는다', () => {
    const progress = 시작()
    const after = startThrowPitch(progress, 한가운데직구, createSeededRandom(1))
    expect(after.lastPitch?.magicNumber).toBe(0)
    expect(after.ballMagicNumber).toBe(0)
  })

  it('마구(22)를 던지면 남은 > 0 일 때 공에 번호가 실리고, 되돌리지 않아 다음 직구에도 남는다', () => {
    const base = 시작()
    const 마구투수: TeamGameProgress = {
      ...base,
      magicRemaining: 3,
      ourPitcherEntry: base.ourPitcherEntry.map((pitcher, slot) =>
        slot === base.ourPitcherIndex ? { ...pitcher, repertoire: { ...pitcher.repertoire, magicId: 2 } } : pitcher,
      ),
    }
    const random = createSeededRandom(9)
    const 마구 = startThrowPitch(마구투수, { typeNumber: 22, courseCell: 4, gaugeCell: 0 }, random)
    expect(마구.magicRemaining).toBe(2)
    expect(마구.lastPitch?.magicNumber).toBe(2)
    expect(마구.lastPitch?.pitcherMagicNumber).toBe(2)
    if (!isPitchTurn(마구)) return
    const 직구 = startThrowPitch(마구, 한가운데직구, random)
    expect(직구.lastPitch?.magicNumber).toBe(2)
  })

  it('마지막 한 개(남은 1 → 0)는 코스 확정 0x50e9c 가 먼저 줄여 0x3de10 이 안 싣는다', () => {
    const base = 시작()
    const 마구투수: TeamGameProgress = {
      ...base,
      magicRemaining: 1,
      ourPitcherEntry: base.ourPitcherEntry.map((pitcher, slot) =>
        slot === base.ourPitcherIndex ? { ...pitcher, repertoire: { ...pitcher.repertoire, magicId: 3 } } : pitcher,
      ),
    }
    const 마구 = startThrowPitch(마구투수, { typeNumber: 22, courseCell: 4, gaugeCell: 0 }, createSeededRandom(9))
    expect(마구.magicRemaining).toBe(0)
    expect(마구.lastPitch?.magicNumber).toBe(0)
  })
})
