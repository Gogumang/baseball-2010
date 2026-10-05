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
  pickoff,
  pitchSlotsFor,
  resolveDefensePlay,
  startPitch,
  startPitcherGame,
  startsToday,
  summaryOf,
  throwPitch,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
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

describe('주자 처리는 수비 화면이 끝나야 정해진다 (상태 0x17 이 도는 동안은 붙들어 둔다)', () => {
  /**
   * 인플레이 타구가 처음 뜨는 자리까지 던져 **그 직전 상태**와 **붙들린 상태**를 함께 돌려준다.
   *
   * 투수편은 타석 결과를 난수가 정하므로 타자편 테스트처럼 결과 코드를 박아 넣을 수 없다 —
   * 나올 때까지 한가운데 직구를 던진다.
   */
  function 붙들린자리(seed: number) {
    const random = 씨앗(seed)
    let current = startPitcherGame(기본옵션, random)
    for (let pitch = 0; pitch < 300; pitch += 1) {
      if (!isPitchTurn(current)) break
      const next = startPitch(current, 한가운데직구, random)
      if (next.pendingDefensePlay !== null) return { 직전: current, 진행중: next, random }
      current = next
    }
    throw new Error(`씨앗 ${seed} 에서 인플레이 타구가 나오지 않았습니다`)
  }

  /** 인플레이 타구가 처음 뜰 때까지 공 몇 개가 드는가 — 두 길을 같은 자리에서 견주려고 센다 */
  function 인플레이까지투구수(seed: number): number {
    const random = 씨앗(seed)
    let current = startPitcherGame(기본옵션, random)
    for (let pitch = 1; pitch <= 300; pitch += 1) {
      if (!isPitchTurn(current)) break
      current = startPitch(current, 한가운데직구, random)
      if (current.pendingDefensePlay !== null) return pitch
    }
    throw new Error(`씨앗 ${seed} 에서 인플레이 타구가 나오지 않았습니다`)
  }

  it('인플레이 타구는 타구만 들고 멈춘다 — 진루·아웃·실점이 하나도 안 먹는다', () => {
    const { 직전, 진행중 } = 붙들린자리(3)

    expect(진행중.pendingDefensePlay).not.toBeNull()
    // 투구 때의 루 상황·아웃을 그대로 들고 간다
    expect(진행중.pendingDefensePlay!.bases).toEqual(직전.game.bases)
    expect(진행중.pendingDefensePlay!.outs).toBe(직전.game.outs)
    // 수비는 사람(나)이다 → 협살이 안 돈다 (S8 1-4)
    expect(진행중.pendingDefensePlay!.defenseIsCpu).toBe(false)
    // 사람 수비라 `0xae6c8` 의 앞 항이 거짓 → 환경설정 송구(+0xf4)가 그대로 먹는다.
    // 옵션을 안 넘겼으니 원본 기본값인 수동이다 (CPU 송구 결정 0xafa60 이 안 돈다)
    expect(진행중.pendingDefensePlay!.throwMode).toBe('수동')
    // 경기 상태·기록은 한 톨도 안 바뀐다 — 다음 타석도 시작되지 않았다
    expect(진행중.game).toEqual(직전.game)
    expect(진행중.record).toEqual(직전.record)
    expect(진행중.log).toEqual(직전.log)
    expect(진행중.teamRunsAllowed).toBe(직전.teamRunsAllowed)
  })

  it('붙들려 있는 동안은 다음 공이 나가지 않는다 (원본은 0x17 을 도는 동안 0xf 로 안 간다)', () => {
    const { 진행중, random } = 붙들린자리(3)

    expect(isPitchTurn(진행중)).toBe(false)
    // 그래도 던져 보면 아무 일도 없다
    expect(startPitch(진행중, 한가운데직구, random)).toBe(진행중)
  })

  it('화면이 돌린 결과를 먹이면 그때 진루·아웃이 정해지고 칸이 비워진다', () => {
    const { 직전, 진행중, random } = 붙들린자리(3)

    const 끝 = resolveDefensePlay(진행중, runDefensePlay(진행중.pendingDefensePlay!), random)

    expect(끝.pendingDefensePlay).toBeNull()
    // 타석이 하나 넘어갔다 — 타순이 돌거나 아웃·점수가 움직인다
    expect(끝.log.length).toBeGreaterThan(직전.log.length)
    // 이미 눈으로 다 본 플레이라 재생거리로 남기지 않는다 — 남기면 같은 장면을 한 번 더 튼다
    expect(끝.lastDefensePlay).toBe(직전.lastDefensePlay)
  })

  it('붙드는 것은 인플레이 타구뿐이다 — 삼진·볼넷은 곧장 끝난다', () => {
    // 씨앗 3 은 게이지 끈 공의 흩어짐 반지름을 t + 3 칸으로 고친 뒤(0x4dce0) 300 개 안에 삼진·볼넷이 안 나와 1 로 옮겼다
    const random = 씨앗(1)
    let current = startPitcherGame(기본옵션, random)
    const 붙든결과: string[] = []
    let 안붙든타석 = 0
    for (let pitch = 0; pitch < 300 && isPitchTurn(current); pitch += 1) {
      const 직전 = current
      current = startPitch(current, 한가운데직구, random)
      if (current.pendingDefensePlay !== null) {
        붙든결과.push(current.pendingDefensePlay.outcome.kind)
        current = resolveDefensePlay(current, runDefensePlay(current.pendingDefensePlay), random)
        continue
      }
      // 붙들지 않았는데 로그가 늘었다 = 수비가 개입할 것이 없는 타석 결과로 끝났다
      if (current.log.length > 직전.log.length) 안붙든타석 += 1
    }

    expect(붙든결과.length).toBeGreaterThan(0)
    expect(붙든결과.every((kind) => kind === '안타' || kind === '아웃')).toBe(true)
    expect(안붙든타석).toBeGreaterThan(0)
  })

  it('둘로 쪼갠 길과 한 번에 돌리는 길의 결과가 같다 — 난수 차례도 같다', () => {
    const 씨 = 3
    const 공수 = 인플레이까지투구수(씨)

    const 한번에 = (() => {
      const random = 씨앗(씨)
      let current = startPitcherGame(기본옵션, random)
      for (let pitch = 1; pitch <= 공수; pitch += 1) {
        current = throwPitch(current, 한가운데직구, random)
      }
      return current
    })()
    const 쪼개서 = (() => {
      const random = 씨앗(씨)
      let current = startPitcherGame(기본옵션, random)
      for (let pitch = 1; pitch <= 공수; pitch += 1) {
        current = startPitch(current, 한가운데직구, random)
        if (current.pendingDefensePlay === null) continue
        current = resolveDefensePlay(current, runDefensePlay(current.pendingDefensePlay), random)
      }
      return current
    })()

    expect(쪼개서.game).toEqual(한번에.game)
    expect(쪼개서.record).toEqual(한번에.record)
    expect(쪼개서.pitcherRecord).toEqual(한번에.pitcherRecord)
    expect(쪼개서.decision).toEqual(한번에.decision)
    expect(쪼개서.recordIds).toEqual(한번에.recordIds)
    expect(쪼개서.stamina).toBe(한번에.stamina)
    expect(쪼개서.teamRunsAllowed).toBe(한번에.teamRunsAllowed)
    expect(쪼개서.log.map((entry) => entry.text)).toEqual(한번에.log.map((entry) => entry.text))
    // ⚠️ 한 군데만 다르다 — 껍데기 길은 아직 아무것도 안 보여 줬으므로 돌린 결과를 재생거리로 넘기고,
    // 쪼갠 길은 화면이 이미 다 보여 줘서 안 남긴다
    expect(한번에.lastDefensePlay).not.toBeNull()
    expect(쪼개서.lastDefensePlay).toBeNull()
  })
})

