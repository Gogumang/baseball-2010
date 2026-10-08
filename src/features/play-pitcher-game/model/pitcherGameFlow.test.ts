import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom, createFractionRandom } from '@/shared/api/random/fractionRandom'
import { completeGameRecordIdsOf, recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { advanceRunners } from '@/entities/game/model/baseState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { BURST_TABLES } from '@/entities/burst-mission/model/burstMissionRow'
import { MAXIMUM_BURSTS_PER_GAME } from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_GOAL } from '@/entities/burst-mission/model/burstMissionJudge'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  closeManagerHookWindow,
  confirmScene,
  MY_PITCHER_SLOT,
  earnedRunAverageOf,
  giveUpPitching,
  isPitchTurn,
  pickoff,
  pitchSlotsFor,
  pitchersOfRecordOf,
  resolveBenchClearing,
  resolveDefensePlay,
  resolveRunnerPlay,
  startPitch,
  startPitcherGame,
  startsToday,
  summaryOf,
  throwPitch,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import type {
  PitcherGameOptions,
  PitcherGameProgress,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { SCENE_EFFECT_INIT_ROLL_COUNT } from '@/entities/batting/model/battedBallOutcome'

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
    // 0xe 에 서 있으면 OK 부터 (그 뒤 굴림 — 돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)
    if (current.sceneConfirmPending === true) {
      current = confirmScene(current, random)
      continue
    }
    current = throwPitch(current, 한가운데직구, random)
  }
  throw new Error('경기가 끝나지 않았습니다')
}

