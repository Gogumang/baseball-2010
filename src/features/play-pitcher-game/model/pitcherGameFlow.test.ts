import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { completeGameRecordIdsOf, recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { advanceRunners } from '@/entities/game/model/baseState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { MAXIMUM_BURSTS_PER_GAME } from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_GOAL } from '@/entities/burst-mission/model/burstMissionJudge'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  closeManagerHookWindow,
  earnedRunAverageOf,
  giveUpPitching,
  isPitchTurn,
  pitchSlotsFor,
  startPitcherGame,
  startsToday,
  summaryOf,
  throwPitch,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type {
  PitcherGameOptions,
  PitcherGameProgress,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'

const 씨앗 = (seed: number) => createSeededRandom(seed)

const 기본옵션: PitcherGameOptions = {
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  role: PITCHER_ROLE.starter,
  positionCode: 0,
  // 짝수 날이라 내 선발이 등판한다 (0xa4f60 표)
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

const 한가운데직구 = { typeNumber: 1, courseCell: 4, gaugeCell: 0 }

/** 사람 차례가 아니면 더 던질 것이 없다 — 경기가 끝날 때까지 한가운데 직구만 던진다 */
function 끝까지던지기(progress: PitcherGameProgress, seed = 1): PitcherGameProgress {
  let current = progress
  const random = 씨앗(seed)
  for (let pitch = 0; pitch < 3_000; pitch += 1) {
    if (current.game.isFinished) return current
    if (current.managerHookText !== null) {
      current = closeManagerHookWindow(current, random)
      continue
    }
    if (!isPitchTurn(current)) return current
    current = throwPitch(current, 한가운데직구, random)
  }
  throw new Error('경기가 끝나지 않았습니다')
}

describe('등판', () => {
  it('선발은 날짜 카운터가 짝수인 날에만 등판한다 (2경기마다)', () => {
    expect(startsToday({ ...기본옵션, dayCounter: 2 })).toBe(true)
    expect(startsToday({ ...기본옵션, dayCounter: 3 })).toBe(false)
    // 시즌 첫 경기(g == 0)는 0x1b684 가 내 투수를 0번에 올려 둔 뒤라 늘 등판이다
    expect(startsToday({ ...기본옵션, dayCounter: 0 })).toBe(true)
  })

  it('보직이 구원이면 선발로는 절대 나오지 않는다', () => {
    expect(startsToday({ ...기본옵션, role: PITCHER_ROLE.relief, dayCounter: 2 })).toBe(false)
  })

  it('선발 등판일이면 경기를 세우자마자 사람 차례다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))

    expect(progress.onMound).toBe(true)
    expect(isPitchTurn(progress)).toBe(true)
    // 투수편 주인공은 타석에 서지 않는다
    expect(progress.game.playerOrderIndex).toBe(-1)
  })

  it('등판일이 아니면 경기가 통째로 간이 진행돼 끝나 있다', () => {
    const progress = startPitcherGame({ ...기본옵션, dayCounter: 3 }, 씨앗(20100901))

    expect(progress.onMound).toBe(false)
    expect(progress.game.isFinished).toBe(true)
    expect(progress.pitchCount).toBe(0)
  })

  it('구원은 8회(0-기준 7) 우리 팀 수비 첫 타석에 올라온다 (0xc1ba4)', () => {
    let progress = startPitcherGame(
      { ...기본옵션, role: PITCHER_ROLE.relief, positionCode: 5, dayCounter: 3 },
      씨앗(20100902),
    )
    // 8회 전에 콜드게임으로 끝나지 않은 씨앗을 찾는다
    for (let seed = 1; !progress.hasEntered && seed <= 40; seed += 1) {
      progress = startPitcherGame(
        { ...기본옵션, role: PITCHER_ROLE.relief, positionCode: 5, dayCounter: 3 },
        씨앗(seed),
      )
    }

    expect(progress.hasEntered).toBe(true)
    expect(progress.game.inning).toBe(8)
    expect(isPitchTurn(progress)).toBe(true)
  })
})

describe('투구', () => {
  it('구질 칸은 여섯이고 마구가 칸 5 에 있다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(3))
    const 칸 = pitchSlotsFor(progress)

    expect(칸).toHaveLength(6)
    expect(칸[5].isMagic).toBe(true)
  })

  it('한 개를 던지면 투구 수가 오르고 스태미나가 깎인다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(3))
    const after = throwPitch(progress, 한가운데직구, 씨앗(5))

    expect(after.pitchCount).toBe(1)
    expect(after.stamina).toBeLessThan(FULL_STAMINA)
    expect(after.lastPitch?.type).toBe('FASTBALL')
  })

  it('마구는 코스 확정 때 횟수가 준다 — 다 쓰면 못 던진다 (0x50e9c · 0x50db8)', () => {
    let progress = startPitcherGame({ ...기본옵션, magicCount: 1 }, 씨앗(3))
    progress = throwPitch(progress, { typeNumber: 22, courseCell: 4, gaugeCell: 0 }, 씨앗(5))
    expect(progress.magicRemaining).toBe(0)

    const 막힘 = throwPitch(progress, { typeNumber: 22, courseCell: 4, gaugeCell: 0 }, 씨앗(6))
    expect(막힘).toBe(progress)
  })

  it('사람 차례가 아니면 던져도 아무 일이 없다', () => {
    const progress = startPitcherGame({ ...기본옵션, dayCounter: 3 }, 씨앗(3))

    expect(throwPitch(progress, 한가운데직구, 씨앗(5))).toBe(progress)
  })

  it('경기를 끝까지 던지면 내 기록이 쌓이고 결과가 난다', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(20100901)), 4)

    expect(끝.game.isFinished).toBe(true)
    const 요약 = summaryOf(끝)
    expect(요약.pitchCount).toBeGreaterThan(0)
    expect(['승', '무', '패']).toContain(요약.result)
    expect(요약.record.outsRecorded).toBeGreaterThan(0)
    expect(요약.seasonDelta.pitches).toBe(요약.pitchCount)
  })
})

