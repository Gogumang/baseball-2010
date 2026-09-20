import { describe, expect, it } from 'vitest'
import { applyEventRewards, rewardsIn } from '@/entities/story/model/eventReward'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { EventCommand } from '@/shared/config/original/eventTypes'

const 선수 = () => ({ ...createCareer('테스트'), popularity: 10, reputation: 10, morale: 50, money: 100 })

describe('applyEventRewards — 원작 이벤트 보상', () => {
  it('종류 0·1·2 는 인기도·평판·사기다 (감독 평가 순서)', () => {
    const after = applyEventRewards(선수(), [
      { kind: 0, value: 10 },
      { kind: 1, value: 20 },
      { kind: 2, value: -5 },
    ])

    expect(after).toMatchObject({ popularity: 20, reputation: 30, morale: 45 })
  })

  it('종류 3 은 100만원 단위 소지금이다 — 한국시리즈 우승 "+10" = StrMODE[190] "소지금 +1000만"', () => {
    expect(applyEventRewards(선수(), [{ kind: 3, value: 10 }]).money).toBe(100 + 1000)
  })

  it('종류 10 은 G포인트다 (상한 99999, StrHOWTO[29])', () => {
    const after = applyEventRewards({ ...선수(), gamePoint: 99_900 }, [{ kind: 10, value: 500 }])

    expect(after.gamePoint).toBe(99_999)
    expect(after.money).toBe(100)
  })

  it('종류 11 은 질병이다 — 이벤트 490 "몸이 으슬으슬한 게…" 뒤 알림이 질병', () => {
    const after = applyEventRewards(선수(), [{ kind: 11, value: 0 }])

    expect(after.isSick).toBe(true)
    expect(after.isInjured).toBe(false)
    expect(after.illnessName).toBe('감기')
  })

  it('종류 11 의 음수 값은 치료다', () => {
    const 환자 = { ...선수(), isSick: true, illnessName: '배탈' }

    expect(applyEventRewards(환자, [{ kind: 11, value: -1 }])).toMatchObject({ isSick: false, illnessName: null })
  })

  it('사기는 0~100, 평판은 999, 인기도는 9999 에서 멈춘다 (보상 점프 표 0xd4e50)', () => {
    const after = applyEventRewards(선수(), [
      { kind: 2, value: 999 },
      { kind: 1, value: 5000 },
      { kind: 0, value: 50000 },
    ])

    expect(after).toMatchObject({ morale: 100, reputation: 999, popularity: 9999 })
  })

  it('종류 19 는 타순, 18 은 목표 경로(0 → 4번, 1 → 1번)', () => {
    const after = applyEventRewards(선수(), [{ kind: 19, value: 8 }, { kind: 18, value: 1 }])

    expect(after).toMatchObject({ battingOrder: 8, battingOrderPath: '1번' })
  })

  it('종류 4 는 스킬 — 양수 n 이면 스킬 n−1 획득, 음수면 해제 (0x8c5bc)', () => {
    const 스킬없는선수 = { ...선수(), skillIds: [] }
    const gained = applyEventRewards(스킬없는선수, [{ kind: 4, value: 3 }])
    expect(gained.skillIds).toEqual([2])

    expect(applyEventRewards(gained, [{ kind: 4, value: -3 }]).skillIds).toEqual([])
    expect(applyEventRewards(gained, [{ kind: 4, value: 3 }]).skillIds).toEqual([2])
  })

  it('종류 13~16 은 능력치 히트·파워·수비·주루에 더하고 타입 한계치로 자른다 (0x8c758, 점검 10차)', () => {
    const before = { ...선수(), ability: { hit: 100, power: 100, defense: 100, run: 795 } }

    const after = applyEventRewards(before, [
      { kind: 13, value: 10 },
      { kind: 14, value: 5 },
      { kind: 15, value: 8 },
      { kind: 16, value: 10 },
    ])

    expect(after.ability).toEqual({ hit: 110, power: 105, defense: 108, run: 800 })
  })

  it('종류 7 은 히든 오픈 — |값| 이 오픈 id (0x8c60e, 이벤트 304~307)', () => {
    expect(applyEventRewards(선수(), [{ kind: 7, value: -43 }]).openedHiddenIds).toEqual([43])
  })

  it('뜻을 모르는 종류는 아무것도 바꾸지 않는다', () => {
    const before = 선수()

    expect(applyEventRewards(before, [{ kind: 8, value: 3 }])).toEqual(before)
  })

  it('종류 17 은 모든 능력치를 올린다 (0x8c8e8, 이벤트 231 v=10)', () => {
    const before = 선수()
    const after = applyEventRewards(before, [{ kind: 17, value: 10 }])

    expect(after.ability).toEqual({
      hit: before.ability.hit + 10,
      power: before.ability.power + 10,
      defense: before.ability.defense + 10,
      run: before.ability.run + 10,
    })
  })

  it('연차 보정 — 이벤트 393 은 인기도 +3y · 평판 −2y (0x8d508)', () => {
    const 삼년차 = { ...선수(), season: 3 }  // y = 2
    const 보정없음 = applyEventRewards(삼년차, [{ kind: 0, value: 10 }, { kind: 1, value: 10 }])
    const 보정 = applyEventRewards(삼년차, [{ kind: 0, value: 10 }, { kind: 1, value: 10 }], undefined, 393)

    expect(보정.popularity - 보정없음.popularity).toBe(3 * 2)
    expect(보정.reputation - 보정없음.reputation).toBe(-2 * 2)
  })

  it('1년차(y=0)에는 연차 보정이 붙지 않는다', () => {
    const 일년차 = 선수()
    expect(applyEventRewards(일년차, [{ kind: 0, value: 10 }], undefined, 393).popularity).toBe(20)
  })

  it('입력 커리어를 바꾸지 않는다', () => {
    const before = 선수()
    applyEventRewards(before, [{ kind: 0, value: 10 }])

    expect(before.popularity).toBe(10)
  })
})

describe('rewardsIn', () => {
  it('지나온 명령 중 보상만 모은다', () => {
    const commands: EventCommand[] = [
      { op: 'sound', id: 1 },
      { op: 'reward', items: [{ kind: 0, value: 5 }] },
      { op: 'reward', items: [{ kind: 2, value: 3 }, { kind: 10, value: 500 }] },
    ]

    expect(rewardsIn(commands)).toEqual([
      { kind: 0, value: 5 },
      { kind: 2, value: 3 },
      { kind: 10, value: 500 },
    ])
  })
})