describe('리그 투수 차례·레코드 스태미나', () => {
  it('상대 차례 0번이 선발이고 그 레코드 +0x2c 로 선다 — 경기 끝 표에 마운드 값이 얹힌다', () => {
    const 끝 = startPitcherGame(
      {
        ...기본옵션,
        dayCounter: 3,
        opponentPitcherOrder: [2, 3, 0, 1, 4, 5, 6, 7],
        opponentPitcherStaminas: [10_000, 10_000, 7_000, 10_000, 10_000, 10_000, 10_000, 10_000],
      },
      씨앗(7),
    )
    expect(끝.game.isFinished).toBe(true)
    const 요약 = summaryOf(끝)
    expect(요약.pitcherStaminas.opponent[끝.opponentMound.pitcherSlot]).toBe(끝.opponentMound.stamina)
    // 선발 2번은 7000 에서 섰으니 더 깎였다
    expect(요약.pitcherStaminas.opponent[2]).toBeLessThan(7_000)
  })

  it('리그 투수 줄 — 내 투수는 빼고 양 팀 CPU 투수 실점 합이 점수와 같다 (구원 날, 전부 간이)', () => {
    const 끝 = startPitcherGame({ ...기본옵션, dayCounter: 3, role: PITCHER_ROLE.starter }, 씨앗(11))
    const 재료 = summaryOf(끝).leaguePitchers
    const 실점 = (teamId: number) =>
      재료.lines.filter((line) => line.teamId === teamId).reduce((total, line) => total + line.runsAllowed, 0)
    expect(실점(기본옵션.ourTeamId)).toBe(끝.game.opponentScore)
    expect(실점(기본옵션.opponentTeamId)).toBe(끝.game.ourScore)
    expect(재료.lines.every((line) => line.pitcherSlot >= 0 && line.pitcherSlot < 8)).toBe(true)
    // 판정 칸은 붙박이 표 칸으로 되돌려 둔다
    for (const record of [재료.decision.winner, 재료.decision.loser]) {
      if (record !== null) expect(record.number).toBeGreaterThanOrEqual(0)
    }
  })
})

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

  it('스태미나는 공이 손을 떠나기 전(0x11 진입 0x3dec6 → 0xa5e14)에 깎인다 — 놓기 0x4dc78 의 등급 · 피로가 깎은 뒤 체력%를 본다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(3))
    // 둘 다 던지기 전엔 1~19%(피로 −50%)다 — 150 은 이 공으로 0%(피로 −90% · 제구 등급 지친 갈래 0xb74bc)가 되고 250 은 1% 에 남는다
    const 지침 = throwPitch({ ...progress, stamina: 150 }, 한가운데직구, 씨앗(5))
    const 버팀 = throwPitch({ ...progress, stamina: 250 }, 한가운데직구, 씨앗(5))
    expect(Math.trunc(지침.stamina / 100)).toBe(0)
    expect(Math.trunc(버팀.stamina / 100)).toBe(1)
    expect(지침.lastPitch).not.toEqual(버팀.lastPitch)
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

  it("0xe 에서 '#' 강판 물음(0x4994a)에 '예' 하면 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 아예 안 돈다", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const 대기 = startPitcherGame(기본옵션, 씨앗(seed))
      if (대기.sceneConfirmPending !== true) continue
      // 0xe 에서 "아니오" 는 진행기에 아무 일도 없다 — 그 뒤 OK 는 안 열고 OK 한 것과 같은 굴림이다
      const 바로 = 각본난수(0.3)
      const 그냥 = confirmScene(대기, 바로)
      const 아니오뒤 = 각본난수(0.3)
      expect(confirmScene(대기, 아니오뒤)).toEqual({ ...그냥, sceneConfirm: 그냥.sceneConfirm })
      expect(아니오뒤.calls()).toBe(바로.calls())
      expect(바로.calls()).toBeGreaterThan(0)
      // 0xe 에서 "예" — 돌발을 안 굴린 채 0x21 로 간다
      const 강판 = giveUpPitching(대기, 씨앗(9))
      expect(강판.sceneConfirmPending).toBe(false)
      expect(강판.burst?.triggeredCount ?? 0).toBe(0)
      expect(confirmScene(강판, 씨앗(9))).toBe(강판)
      return
    }
    throw new Error('0xe 에 선 경기가 없다')
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
      const random = 씨앗(seed)
      const 대기 = startPitcherGame(기본옵션, random)
      // 0xe 에서는 아직 안 굴렸다 — OK(메시지 1) 뒤에 굴린다
      expect(대기.burst?.current ?? null).toBeNull()
      const progress = confirmScene(대기, random)
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

  /**
   * 0x8f158 은 메시지 1 의 인자 0xe 갈래(0x50c42) 한 곳 — 사람 장면에서만 돈다. 모드 3 의 0xc1eac 는 우리 공격을
   * 늘 자동(0x21), 수비는 "지금 투수가 내 선수인가" 로 가른다. 그래서 구원 대기 중(1~7회)의 자동 타석은 굴리지 않는다.
   */
  it('구원 대기 중 자동 타석에서는 돌발이 안 뜬다 — 뜨면 내 첫 타석 준비에서 뜬 채로 온다', () => {
    const 구원 = { ...기본옵션, role: PITCHER_ROLE.relief }
    let 뜬경기 = 0
    // 자동 타석에 대타·투수 교체 굴림이 끼면서 씨앗마다 8회 상황이 바뀌어 넓게 본다 (돌발이 뜨는 경기가 드물다)
    for (let seed = 1; seed <= 60; seed += 1) {
      const random = 씨앗(seed)
      const progress = confirmScene(startPitcherGame(구원, random), random)
      // 8회 전에 콜드로 끝난 경기(씨앗 12 — 7회말 11-1)는 구원 등판이 없다
      if (progress.game.isFinished) continue
      expect(progress.onMound, `씨앗 ${seed}`).toBe(true)
      if ((progress.burst?.triggeredCount ?? 0) === 0) continue
      뜬경기 += 1
      // 자동 타석에서 떴다면 그 자리에서 판정되거나(예전 웹) 0x21 진입에서 내려가 비어 있었을 것이다
      expect(progress.burst?.current, `씨앗 ${seed}`).not.toBeNull()
      expect(progress.lastBurstResolution, `씨앗 ${seed}`).toBeNull()
    }

    expect(뜬경기).toBeGreaterThan(0)
  })

  it('내 수비 반 이닝에서 판정 못 받고 남은 돌발은 다음 자동 타석 앞(0x8f628)에서 판정 없이 내려간다', () => {
    const 시작 = startPitcherGame(기본옵션, 씨앗(20100901))
    const 행 = BURST_TABLES.PITCHER[0]
    // 목표 5 는 판정을 안 한다 — 결과비트가 무엇이든 남는다 (0x8f414)
    let progress: PitcherGameProgress = {
      ...시작,
      game: { ...시작.game, outs: 2 },
      burst: 시작.burst === null ? null : { ...시작.burst, current: { ...행, goal: 5 }, triggeredCount: 1 },
    }
    const random = 씨앗(5)
    const 반이닝 = { inning: progress.game.inning, half: progress.game.half }
    for (let pitch = 0; pitch < 300; pitch += 1) {
      if (progress.game.isFinished) break
      if (progress.game.inning !== 반이닝.inning || progress.game.half !== 반이닝.half) break
      if (progress.managerHookText !== null) {
        progress = closeManagerHookWindow(progress, random)
        continue
      }
      // 같은 반 이닝 안의 사람 타석 사이에서는 남아 있다
      expect(progress.burst?.current?.goal).toBe(5)
      progress = throwPitch(progress, 한가운데직구, random)
    }

    expect(progress.burst?.current).toBeNull()
    expect(progress.burst?.judgement).toBeNull()
    expect(progress.burst?.triggeredCount).toBe(MAXIMUM_BURSTS_PER_GAME)
    expect(progress.lastBurstResolution).toBeNull()
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
      // 파울 각 공의 판(타석이 아직 안 끝났다)은 화면이 돈 것으로 치고 넘긴다 — 페어 타구 판을 찾는다
      if (next.pendingDefensePlay !== null && next.atBat.outcome === null) {
        current = resolveDefensePlay(next, runDefensePlay(next.pendingDefensePlay), random)
        continue
      }
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
    // 씨앗 3 은 게이지 끈 공의 흩어짐 반지름을 t + 3 칸으로 고친 뒤(0x4dce0) 300 개 안에 삼진·볼넷이 안 나와 1 로 옮겼다.
    // 1회초 판(0x18)의 걸음 굴림 36 개가 첫 타석 준비 앞에 끼면서 1 → 3 으로 다시 옮겼다
    const random = 씨앗(3)
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
 * `index` 번째 굴림만 `hit` 비율을, 나머지는 늘 `rest` 비율을 내는 각본 난수 — 굴림 수도 센다.
 */
function 각본난수(rest: number, index = -1, hit = rest) {
  let calls = 0
  const value = () => {
    const out = calls === index ? hit : rest
    calls += 1
    return out
  }
  return {
    ...createFractionRandom(value),
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
    // 휘둘렀다 — 맞혔는지는 0xab214 몫이다(내 투수 보너스 aP 400 이 붙은 뒤로 이 각본은 헛스윙이 된다)
    expect(실투.lastResolution).toEqual({ kind: '스트라이크', isSwinging: true })
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
  /**
   * 사구지만 벤치 클리어링 굴림이 20 이상인 씨앗 · 굴림이 19 이하인 씨앗.
   * 벤치 클리어링 굴림 앞에 공 도착 0x3dfac 의 0.1% 굴림(0x35034)이 하나 끼어 1179 → 86 으로 바꿨다.
   * 원본 난수 생성기(0xbfa54 · 0x9d468)로 바꾸며 35 → 182 · 86 → 2016 으로 바꿨다
   */
  const 사구씨앗 = 182
  const 벤치씨앗 = 2016

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
    // 레코드 +0x2a 사사구는 볼넷 · 사구를 함께 센다 (a8bd2)
    expect(끝.freePassesByMe).toBe(1)
    expect(summaryOf(끝).seasonDelta.walks).toBe(1)
    expect(끝.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(false)
  })

  it('벤치 클리어링에 들어가면 수비(나)가 사람이라 내 스태미나 −1000 — 연출(0x1e)에서 사구를 붙든다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 보통 = startPitch(progress, 바깥직구, 씨앗(사구씨앗))
    const 벤치 = startPitch(progress, 바깥직구, 씨앗(벤치씨앗))

    expect(벤치.lastResolution).toEqual({ kind: '사구' })
    // 공 하나의 스태미나 소모는 구질만 보므로 두 씨앗이 같다 — 차이는 0xaeab0(팀, 1000) 하나다
    expect(보통.stamina - 벤치.stamina).toBe(1000)
    expect(벤치.log.some((entry) => entry.text.includes('벤치 클리어링'))).toBe(true)
    // 밀어내기 주루·정산은 연출이 끝나야 돈다 — 그 동안 다음 공이 안 나간다
    // 이 사구 공이 연 밀어내기 판(종류 2)은 연출 뒤에 재생하려고 함께 붙든다
    expect(벤치.pendingBenchClearing).toMatchObject({ outcome: { kind: '사구' }, arrivalPlay: { kind: 2 } })
    expect(벤치.game).toEqual(progress.game)
    expect(isPitchTurn(벤치)).toBe(false)

    const 풀림 = resolveBenchClearing(벤치, { reachedTargetTick: true }, 씨앗(7))
    expect(풀림.pendingBenchClearing).toBeNull()
    expect(풀림.game).toEqual(보통.game)
    expect(풀림.pitcherRecord.hitByPitch).toBe(1)
  })

  it('연출이 끝나면 사구를 보통 길로 먹인다 — 틱 10 을 지났으면 그 앞에 굴림 8 번이 끼어든다 (0x401d4)', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 벤치 = startPitch(progress, 바깥직구, 씨앗(벤치씨앗))
    expect(벤치.pendingBenchClearing).not.toBeNull()

    const 다봄 = resolveBenchClearing(벤치, { reachedTargetTick: true }, 씨앗(11))
    const 앞당김 = 씨앗(11)
    for (let 번 = 0; 번 < 8; 번 += 1) 앞당김.rand(0, 2)
    const 건너뜀 = resolveBenchClearing(벤치, { reachedTargetTick: false }, 앞당김)
    expect(다봄.game).toEqual(건너뜀.game)
    expect(다봄.log.map((entry) => entry.text)).toEqual(건너뜀.log.map((entry) => entry.text))
  })

  it('미리 다 돌리는 껍데기(throwPitch)는 연출을 끝까지 본 것으로 친다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 끝 = throwPitch(progress, 바깥직구, 씨앗(벤치씨앗))
    expect(끝.lastResolution).toEqual({ kind: '사구' })
    expect(끝.pendingBenchClearing).toBeNull()
    expect(끝.game.bases.first).toBe(true)
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

describe('포스트시즌 게이트 0xa56dc (모드 3 갈래 0xa571c — S+0xb4 포스트시즌이면 거짓)', () => {
  it('포스트시즌 경기는 R 칸(코드 0x14~0x1f)·R+0x128·+0x22 를 하나도 안 센다 — 삼자범퇴 이닝(0x20)만 센다', () => {
    let 확인 = false
    for (let seed = 1; seed <= 40 && !확인; seed += 1) {
      const 끝 = 끝까지던지기(startPitcherGame({ ...기본옵션, isPostseason: true }, 씨앗(seed)), seed)
      if (!끝.game.isFinished || 끝.pitchCount === 0 || 끝.teamRunsAllowed === 0) continue
      확인 = true
      const 요약 = summaryOf(끝)
      expect(요약.record).toMatchObject({
        hitsAllowed: 0,
        strikeouts: 0,
        outsRecorded: 0,
        walksAllowed: 0,
        hitByPitch: 0,
        strikeoutCombo: 0,
        runsAllowedField: 0,
        leadingAtEntry: false,
      })
      expect(끝.pitcherRecord.battersFaced).toBe(0)
      expect(끝.runsAllowedByMe).toBe(0)
      expect(요약.seasonDelta).toMatchObject({ outs: 0, strikeouts: 0, runsAllowed: 0 })
    }
    expect(확인).toBe(true)
  })

  it('정규시즌 같은 경기는 센다', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(3)), 3)
    expect(summaryOf(끝).record.outsRecorded).toBeGreaterThan(0)
  })
})