/**
 * 투수 미션 조준 흔들림 (0x39c5c) — 진행기 입력에 실린 `conditionCode` 가 투구 만들기까지 간다.
 * ⚠️ 흔들림 값은 **투수 미션 레코드**에서 온다. 타자 미션은 전부 0 이라 아무 일도 없다.
 */
describe('미션 조준 흔들림을 진행기가 실어 나른다', () => {
  const 던진공 = (missionConditionCode?: number) =>
    startPitch(
      startPitcherGame(기본옵션, 씨앗(3)),
      { ...한가운데직구, ...(missionConditionCode === undefined ? {} : { missionConditionCode }) },
      씨앗(5),
    ).lastPitch

  it('안 실으면 지금까지와 똑같은 공이다', () => {
    expect(던진공(0)?.plate).toEqual(던진공()?.plate)
  })

  it('세기 3 을 실으면 공이 달라진다', () => {
    expect(던진공(3)?.plate).not.toEqual(던진공()?.plate)
  })
})

describe('견제 — 구질 고르기(0xf)에서 3·1·7 (0x53548 → 0x50f28 → 종류 4)', () => {
  const 주자있는판 = (bases: PitcherGameProgress['game']['bases']): PitcherGameProgress => {
    const progress = startPitcherGame(기본옵션, 씨앗(3))
    return { ...progress, game: { ...progress.game, bases } }
  }

  it('그 루에 주자가 없거나 견제 키가 아니면 아무 일도 없다 — 같은 객체를 돌려준다', () => {
    const progress = 주자있는판({ first: true, second: false, third: false })
    expect(isPitchTurn(progress)).toBe(true)
    expect(pickoff(progress, '1', 씨앗(1))).toBe(progress) // 2루 견제인데 2루가 비었다
    expect(pickoff(progress, '2', 씨앗(1))).toBe(progress) // 견제 키가 아니다
  })

  it('견제는 투구가 아니다 — 투구 수·스태미나·볼카운트·타자 상대 수가 그대로고 재생할 판만 생긴다', () => {
    const progress = 주자있는판({ first: true, second: false, third: false })
    const after = pickoff(progress, '3', 씨앗(1))
    expect(after).not.toBe(progress)
    expect(after.pitchCount).toBe(progress.pitchCount)
    expect(after.stamina).toBe(progress.stamina)
    expect(after.atBat).toEqual(progress.atBat)
    expect(after.atBatPitches).toBe(progress.atBatPitches)
    expect(after.pitcherRecord).toEqual(progress.pitcherRecord)
    expect(after.opponentOrderIndex).toBe(progress.opponentOrderIndex)
    expect(after.game).toEqual(progress.game)
    expect(after.lastDefensePlay?.throwBase).toBe(1)
    expect(after.lastDefensePlay?.ticks.length).toBeGreaterThan(0)
    expect(after.log[0]?.text).toContain('1루 견제')
    // 다시 던질 수 있다 — 상태 0xf 로 돌아온다
    expect(isPitchTurn(after)).toBe(true)
  })
})

