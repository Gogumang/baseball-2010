import { describe, expect, it } from 'vitest'
import {
  EMPTY_PITCHER_GAME_RECORD,
  PITCHER_RECORD_CODE,
  passesOwnPitcherFilter,
  recordAllowedBaserunner,
  recordBatterFaced,
  recordEntryLead,
  recordHitByPitch,
  recordPitchGrade,
  saveSituationOf,
} from '@/entities/pitcher-career/model/pitcherGameRecord'

describe('본인 투수 필터 (0xa584e — S5 가 P1 5-1 을 정정했다)', () => {
  it('코드 0x14~0x1f 만 필터를 거친다', () => {
    expect(passesOwnPitcherFilter(0x14)).toBe(true)
    expect(passesOwnPitcherFilter(PITCHER_RECORD_CODE.leadingAtEntry)).toBe(true)
  })

  it('0x20·0x21 은 상대 투수가 던져도 기록된다', () => {
    expect(passesOwnPitcherFilter(PITCHER_RECORD_CODE.perfectInning)).toBe(false)
    expect(passesOwnPitcherFilter(PITCHER_RECORD_CODE.topGradePitches)).toBe(false)
  })
})

describe('R+0x130 출루 허용 (0xa8c86)', () => {
  it('주자가 없으면 서지 않는다', () => {
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, []).allowedBaserunner).toBe(false)
  })

  it('마지막 주자가 살아 있으면 선다', () => {
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, [false]).allowedBaserunner).toBe(true)
  })

  it('⚠️ 원본 버그 그대로 — 앞 주자가 살아 있어도 마지막 주자가 아웃이면 서지 않는다', () => {
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, [false, true]).allowedBaserunner).toBe(false)
  })

  it('⚠️ 거꾸로 앞 주자가 죽고 타자주자가 살면 선다 (야수선택 퍼펙트 버그의 반대쪽)', () => {
    expect(recordAllowedBaserunner(EMPTY_PITCHER_GAME_RECORD, [true, false]).allowedBaserunner).toBe(true)
  })
})

describe('R+0x138 상대한 타자 수 (0xa8db0)', () => {
  it('보통 플레이는 센다', () => {
    expect(recordBatterFaced(EMPTY_PITCHER_GAME_RECORD, 0).battersFaced).toBe(1)
  })

  it('견제(4)·주자만(5) 플레이는 세지 않는다', () => {
    expect(recordBatterFaced(EMPTY_PITCHER_GAME_RECORD, 4).battersFaced).toBe(0)
    expect(recordBatterFaced(EMPTY_PITCHER_GAME_RECORD, 5).battersFaced).toBe(0)
  })
})

describe('R+0x148 사구 (0xa8e2a)', () => {
  it('세면서 삼자범퇴 표시도 끈다', () => {
    const { record, clearsPerfectInningFlag } = recordHitByPitch(EMPTY_PITCHER_GAME_RECORD)
    expect(record.hitByPitch).toBe(1)
    expect(clearsPerfectInningFlag).toBe(true)
  })
})

describe('R+0x158 t=5 투구 수 (0xa5e00)', () => {
  it('등급 5 만 센다', () => {
    let record = EMPTY_PITCHER_GAME_RECORD
    for (const grade of [0, 1, 2, 3, 4, 5, 5]) record = recordPitchGrade(record, grade)
    expect(record.topGradePitches).toBe(2)
  })
})

describe('세이브 상황 0xa60c0', () => {
  const base = { lastInningIndex: 8, currentInningIndex: 8, outs: 0, runnerCount: 0 }

  it('남은 아웃 수는 (마지막−지금)·3 − 아웃 + 3 이다', () => {
    expect(saveSituationOf({ ...base, currentInningIndex: 7, outs: 1, defenseScore: 0, offenseScore: 0 }).outsRemaining).toBe(5)
  })

  it('지고 있으면 후보가 아니다', () => {
    const situation = saveSituationOf({ ...base, defenseScore: 1, offenseScore: 3 })
    expect(situation).toMatchObject({ isCandidate: false, leading: false, requirement: 0 })
  })

  it('3점 이하 리드 + 1이닝 넘게 남으면 요건 3', () => {
    const situation = saveSituationOf({ ...base, currentInningIndex: 7, defenseScore: 3, offenseScore: 0 })
    expect(situation.outsRemaining).toBe(6)
    expect(situation).toMatchObject({ requirement: 3, isCandidate: true, leading: true })
  })

  it('4점 이상 앞서도 3이닝 넘게 남으면 요건 9', () => {
    const situation = saveSituationOf({ ...base, currentInningIndex: 5, defenseScore: 9, offenseScore: 0 })
    expect(situation.outsRemaining).toBe(12)
    expect(situation.requirement).toBe(9)
  })

  it('4점 이상 앞서고 남은 아웃이 적으면 후보가 되지 않는다', () => {
    const situation = saveSituationOf({ ...base, defenseScore: 9, offenseScore: 0 })
    expect(situation).toMatchObject({ requirement: 0, isCandidate: false, leading: true })
  })

  it('동점주자가 대기 타석까지 와 있으면 요건 1 로 덮어쓴다', () => {
    const situation = saveSituationOf({
      ...base,
      currentInningIndex: 7,
      defenseScore: 3,
      offenseScore: 1,
      runnerCount: 1,
    })
    expect(situation.requirement).toBe(1)
    expect(situation.isCandidate).toBe(true)
  })

  it('R+0x150 은 그 순간 앞서고 있었는지만 담는다', () => {
    const leading = saveSituationOf({ ...base, defenseScore: 2, offenseScore: 1 })
    expect(recordEntryLead(EMPTY_PITCHER_GAME_RECORD, leading).leadingAtEntry).toBe(true)
    const trailing = saveSituationOf({ ...base, defenseScore: 1, offenseScore: 2 })
    expect(recordEntryLead(EMPTY_PITCHER_GAME_RECORD, trailing).leadingAtEntry).toBe(false)
  })
})