/**
 * 공수 교대 판(상태 0x18 교대 가지) — 0x4f928 틱 0 은 앞 장면이 0x21 이 아니고 `0xc2198(sim, 1)` 이 거짓일 때만 판을 세운다.
 * 모드 3 의 0xc1e04 칸(0xc1eac)은 우리 공격을 늘 자동(0x21)으로, 상대 공격은 내 투수가 마운드에 있을 때만 사람 장면으로 본다
 * → 판이 서는 것은 인트로 뒤 **1회초 판** 하나뿐이고, 그것도 후공·오늘 선발일 때만이다.
 */
describe('공수 교대 판 (상태 0x18) — 모드 3 은 1회초 판만', () => {
  it('후공·선발이면 1회초 판이 서고, 경기 내내 다른 판은 안 선다', () => {
    const 시작 = startPitcherGame(기본옵션, 씨앗(20100901))
    expect(시작.halfInningBoard).toEqual({ serial: 1, inning: 1, half: '초' })

    const 끝 = 끝까지던지기(시작, 4)
    expect(끝.halfInningBoard?.serial).toBe(1)
  })

  it('선공이면 첫 장면이 우리 공격(자동)이라 판이 안 선다', () => {
    const 시작 = startPitcherGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, 씨앗(20100901))
    expect(isPitchTurn(시작)).toBe(true)
    expect(시작.halfInningBoard).toBeNull()
  })

  it('구원(8회 등판)은 앞이 자동 장면이라 판 없이 곧장 던진다', () => {
    const 시작 = startPitcherGame({ ...기본옵션, role: PITCHER_ROLE.relief }, 씨앗(20100901))
    if (isPitchTurn(시작)) expect(시작.game.inning).toBe(8)
    expect(시작.halfInningBoard).toBeNull()
  })

  it('판이 서면 0x3fac4 의 걸음 굴림 36 개가 첫 타석 준비(0xe 강판·0xf 돌발)보다 앞에 끼어든다', () => {
    /** 장면 덱 섞기(0x3e340 → 0xb08e8, 코드마다 패턴 수만큼 rand) · 효과 객체(3ef6e, 1202) 다음 n 개는 고정값, 나머지는 씨앗 77 */
    const 장면덱굴림 =
      Object.values(BATTED_BALL_PATTERNS).reduce((sum, patterns) => sum + patterns.length, 0) + SCENE_EFFECT_INIT_ROLL_COUNT
    const 앞값 = (n: number, value: number): RandomPort => {
      const rest = 씨앗(77)
      const 고정 = createConstantRandom(value)
      let 번 = 0
      const 이번 = (): RandomPort => {
        // 장면 덱 · 효과 객체 다음의 시뮬 초기화 rand(0, 2)(0x3fa0e) 하나 뒤부터 n 개
        const 지금 = 번++ - 1
        return 지금 >= 장면덱굴림 && 지금 < 장면덱굴림 + n ? 고정 : rest
      }
      return {
        rand: (lo, hi) => 이번().rand(lo, hi),
        rand9d: (m) => (m <= 0 ? 0 : 이번().rand9d(m)),
      }
    }
    /** 첫 타석 0xe 의 OK 까지 (OK 뒤 메시지 1 의 돌발 굴림) */
    const OK까지 = (random: RandomPort) => {
      const 대기 = startPitcherGame(기본옵션, random)
      const 확인 = confirmScene(대기, random)
      // 대기 객체는 걸음마다 새로 만드니 비교에서 뺀다
      return { ...확인, sceneConfirm: null }
    }
    // 판이 첫 36 개를 먹고 버리므로 그 값이 무엇이든 경기는 같다
    expect(OK까지(앞값(36, 0.001))).toEqual(OK까지(앞값(36, 0.999)))
    // 하나라도 타석 준비 쪽으로 새면 갈린다 — 이 비교가 실제로 무언가를 재는지 확인
    expect(OK까지(앞값(37, 0.001))).not.toEqual(OK까지(앞값(37, 0.999)))
  })
})