describe('강판', () => {
  it('스스로 강판하면 마운드에서 내려가고 남은 경기가 자동으로 흐른다 (0xc1b48)', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))
    const after = giveUpPitching(progress, 씨앗(9))

    expect(after.onMound).toBe(false)
    expect(after.simpleEngineRunning).toBe(true)
    expect(after.game.isFinished).toBe(true)
  })

  it('감독 강판 — 체력 0% 에서 평판이 낮으면 반드시 내려간다 (표 0xcfa58 행 1 칸 0 = 100%)', () => {
    const progress = startPitcherGame(
      { ...기본옵션, stamina: 0, reputation: 0 },
      씨앗(20100901),
    )

    expect(progress.managerHookText).not.toBeNull()
    // 체력 0% 사유의 글은 88~90 이다
    expect(progress.managerHookText).toBeGreaterThanOrEqual(88)
    expect(progress.managerHookText).toBeLessThanOrEqual(90)
    expect(isPitchTurn(progress)).toBe(false)
  })

  it('감독 대사 창을 닫으면 남은 경기가 자동으로 끝난다 (0x50804 → 상태 0x21)', () => {
    const progress = startPitcherGame({ ...기본옵션, stamina: 0, reputation: 0 }, 씨앗(20100901))
    const after = closeManagerHookWindow(progress, 씨앗(9))

    expect(after.managerHookText).toBeNull()
    expect(after.onMound).toBe(false)
    expect(after.game.isFinished).toBe(true)
  })

  it('평판 900 이면 만루·대량실점으로는 안 내려간다 — 체력이 멀쩡하면 바로 던진다', () => {
    const progress = startPitcherGame({ ...기본옵션, reputation: 900 }, 씨앗(20100901))

    expect(progress.managerHookText).toBeNull()
  })

  it('구원은 감독 강판이 아예 없다 (P1 2-1)', () => {
    let progress = startPitcherGame(
      { ...기본옵션, role: PITCHER_ROLE.relief, positionCode: 5, dayCounter: 3, stamina: 0, reputation: 0 },
      씨앗(20100902),
    )
    for (let seed = 1; !progress.hasEntered && seed <= 40; seed += 1) {
      progress = startPitcherGame(
        { ...기본옵션, role: PITCHER_ROLE.relief, positionCode: 5, dayCounter: 3, stamina: 0, reputation: 0 },
        씨앗(seed),
      )
    }

    expect(progress.hasEntered).toBe(true)
    expect(progress.managerHookText).toBeNull()
  })
})

describe('돌발미션', () => {
  it('모드 3 이라 PITCHER 표를 쓴다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))

    expect(progress.burst?.table).toBe('PITCHER')
    expect(progress.burst?.maximumTriggers).toBe(MAXIMUM_BURSTS_PER_GAME)
  })

  it('타석 준비에서 발동한다 — 뜬 행은 PITCHER 표의 행이고 목표가 수비 쪽이다', () => {
    let 뜬경기: PitcherGameProgress | null = null
    for (let seed = 1; seed <= 400 && 뜬경기 === null; seed += 1) {
      const progress = startPitcherGame(기본옵션, 씨앗(seed))
      if (progress.burst?.current != null) 뜬경기 = progress
    }
    expect(뜬경기).not.toBeNull()

    const 행 = 뜬경기?.burst?.current
    expect(BURST_TABLES.PITCHER).toContain(행)
    expect([BURST_GOAL.아웃, BURST_GOAL.삼진, BURST_GOAL.병살, BURST_GOAL.고의사구]).toContain(
      행?.goal,
    )
  })

  it('한 경기를 끝까지 치르면 발동은 많아야 한 번이다 (obj+0x229 == 1)', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(20100901)), 4)

    expect(끝.burst?.triggeredCount ?? 0).toBeLessThanOrEqual(MAXIMUM_BURSTS_PER_GAME)
  })
})