/**
 * `index` 번째 next() 만 `hit` 을, 나머지는 늘 `rest` 를 내는 각본 난수 — 굴림 수도 센다.
 * nextInRange·pick 은 실투·타자 결정 길에서 쓰이지 않지만 next() 와 같은 값으로 돌린다.
 */
function 각본난수(rest: number, index = -1, hit = rest) {
  let calls = 0
  const value = () => {
    const out = calls === index ? hit : rest
    calls += 1
    return out
  }
  return {
    next: value,
    nextInRange: (minimum: number, maximum: number) => minimum + value() * (maximum - minimum),
    pick: <T,>(candidates: readonly T[]) => candidates[Math.floor(value() * candidates.length)],
    calls: () => calls,
  }
}

describe('실투 판정 0x33cbc — 투구 순간에 굴린다', () => {
  it('궤적 뒤 · CPU 타자 결정 앞에서 rand(0,100) 한 번 — 실투면 지켜볼 공도 친다', () => {
    const 등판 = startPitcherGame(기본옵션, 씨앗(20100901))

    // 모든 굴림이 0.7 이면 공이 존 안에 머물고, 실투가 아니며(70 ≥ p) 타자는 표에서 지켜보기를 뽑는다
    const 평소 = 각본난수(0.7)
    const 지켜봄 = startPitch(등판, 한가운데직구, 평소)
    expect(지켜봄.lastResolution).toEqual({ kind: '스트라이크', isSwinging: false })
    // 지켜보면 타자 쪽은 표 굴림 하나뿐이다 — 그 바로 앞 굴림이 실투 판정이다
    const 실투자리 = 평소.calls() - 2

    // 그 한 굴림만 0 으로 바꾸면 실투(p > 0) → 표 선택이 치기로 강제되어 휘두른다
    const 실투 = startPitch(등판, 한가운데직구, 각본난수(0.7, 실투자리, 0))
    expect(실투.lastResolution?.kind).toBe('타구')
  })

  it('마구(22)는 굴림 없이 실투가 아니다 — 굴림이 하나 적다', () => {
    const 등판 = startPitcherGame(기본옵션, 씨앗(20100901))
    const 보통 = 각본난수(0.99)
    startPitch(등판, 한가운데직구, 보통)
    const 마구 = 각본난수(0.99)
    const 던짐 = startPitch(등판, { typeNumber: 22, courseCell: 4, gaugeCell: 0 }, 마구)
    expect(던짐.lastPitch).not.toBeNull()
    // 마구는 등급 뽑기(0x4dbac)도 굴리지 않는다(늘 5) — 실투 굴림까지 둘이 빠진다
    expect(마구.calls()).toBe(보통.calls() - 2)
  })
})

/**
 * 내가 던진 공에 CPU 타자가 맞는다 — 0x35a20 (지켜본 공이 사각형 0xcfd50 안).
 * 기본 배치 side 1(좌타)에서 바깥 칸 2 를 노린 직구가 흩어져 상자 [271, 309] 에 닿는 씨앗을 골랐다.
 * 게이지를 끈 공의 흩어짐 반지름이 t + 3 칸(0x4dce0)이라 칸 2 직구의 첫 공 사구는 1% 안팎이다 — 씨앗 3000 개 중 23 개.
 */