describe('경기 끝 결과 판의 승·패·세 이름 (0x4fe9c — state+0x44/0x50/0x5c)', () => {
  it('내 결정 코드와 같은 줄에 내 이름이 서고, 측 2(없음)면 null 이다', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(20100901)), 4)
    const 이름 = pitchersOfRecordOf(끝, '나투수')
    const 코드 = summaryOf(끝).decisionCode
    if (코드 === 1) expect(이름.win).toBe('나투수')
    if (코드 === 2) expect(이름.loss).toBe('나투수')
    if (코드 === 3) expect(이름.save).toBe('나투수')
    expect(이름.win === null).toBe(끝.decision.winner.side === 2)
    expect(이름.loss === null).toBe(끝.decision.loser.side === 2)
  })
})

describe('투수 쪽 보정 0x34d6c — 공+0x10 (0x3de10) · 내 투수 보너스 (0xab214)', () => {
  const 마구 = { typeNumber: 22, courseCell: 4, gaugeCell: 0 }

  /** 타석이 이어지는 동안(사람 차례) 한 공을 던진다 — 인플레이면 수비까지 미리 돌린다 */
  const 한공 = (progress: PitcherGameProgress, input: typeof 마구, random: RandomPort) =>
    throwPitch(progress, input, random)

  it('마구를 던지면 공에 번호가 실리고, 그 뒤 직구에도 남는다 (되돌리는 곳이 없다)', () => {
    const random = 씨앗(3)
    let progress = startPitcherGame(기본옵션, random)
    expect(progress.ballMagicNumber).toBe(0)
    progress = 한공(progress, 한가운데직구, random)
    expect(progress.lastPitch?.magicNumber).toBe(0)
    // 내 투수 레코드 +0x18 은 늘 실린다 (이펙트·보정 쪽 판별)
    expect(progress.lastPitch?.pitcherMagicNumber).toBe(1)

    progress = 한공(progress, 마구, random)
    expect(progress.magicRemaining).toBe(3)
    expect(progress.ballMagicNumber).toBe(1)
    expect(progress.lastPitch?.magicNumber).toBe(1)

    progress = 한공(progress, 한가운데직구, random)
    expect(progress.lastPitch?.magicNumber).toBe(1)
  })

  it('마지막 한 번(남은 1 → 0)은 새로 싣지 않는다 — 소모 0x50e9c 가 0x3de10 보다 앞이다', () => {
    const random = 씨앗(3)
    let progress = startPitcherGame({ ...기본옵션, magicCount: 1 }, random)
    progress = 한공(progress, 마구, random)
    expect(progress.magicRemaining).toBe(0)
    expect(progress.ballMagicNumber).toBe(0)
    expect(progress.lastPitch?.magicNumber).toBe(0)
  })
})