describe('경기 뒤', () => {
  it('방어율은 실점 × 2700 / 아웃 이고 9999 에서 자른다 (0xb6ce8)', () => {
    expect(earnedRunAverageOf(3, 27)).toBe(300)
    expect(earnedRunAverageOf(0, 27)).toBe(0)
    expect(earnedRunAverageOf(5, 0)).toBe(9999)
    expect(earnedRunAverageOf(100, 1)).toBe(9999)
  })

  it('등판 못 한 구원은 감독 글 38 을 받는다', () => {
    // 7회 콜드게임으로 끝나 8회가 오지 않은 경기를 찾는다
    let 끝: PitcherGameProgress | null = null
    for (let seed = 1; seed <= 200 && 끝 === null; seed += 1) {
      const progress = startPitcherGame(
        { ...기본옵션, role: PITCHER_ROLE.relief, positionCode: 5, dayCounter: 3 },
        씨앗(seed),
      )
      if (progress.game.isFinished && !progress.hasEntered && progress.endedInningIndex === 6) {
        끝 = progress
      }
    }
    if (끝 === null) return

    expect(summaryOf(끝).evaluation.managerCommentIndex).toBe(38)
  })
})

describe('기록달성 (0xa77f0)', () => {
  it('투수편도 요약에 기록 id 가 담겨 G포인트가 나온다 — 늘 0 이던 것을 고친다', () => {
    // 씨앗을 바꿔 가며 기록이 하나라도 들어오는 경기를 찾는다 (삼진 계열·동료 타격 계열)
    let 요약: ReturnType<typeof summaryOf> | null = null
    for (let seed = 1; seed <= 40 && 요약 === null; seed += 1) {
      const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(seed)), seed)
      if (!끝.game.isFinished) continue
      const s = summaryOf(끝)
      if (s.recordIds.length > 0) 요약 = s
    }

    expect(요약).not.toBeNull()
    expect(recordGamePointsOf(요약!.recordIds)).toBeGreaterThan(0)
  })

  it('요약이 등판 여부를 함께 내놓는다 — 앱이 등판 경기 수를 셀 수 있다', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(20100901)), 4)

    expect(summaryOf(끝).hasEntered).toBe(true)
  })

  it('강판된 뒤에는 기록이 하나도 안 들어온다 (ctx+0x24, R15 10절)', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))
    const 강판전 = progress.recordIds.length
    const 끝 = giveUpPitching(progress, 씨앗(9))

    expect(끝.simpleEngineRunning).toBe(true)
    // 강판 뒤 남은 경기는 간이 엔진이 다 돌렸는데도 기록이 늘지 않는다
    expect(끝.recordIds.length).toBe(강판전)
    // 경기 끝 점수차 승(37~39)·완투 계열(28~31)도 막힌다
    expect(summaryOf(끝).recordIds.length).toBe(강판전)
  })

  it('동료 타석의 타격 기록도 우리 팀 것이다 — 모드 3 은 공격 게이트도 열린다 (0x3a20a)', () => {
    // 3루타(0)·홈런 단계(1~4)·연타석(9~11)·사이클(15)·볼넷(34·35) 은 모두 동료 타석에서 나온다
    const 타격기록 = new Set([0, 1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 34, 35])
    let 찾음 = false
    for (let seed = 1; seed <= 60 && !찾음; seed += 1) {
      const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(seed)), seed)
      if (!끝.game.isFinished) continue
      찾음 = 끝.recordIds.some((id) => 타격기록.has(id))
    }

    expect(찾음).toBe(true)
  })

  it('투수편은 모드 3 이라 완투 계열(28~31)이 막히지 않는다 — 타자편(모드 4)과 다른 점', () => {
    expect(
      completeGameRecordIdsOf({
        mode: 3,
        won: true,
        pitchCourseConfirmed: true,
        inningsPlayed: 9,
        outsRecorded: 27,
        hitsAllowed: 0,
        walksAllowed: 0,
        runsAllowed: 0,
      }),
    ).toEqual([31])
  })
})

describe('수비 진루 (0xaf918 자동 주루)', () => {
  it('내가 던진 타석의 인플레이 타구는 수비 시뮬레이션이 돈다 — baseState 근사를 안 쓴다', () => {
    // 인플레이 타구(안타·아웃)가 한 번이라도 나오면 진행 결과에 수비 시뮬레이션이 남는다
    let 끝: PitcherGameProgress | null = null
    for (let seed = 1; seed <= 20 && 끝 === null; seed += 1) {
      const 결과 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(seed)), seed)
      if (결과.lastDefensePlay !== null) 끝 = 결과
    }

    expect(끝).not.toBeNull()
    expect(끝!.lastDefensePlay!.ticks.length).toBeGreaterThan(0)
  })

  it('간이 엔진이 돌린 타석에는 희생플라이가 없다 (E-2 확정)', () => {
    // 등판일이 아니면 경기 전체가 간이 엔진이다 — 뜬공아웃으로 점수가 나면 안 된다
    const 뜬공아웃 = { kind: '아웃', detail: '뜬공아웃' } as const
    expect(
      advanceRunners({ first: false, second: false, third: true }, 뜬공아웃, 0, { quickEngine: true }),
    ).toEqual({ bases: { first: false, second: false, third: true }, runsScored: 0, outsAdded: 1 })
  })
})