describe('사구 — 내가 맞힌 타석 (0x35a20 → 0xa8024 · 벤치 클리어링)', () => {
  const 바깥직구 = { typeNumber: 1, courseCell: 2, gaugeCell: 0 }
  /** 사구지만 벤치 클리어링 굴림이 20 이상인 씨앗 · 굴림이 19 이하인 씨앗 */
  const 사구씨앗 = 35
  const 벤치씨앗 = 1179

  it('밀어내기 1루 · R+0x148 사구 칸 · 출루 허용(state[0x88]) · 삼자범퇴 칸이 깨진다 — R+0x144 볼넷은 그대로', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 끝 = startPitch(progress, 바깥직구, 씨앗(사구씨앗))

    expect(끝.lastResolution).toEqual({ kind: '사구' })
    expect(끝.game.bases.first).toBe(true)
    expect(끝.game.outs).toBe(0)
    expect(끝.pitcherRecord.hitByPitch).toBe(1)
    expect(끝.pitcherRecord.battersFaced).toBe(1)
    expect(끝.record.walksAllowed).toBe(0)
    expect(끝.teamWalksAllowed).toBe(1)
    expect(끝.perfectInningFlag).toBe(false)
    expect(summaryOf(끝).record.hitByPitch).toBe(1)
    expect(끝.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })

  it('벤치 클리어링에 들어가면 수비(나)가 사람이라 내 스태미나 −1000', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 보통 = startPitch(progress, 바깥직구, 씨앗(사구씨앗))
    const 벤치 = startPitch(progress, 바깥직구, 씨앗(벤치씨앗))

    expect(벤치.lastResolution).toEqual({ kind: '사구' })
    // 공 하나의 스태미나 소모는 구질만 보므로 두 씨앗이 같다 — 차이는 0xaeab0(팀, 1000) 하나다
    expect(보통.stamina - 벤치.stamina).toBe(1000)
    expect(벤치.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
    expect(벤치.game).toEqual(보통.game)
  })

  it('퍼펙트(기록 31)가 사구로 깨진다 — 출루 허용 칸이 볼넷+사구를 센다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 끝 = startPitch(progress, 바깥직구, 씨앗(사구씨앗))
    expect(
      completeGameRecordIdsOf({
        mode: 3,
        won: true,
        pitchCourseConfirmed: true,
        inningsPlayed: 9,
        outsRecorded: 27,
        hitsAllowed: 0,
        walksAllowed: 끝.teamWalksAllowed,
        runsAllowed: 0,
      }),
    ).not.toContain(31)
  })
})

describe('R+0x128 · 레코드 +0x22 — 득점 주자를 내보낸 투수에게 매긴다 (정산 0xa8ea4~0xa8f60)', () => {
  it('내가 끝까지 던진 경기는 평가 칸 R+0x128 이 내 실점(+0x22)과 같다 — 늘 0 이 아니다', () => {
    let 요약: ReturnType<typeof summaryOf> | null = null
    for (let seed = 1; seed <= 40 && 요약 === null; seed += 1) {
      const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(seed)), seed)
      if (!끝.game.isFinished || 끝.runsAllowedByMe === 0) continue
      요약 = summaryOf(끝)
    }

    expect(요약).not.toBeNull()
    expect(요약!.record.runsAllowedField).toBeGreaterThan(0)
    expect(요약!.record.runsAllowedField).toBe(요약!.seasonDelta.runsAllowed)
  })

  it('강판 때 루에 남긴 주자가 들어오면 내 실점이다 (주자+0x30 = 나) — 뒤에 나간 주자 득점은 아니다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))
    const 만루 = {
      ...progress,
      game: { ...progress.game, bases: { first: true, second: true, third: true } },
    }
    let 찾음 = false
    for (let seed = 1; seed <= 60 && !찾음; seed += 1) {
      const 끝 = giveUpPitching(만루, 씨앗(seed))
      if (끝.runsAllowedByMe === 0) continue
      찾음 = true
      // 남겨 둔 주자는 셋이라 내 실점은 셋을 넘지 않는다 — 팀 실점과 달리 강판 뒤 새 주자 득점은 빠진다
      expect(끝.runsAllowedByMe).toBeLessThanOrEqual(3)
      expect(끝.record.runsAllowedField).toBe(끝.runsAllowedByMe)
      expect(끝.inheritedRunners).toBe(0)
    }

    expect(찾음).toBe(true)
  })

  it('빈 루에서 강판하면 남은 경기 실점은 하나도 내 것이 아니다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(20100901))
    const 끝 = giveUpPitching(progress, 씨앗(9))

    expect(끝.teamRunsAllowed).toBeGreaterThanOrEqual(0)
    expect(끝.runsAllowedByMe).toBe(0)
    expect(끝.record.runsAllowedField).toBe(0)
  })
})