describe('내가 던지는 타석의 CPU 대타 0xac228 — 0xf 진입 0x3d954 (3da44·3da70)', () => {
  /** 첫 타자 칸이 대타 조건(타석 2 · 안타 0 · 홈런 0)을 채운 경기 — 벤치 셋 */
  const 대타감 = (): PitcherGameProgress => {
    const 시작 = startPitcherGame(기본옵션, 씨앗(20100901))
    const records = [...시작.opponentLineup.records]
    records[시작.opponentOrderIndex % 9] = { hits: 0, homeRuns: 0, plateAppearances: 2 }
    return { ...시작, opponentLineup: { ...시작.opponentLineup, records } }
  }

  it('볼·스트라이크 뒤 0xf 진입마다 묻는다 — 카운트를 이어받고, 바뀌면 0xe(강판)·돌발을 다시 지난 뒤 막음 칸에서 멈춘다', () => {
    const 경기 = 대타감()
    expect(경기.opponentLineup.benchBatters).toBe(3)
    // 각본 0.7: 지켜본 스트라이크 → 마지막 굴림이 대타 rand(0,1000) = 700 (문턱 100 >> (0+1+1) = 25 에 못 미침)
    const 평소 = 각본난수(0.7)
    const 안바뀜 = startPitch(경기, 한가운데직구, 평소)
    expect(안바뀜.lastResolution).toEqual({ kind: '스트라이크', isSwinging: false })
    expect(안바뀜.log.some((entry) => entry.text.includes('대타'))).toBe(false)
    expect(안바뀜.pinchHitUsed).toBe(false)

    // 그 굴림만 0 으로 → 대타가 나온다. rand(0, 벤치 3) = 2 → 명단 칸 11
    const 대타각본 = 각본난수(0.7, 평소.calls() - 1, 0)
    const 바뀜 = startPitch(경기, 한가운데직구, 대타각본)
    const 칸 = 경기.opponentOrderIndex % 9
    expect(바뀜.log[0].text).toContain('CPU 대타')
    expect(바뀜.opponentLineup.rosterSlots[칸]).toBe(11)
    expect(바뀜.opponentLineup.benchBatters).toBe(2)
    // 들어온 선수는 빈 기록 · 막음 칸이 섰다 · 카운트(1 스트라이크)를 이어받는다
    expect(바뀜.opponentLineup.records[칸]).toEqual({ hits: 0, homeRuns: 0, plateAppearances: 0 })
    expect(바뀜.pinchHitUsed).toBe(true)
    expect(바뀜.atBat.strikes).toBe(1)
    // 사람 장면 대타라 "Time!"·등판음 신호가 선다 (안 바뀐 공은 그대로)
    expect(안바뀜.scenePinchHit).toBeNull()
    expect(바뀜.scenePinchHit).toEqual({ serial: 1, by: 'CPU', incomingIsAce: false })
    expect(isPitchTurn(바뀜)).toBe(true)
    // 대타 굴림 둘(rand(0,1000)·rand(0,벤치)) 뒤 0x16 → 0xd → 0xe(강판 판정)에 다시 서서 OK 를 기다린다
    expect(대타각본.calls()).toBeGreaterThanOrEqual(평소.calls() + 1)
    expect(바뀜.sceneConfirmPending).toBe(true)
    // OK 뒤 메시지 1 의 돌발 굴림이 한 번 더 돈다 — 두 번째 0xf 는 막음 칸이 서 있어 대타 굴림 없음
    const 대타뒤 = 대타각본.calls()
    const 확인 = confirmScene(바뀜, 대타각본)
    expect(대타각본.calls()).toBeGreaterThan(대타뒤)
    expect(확인.opponentLineup.benchBatters).toBe(2)
    expect(확인.sceneConfirmPending).toBe(false)

    // 다음 공이 나가면 0xa5e14 가 막음 칸을 내린다
    const 다음공 = startPitch(바뀜, 한가운데직구, 각본난수(0.7))
    expect(다음공.pinchHitUsed).toBe(false)
  })

  it('돌발이 진행 중이면 대타를 묻지도 않는다 (3da44 → 0x8eb94)', () => {
    const 경기 = 대타감()
    const 행 = BURST_TABLES.PITCHER[0]
    const 돌발중: PitcherGameProgress = {
      ...경기,
      burst: 경기.burst === null ? null : { ...경기.burst, current: 행, triggeredCount: 1 },
    }
    const 평소 = 각본난수(0.7)
    startPitch(경기, 한가운데직구, 평소)
    const 각본 = 각본난수(0.7, 평소.calls() - 1, 0)
    const 그대로 = startPitch(돌발중, 한가운데직구, 각본)
    expect(그대로.log.some((entry) => entry.text.includes('대타'))).toBe(false)
    // 대타 rand(0,1000) 한 번이 빠진다
    expect(각본.calls()).toBe(평소.calls() - 1)
  })

  it('명단 기록은 내가 던진 타석도 정산 0xa8024 처럼 쌓인다 — 타석 수 +0x14', () => {
    const 끝 = 끝까지던지기(startPitcherGame(기본옵션, 씨앗(3)), 3)
    const 타석합 = 끝.opponentLineup.records.reduce((sum, record) => sum + record.plateAppearances, 0)
    expect(타석합).toBeGreaterThan(20)
  })
})

describe('자동 타석(0x21)의 0xc1ba4 — 양 팀 마운드와 CPU 대타 (0xac228 → 0xac428)', () => {
  const 쉬는날 = { ...기본옵션, dayCounter: 3 }
  const 씨앗들 = Array.from({ length: 30 }, (_unused, index) => index + 1)

  it('선발이 아닌 날은 0↔k 맞바꾼 칸이 우리 선발이고, 경기 내내 양 팀 투수가 지치고 바뀐다 — CPU 는 나를 안 고른다', () => {
    let 우리교체 = 0
    let 상대교체 = 0
    for (const seed of 씨앗들) {
      const 끝 = startPitcherGame(쉬는날, 씨앗(seed))
      // 사람 장면이 하나도 없다 — 경기가 시작에서 끝난다
      expect(끝.game.isFinished).toBe(true)
      expect(끝.ourMound.pitcherSlot).not.toBe(MY_PITCHER_SLOT)
      expect(끝.ourMound.usedSlots).not.toContain(MY_PITCHER_SLOT)
      // 투구 수·소모는 마운드에 쌓인다 (교체되면 0 부터)
      expect(끝.ourMound.pitches + 끝.ourMound.usedSlots.length).toBeGreaterThan(0)
      if (끝.ourMound.usedSlots.length > 0) {
        우리교체 += 1
        // g = 3 → k = 2 가 선발 (0xa4f60)
        expect(끝.ourMound.usedSlots[0]).toBe(2)
      }
      if (끝.opponentMound.usedSlots.length > 0) 상대교체 += 1
    }
    expect(우리교체).toBeGreaterThan(0)
    expect(상대교체).toBeGreaterThan(0)
  })

  it('우리 공격 타석에도 CPU 대타가 나온다 — 벤치가 줄고 그 칸 동료 기록이 빈다', () => {
    let 대타경기 = 0
    for (const seed of 씨앗들) {
      const 끝 = startPitcherGame(쉬는날, 씨앗(seed))
      if (끝.ourLineup.benchBatters < 3) 대타경기 += 1
      expect(끝.ourLineup.rosterSlots.length).toBe(12 - (3 - 끝.ourLineup.benchBatters))
    }
    expect(대타경기).toBeGreaterThan(0)
  })

  it('구원은 8회에 벤치에서 올라온다 — 그 전 CPU 교체는 나를 고르지 않고, 올라오면 우리 마운드가 내가 된다', () => {
    for (const seed of 씨앗들) {
      const 등판 = startPitcherGame({ ...기본옵션, role: PITCHER_ROLE.relief }, 씨앗(seed))
      if (!등판.onMound) continue
      expect(등판.game.inning).toBe(8)
      expect(등판.ourMound.pitcherSlot).toBe(MY_PITCHER_SLOT)
      expect(등판.ourMound.usedSlots).not.toContain(MY_PITCHER_SLOT)
      // 오늘 로테이션 선발(g = 2 → 칸 2)이 맨 먼저 내려갔다
      expect(등판.ourMound.usedSlots[0]).toBe(2)
    }
  })

  it('강판(0xc1b48)은 강제 교체로 우리 CPU 투수를 올린다 — 나는 내려간 투수가 되고 다시 안 오른다', () => {
    const 시작 = startPitcherGame(기본옵션, 씨앗(20100901))
    expect(시작.ourMound.pitcherSlot).toBe(MY_PITCHER_SLOT)
    const 강판 = giveUpPitching(시작, 씨앗(5))
    expect(강판.onMound).toBe(false)
    expect(강판.game.isFinished).toBe(true)
    expect(강판.ourMound.pitcherSlot).not.toBe(MY_PITCHER_SLOT)
    expect(강판.ourMound.usedSlots[0]).toBe(MY_PITCHER_SLOT)
    expect(강판.ourMound.usedSlots.filter((slot) => slot === MY_PITCHER_SLOT)).toHaveLength(1)
  })

  it('강제 교체의 새 투수는 0xabfcc 의 중간계투(로스터 칸 4~6, 가득 동률 → 앞 칸 4)다 — 벤치에 마선수가 없어 마무리 굴림 0xac360 을 안 굴린다 (0xb8a8d)', () => {
    const 시작 = startPitcherGame(기본옵션, 씨앗(20100901))
    /** 첫 굴림만 고정, 나머지는 씨앗 */
    const 첫굴림 = (value: number) => {
      const rest = 씨앗(5)
      const 고정 = createConstantRandom(value)
      let 번 = 0
      const 이번 = (): RandomPort => (번++ === 0 ? 고정 : rest)
      return { rand: (lo: number, hi: number) => 이번().rand(lo, hi), rand9d: (n: number) => (n <= 0 ? 0 : 이번().rand9d(n)) }
    }
    const 첫구원 = (progress: PitcherGameProgress) => progress.ourMound.usedSlots[1] ?? progress.ourMound.pitcherSlot
    // 선발 날 목록 [나, 1, …, 7, 0] — 벤치 [1, …, 7, 0]
    // 굴렸다면 첫 굴림 0 이 벤치 마지막(0)을 올렸을 자리다 — 굴림과 무관하게 4
    // (0xabfcc 차례 [중간 1, 마무리 2, 선발 0] — 보직은 로스터 칸 표 `rosterPitcherRoleOf`)
    expect(첫구원(giveUpPitching(시작, 첫굴림(0.99)))).toBe(4)
    expect(첫구원(giveUpPitching(시작, 첫굴림(0)))).toBe(4)
  })
})

describe('CPU 도루 0x520de · 공 도착 판 0x3dfac — 투수편은 늘 CPU 공격', () => {
  const 가운데직구 = { typeNumber: 1, courseCell: 4, gaugeCell: 0 }

  it('1루 주자가 있으면 타자 결정 앞에서 굴린다 — 못 맞힌 공이면 도루 판(종류 5)이 열리고, 1루 도루는 늘 세이프', () => {
    let opened = 0
    for (let seed = 601; seed <= 1000; seed += 1) {
      const progress = startPitcherGame(기본옵션, 씨앗(1))
      const 일루 = { ...progress, game: { ...progress.game, bases: { first: true, second: false, third: false } } }
      const 끝 = startPitch(일루, 가운데직구, 씨앗(seed))
      const play = 끝.lastArrivalPlay
      if (play?.kind !== 5) continue
      opened += 1
      expect(play.result.caughtFrom).toEqual([])
      expect(끝.lastDefensePlay).toBe(play.result)
      expect(끝.stealingFrom).toEqual([])
      // 8(도루)은 공격 계열이라 사람 수비 게이트(0xa77f0)에서 버려진다
      expect(끝.recordIds).toEqual(일루.recordIds)
      // 타석은 이어진다 — 타순이 안 돈다
      if (끝.atBat.outcome === null && 끝.game.half === 일루.game.half) {
        expect(끝.opponentOrderIndex).toBe(일루.opponentOrderIndex)
        expect(끝.game.bases.second).toBe(true)
      }
    }
    expect(opened).toBeGreaterThan(0)
  })

  it('화면이 도는 갈래(`live`)는 도루 판을 붙든다(송구 키 +0x160) — 키 없이 끝내면 미리 돌린 판과 경기 · 굴림 차례가 같다', () => {
    let deferred = 0
    for (let seed = 601; seed <= 1000; seed += 1) {
      const progress = startPitcherGame(기본옵션, 씨앗(1))
      const 일루 = { ...progress, game: { ...progress.game, bases: { first: true, second: false, third: false } } }
      const 미리Random = 씨앗(seed)
      const 미리 = startPitch(일루, 가운데직구, 미리Random)
      const 실시간Random = 씨앗(seed)
      const 붙듦 = startPitch(일루, 가운데직구, 실시간Random, true)
      const pending = 붙듦.pendingRunnerPlay
      if (pending == null) continue
      deferred += 1
      expect(isPitchTurn(붙듦)).toBe(false)
      const 끝 = resolveRunnerPlay(붙듦, runLiveRunnerPlayWithoutKeys(pending), 실시간Random)
      expect(끝.pendingRunnerPlay ?? null).toBeNull()
      expect(끝.game).toEqual(미리.game)
      expect(끝.recordIds).toEqual(미리.recordIds)
      // 실시간으로 본 판은 재생 칸에 다시 안 넣는다
      expect(끝.lastDefensePlay).toBe(일루.lastDefensePlay)
      expect(실시간Random.rand(0, 10_000)).toBe(미리Random.rand(0, 10_000))
    }
    expect(deferred).toBeGreaterThan(0)
  })

  it('견제도 화면이 도는 갈래는 판을 붙든다 — 키 없이 끝내면 미리 돌린 견제와 같다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 일루 = { ...progress, game: { ...progress.game, bases: { first: true, second: false, third: false } } }
    expect(isPitchTurn(일루) && 일루.atBatPrepared).toBe(true)
    const 미리Random = 씨앗(5)
    const 미리 = pickoff(일루, '3', 미리Random)
    const 실시간Random = 씨앗(5)
    const 붙듦 = pickoff(일루, '3', 실시간Random, true)
    expect(붙듦.pendingRunnerPlay?.kind).toBe('pickoff')
    const pending = 붙듦.pendingRunnerPlay
    if (pending == null) return
    const 끝 = resolveRunnerPlay(붙듦, runLiveRunnerPlayWithoutKeys(pending), 실시간Random)
    expect(끝.game).toEqual(미리.game)
    expect(실시간Random.rand(0, 10_000)).toBe(미리Random.rand(0, 10_000))
  })

  it('주자가 없으면 CPU 도루 굴림이 없다 — 못 맞힌 공은 0.1% 굴림(0x35034) 하나만 더 쓴다', () => {
    const progress = startPitcherGame(기본옵션, 씨앗(1))
    const 끝 = startPitch(progress, 가운데직구, 씨앗(3))
    expect(끝.lastArrivalPlay).toBeNull()
  })
})

describe('경기 시작 — 상태 9 갱신 0x3f584 의 시뮬 초기화 0xc0dac (0x3fa0e)', () => {
  it('startPitcherGame 의 첫 굴림은 rand(0, 2) 다 — 판·간이 타석보다 앞', () => {
    const inner = createSeededRandom(7)
    const ranges: (readonly [number, number])[] = []
    const random: RandomPort = {
      rand: (lo, hi) => {
        ranges.push([lo, hi])
        return inner.rand(lo, hi)
      },
      rand9d: (n) => inner.rand9d(n),
    }
    startPitcherGame(기본옵션, random)
    // 앞은 장면 덱 섞기(0x3e340 → 0xb08e8) · 효과 객체(3ef6e, 1202) — 그 바로 다음 굴림이 시뮬 초기화다
    const 장면덱굴림 =
      Object.values(BATTED_BALL_PATTERNS).reduce((sum, patterns) => sum + patterns.length, 0) + SCENE_EFFECT_INIT_ROLL_COUNT
    expect(ranges[장면덱굴림]).toEqual([0, 2])
  })
})

describe('상태 0xe 의 OK 대기 — 내가 던지는 타석마다 (0x39e14 → 0x532b0)', () => {
  it('첫 타석 앞에 대기가 서고, 다음 타자 타석은 새 대기다. 감독 강판(0x23)이면 대기를 안 바꾼다', () => {
    const random = 씨앗(20100901)
    let progress = startPitcherGame(기본옵션, random)
    expect(isPitchTurn(progress)).toBe(true)
    expect(progress.sceneConfirm?.entries).toBeGreaterThanOrEqual(1)
    for (let step = 0; step < 400 && !progress.game.isFinished && isPitchTurn(progress); step += 1) {
      const before = progress
      progress = throwPitch(progress, { typeNumber: 1, courseCell: 4, gaugeCell: 0 }, random)
      if (progress.managerHookText !== null) {
        expect(progress.sceneConfirm).toBe(before.sceneConfirm)
        break
      }
      const 새타석 = progress.opponentOrderIndex !== before.opponentOrderIndex || progress.game.half !== before.game.half
      if (새타석 && isPitchTurn(progress)) expect(progress.sceneConfirm).not.toBe(before.sceneConfirm)
    }
  })
})

describe('파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)', () => {
  /** 씨앗들을 돌며 파울 판(타석이 안 끝난 채 붙들린 판)을 모은다 */
  function 파울판들() {
    const 판들: { 직전: ReturnType<typeof startPitcherGame>; 진행중: ReturnType<typeof startPitcherGame>; random: RandomPort }[] = []
    for (let seed = 1; seed <= 12; seed += 1) {
      const random = 씨앗(seed)
      let current = startPitcherGame(기본옵션, random)
      for (let pitch = 0; pitch < 200 && isPitchTurn(current); pitch += 1) {
        const next = startPitch(current, 한가운데직구, random)
        if (next.pendingDefensePlay !== null) {
          if (next.atBat.outcome === null) 판들.push({ 직전: current, 진행중: next, random })
          current = resolveDefensePlay(next, runDefensePlay(next.pendingDefensePlay), random)
          continue
        }
        current = next
      }
    }
    return 판들
  }

  it('파울 판은 타석을 끝내지 않고 붙든다 — 판 입력에 이 공 앞의 스트라이크가 실린다', () => {
    const 판들 = 파울판들()
    expect(판들.length).toBeGreaterThan(0)
    for (const { 직전, 진행중 } of 판들) {
      expect(isPitchTurn(진행중)).toBe(false)
      expect(진행중.atBat).toEqual(직전.atBat)
      expect(진행중.pendingDefensePlay!.strikes).toBe(직전.atBat.strikes)
    }
  })

  it('판이 파울로 닫히면 스트라이크 ≤ 1 일 때만 +1 · 같은 타자 · 판 앞 루 그대로, 잡히면 파울 뜬공 아웃으로 타석이 끝난다', () => {
    let 파울 = 0
    let 뜬공아웃 = 0
    for (const { 직전, 진행중, random } of 파울판들()) {
      const 판 = runDefensePlay(진행중.pendingDefensePlay!)
      const 끝 = resolveDefensePlay(진행중, 판, random)
      expect(끝.pendingDefensePlay).toBeNull()
      if (판.foulEnded === true) {
        파울 += 1
        expect(판.outcome).toBeUndefined()
        expect(판.advance).toEqual({ bases: 직전.game.bases, runsScored: 0, outsAdded: 0 })
        expect(끝.atBat.strikes).toBe(Math.min(직전.atBat.strikes + 1, 2))
        expect(끝.opponentOrderIndex).toBe(직전.opponentOrderIndex)
      } else {
        // 파울 각 공을 낙구 전에 잡았거나(뜬공 아웃), 필살수비가 열려 페어 각 표시 패턴으로 바꿔 쐈다(0xb097c · 0xb09ac) —
        // 어느 쪽이든 판 끝 정산 결과로 타석이 끝난다
        if (판.caughtOnTheFly) {
          뜬공아웃 += 1
          // 태그업 득점이 난 뜬공 아웃은 정산 a882e(득점 > 0 && 아웃 > 0 && 안타 아님)가 타수를 안 센다
          expect(판.outcome).toEqual(
            판.advance.runsScored > 0
              ? { kind: '아웃', detail: '뜬공아웃', noAtBat: true }
              : { kind: '아웃', detail: '뜬공아웃' },
          )
        } else {
          expect(판.specialDefense.jumpUnlocked || 판.specialDefense.slideUnlocked).toBe(true)
        }
        expect(판.outcome).toBeDefined()
        // 다음 타자로 넘어간다
        expect(끝.opponentOrderIndex).not.toBe(직전.opponentOrderIndex)
      }
    }
    expect(파울).toBeGreaterThan(0)
    expect(뜬공아웃).toBeGreaterThan(0)
  })
})
