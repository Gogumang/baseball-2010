// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  missionBatterSpecialSwingRemainingOf,
  missionOpponentAbility,
  missionOpponentSpecialSwingOf,
  missionPitcherAbility,
  useMissionSession,
} from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf, EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { isModeMagicPitchType, modePitchMenuOf, modePitcherOf } from '@/app/model/modePitcher'
import type { ModePitcher } from '@/app/model/modePitcher'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 이벤트 112 의 match 명령이 여는 마선수 대결 — 이기면 114, 지면 115 로 돌아가야 한다.
 * 브라우저에서 승리 타구를 맞히기 어려워 이 경로만 훅 수준에서 끝까지 돌린다.
 */

const SIKER_TEAM = 16
const WIN_EVENT_ID = 114
const LOSE_EVENT_ID = 115

function setUpSession() {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const random = createSeededRandom(1)
  let screen: Screen = { kind: '관리' }
  const setScreen = vi.fn((next: Screen) => {
    screen = next
  })

  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return {
      runner,
      session: useMissionSession({ runner, random, missionRecord, screen, setScreen }),
    }
  })

  return { rendered, setScreen, screenNow: () => screen }
}

/** 대결을 시작하고 타구 하나로 끝낸다 */
function playAceMatch(hit: boolean) {
  const { rendered, screenNow } = setUpSession()
  const mission = aceMatchMissionOf(SIKER_TEAM)
  if (mission === null) throw new Error('싸이커 공략 레코드가 없다')

  act(() => {
    rendered.result.current.session.actions.beginAceMatch(mission, {
      resultEvents: [WIN_EVENT_ID, LOSE_EVENT_ID],
      context: '장소',
      carried: { ...EMPTY_STORY_CARRY, viewedEventIds: [112] },
    })
  })
  const afterStart = screenNow()

  act(() => {
    rendered.result.current.session.handleMissionPitch({
      resolution: hit ? { kind: '타구', outcome: { kind: '안타', bases: 1 } } : { kind: '스트라이크', isSwinging: true },
      hasSwung: true,
      isBunt: false,
      resultCode: null,
    })
  })
  // 인플레이 타구는 수비 화면(상태 0x17)이 돌고 나서야 결과가 반영된다 — 화면 대신 여기서 끝낸다
  if (rendered.result.current.session.pendingDefensePlay !== null) {
    act(() => {
      rendered.result.current.session.actions.finishDefensePlay()
    })
  }
  // 삼진은 세 번 휘둘러야 난다 — 안타가 아니면 두 번 더 채운다
  if (!hit) {
    for (let count = 0; count < 2; count += 1) {
      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '스트라이크', isSwinging: true },
          hasSwung: true,
          isBunt: false,
          resultCode: null,
        })
      })
    }
  }
  const status = rendered.result.current.session.missionRun?.status

  act(() => {
    rendered.result.current.session.actions.finishAceMatch()
  })

  rendered.unmount()
  return { afterStart, status, afterFinish: screenNow() }
}

describe('마선수 대결 화면 전환', () => {
  it('match 명령을 받으면 공략 레코드로 대결 화면을 연다', () => {
    const { afterStart } = playAceMatch(true)

    expect(afterStart).toMatchObject({ kind: '마선수대결', resultEvents: [WIN_EVENT_ID, LOSE_EVENT_ID], context: '장소' })
  })

  it('안타를 치면 승리 이벤트 114 로 돌아가고, 대결 전 기록을 함께 들고 간다', () => {
    const { status, afterFinish } = playAceMatch(true)

    expect(status, `대결 결과가 성공이 아니다: ${status}`).toBe('성공')
    expect(afterFinish).toMatchObject({ kind: '이벤트', eventId: WIN_EVENT_ID, context: '장소' })
    expect(afterFinish.kind === '이벤트' ? afterFinish.carried?.viewedEventIds : null).toEqual([112])
  })

  it('삼진이면 패배 이벤트 115 로 돌아간다 — 승리 경로와 같은 번호로 새지 않는다', () => {
    const { status, afterFinish } = playAceMatch(false)

    expect(status, `대결 결과가 실패가 아니다: ${status}`).toBe('실패')
    expect(afterFinish).toMatchObject({ kind: '이벤트', eventId: LOSE_EVENT_ID })
  })
})

/* ── ㉠ 투수 미션 조준 흔들림 (0x39c5c) ───────────────────────────────────────── */

/** 뽑은 횟수를 세는 난수. 값은 늘 0 이라 뽑는 **차례**만 달라진다 */
function countingRandom() {
  let draws = 0
  const port: RandomPort = {
    next: () => {
      draws += 1
      return 0
    },
    nextInRange: (minimum: number) => {
      draws += 1
      return minimum
    },
    pick: <T,>(candidates: readonly T[]) => {
      draws += 1
      return candidates[0] as T
    },
  }
  return { port, drawn: () => draws }
}

/**
 * 투수 미션 하나를 열고 한가운데(칸 4)로 공 하나를 던져, 그동안 뽑은 난수 수를 센다.
 * 게이지는 **누른 칸** 으로 넘긴다 — 칸 9 가 등급 t=5(최상)다 (0x50e08 `t = max(g−4, 1)`).
 */
function drawsOfOnePitch(missionId: number, gaugeCell = 9, gaugeSettingOn = true, pitcher?: ModePitcher) {
  const counter = countingRandom()
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  let screen: Screen = { kind: '미션선택' }
  const setScreen = vi.fn((next: Screen) => {
    screen = next
  })
  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return {
      runner,
      session: useMissionSession({ runner, random: counter.port, missionRecord, screen, setScreen, pitcher }),
    }
  })

  const mission = MISSIONS.find((row) => row.side === '투수' && row.id === missionId)
  if (mission === undefined) throw new Error(`투수 미션 ${missionId} 이 없다`)
  act(() => {
    rendered.result.current.session.actions.begin(mission)
  })
  const before = counter.drawn()
  act(() => {
    rendered.result.current.session.handleThrow(PITCH_TYPES[0], 4, gaugeCell, gaugeSettingOn)
  })
  const drawn = counter.drawn() - before
  const banner = rendered.result.current.runner.bannerText
  const maxGauges = rendered.result.current.session.pitcherRun?.perfectGauges ?? 0
  rendered.unmount()
  return { drawn, banner, maxGauges }
}

describe('투수 미션 조준 흔들림 — 레코드 바이트 13 → 0x39c5c', () => {
  /**
   * 원본 0x39c5c 는 경기 상태 0x10(조준) 갱신이고 `[+0x1788] != 0 && [+0x1104] == 5`
   * (미션 객체가 있고 모드 5 = 투수 미션)일 때만 조건코드 갈래로 간다. 그래서 조건코드가 0 인
   * 미션 둘은 난수를 똑같이 쓰고, 조건코드가 3 인 미션만 흔들림 굴림이 더 붙는다.
   */
  it('조건코드가 0 인 투수 미션 둘은 공 하나에 난수를 똑같이 쓴다', () => {
    expect(drawsOfOnePitch(1)).toEqual(drawsOfOnePitch(2))
  })

  /**
   * 난수를 늘 0 으로 두면 조건코드 3 은 `rand(0,100)=0 <= 50` 이라 반드시 텔레포트하고,
   * 존 중심 −600 자리로 날아간다. 같은 입력인데 조건코드 0 은 "안타"(난수 14번), 조건코드 3 은
   * "헛스윙"(난수 13번)이 나왔다 — 흔들림이 실제로 조준점을 옮겼다는 뜻이다.
   */
  it('조건코드 3("난공불락의 철벽마무리")은 한가운데를 노려도 공이 딴 데로 간다', () => {
    expect(drawsOfOnePitch(10)).not.toEqual(drawsOfOnePitch(1))
  })
})

/* ── ㉠-2 투구 게이지는 칸 번호를 그대로 받는다 (0x50e08) ───────────────────── */

describe('투수 미션 투구 게이지 — 누른 칸 g 를 그대로 받는다', () => {
  /**
   * 원본 누름 0x50e08~0x50e34: `g 가 1~9 가 아니면 무시` → `t = max(g − 4, 1)`.
   * 칸 9 만 최상 t=5 이고, 칸 8 은 t=4 다 (화면에서는 둘이 같은 그림이다 — S5 U-15 4절).
   * "MAX게이지" 는 t=5 로 던진 공만 센다 (0xa5e00, S5 5절).
   */
  it('칸 9 만 MAX게이지로 센다 — 칸 8·7·1 은 안 센다', () => {
    expect(drawsOfOnePitch(1, 9).maxGauges).toBe(1)
    expect(drawsOfOnePitch(1, 8).maxGauges).toBe(0)
    expect(drawsOfOnePitch(1, 7).maxGauges).toBe(0)
    expect(drawsOfOnePitch(1, 1).maxGauges).toBe(0)
  })

  /** 칸이 1~9 밖이면 원본이 그냥 무시한다 = 안 누른 것과 같다 (0x50e1e `cmp r3,#8; bls`) */
  it('칸 0 과 칸 10 이상은 무시한다 — 안 누른 것과 같다', () => {
    expect(drawsOfOnePitch(1, 0).maxGauges).toBe(0)
    expect(drawsOfOnePitch(1, 12).maxGauges).toBe(0)
  })

  /**
   * ⚠️ **난수 차례가 게이지 칸으로 바뀌면 안 된다.** 게이지를 쓰는 공은 등급을 칸에서 바로
   * 뽑으므로 굴림이 하나도 안 붙고(0x50e2a), 게이지를 끈 공만 제구·체력 표 0xd896c 굴림이
   * 하나 더 붙는다 (0x4dbac → 0xb74bc).
   */
  it('게이지 칸이 달라져도 난수 차례는 같고, 게이지를 끄면 딱 한 번 더 뽑는다', () => {
    // 등급이 바뀌면 판정 값이 바뀌어 타구 결과(그 뒤 굴림 수)가 갈릴 수 있다 — 칸 9(t=5)는 비트7 투수 +100 ·
    // 수비 사람 −10(모드 5, 16897fc)을 실은 뒤 아웃이 난다. 그래서 **같은 결과가 난 칸끼리** 굴림 수를 견준다
    const 칸별 = [1, 5, 7, 8, 9, 0, 12].map((cell) => drawsOfOnePitch(1, cell))
    const 결과별 = new Map<string, Set<number>>()
    for (const { banner, drawn } of 칸별) 결과별.set(banner, (결과별.get(banner) ?? new Set()).add(drawn))
    for (const [banner, draws] of 결과별) {
      expect(draws.size, `${banner} 칸마다 난수 차례가 다르다: ${[...draws].join(',')}`).toBe(1)
    }
    const 끔 = drawsOfOnePitch(1, 0, false)
    const 같은결과 = 칸별.find((pitch) => pitch.banner === 끔.banner)
    expect(같은결과).toBeDefined()
    expect(끔.drawn).toBe(같은결과!.drawn + 1)
  })
})

/* ── ㉡ 미션 인플레이 타구 → 수비 화면(상태 0x17) ────────────────────────────── */

function setUpBatterMission(missionId: number) {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const random = createSeededRandom(7)
  let screen: Screen = { kind: '미션선택' }
  const setScreen = vi.fn((next: Screen) => {
    screen = next
  })
  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return {
      runner,
      session: useMissionSession({ runner, random, missionRecord, screen, setScreen }),
    }
  })
  const mission = MISSIONS.find((row) => row.side === '타자' && row.id === missionId)
  if (mission === undefined) throw new Error(`타자 미션 ${missionId} 이 없다`)
  act(() => {
    rendered.result.current.session.actions.begin(mission)
  })
  return rendered
}

describe('미션 인플레이 타구는 수비 화면을 거친다 — 0x13 → 0x17 (R10 8절)', () => {
  /**
   * 원본 미션은 모드 5·6 짜리 **보통 경기**(장면 0x104)다. 상태 전이표가 모드를 가르지 않아
   * 맞은 공은 0x11 → 메시지 0x6aa → 0x13 → **늘 0x17**(`0xae5f0` = `movs r0,#0x17; bx lr`)로 가고,
   * 0x17 이 끝나야 `0xae3e8` 이 다음 타석으로 보낸다. 홈런더비(모드 7)만 예외 갈래가 있다.
   */
  it('안타는 수비 화면이 끝나기 전까지 목표를 올리지 않는다', () => {
    const rendered = setUpBatterMission(1)

    act(() => {
      rendered.result.current.session.handleMissionPitch({
        resolution: { kind: '타구', outcome: { kind: '안타', bases: 1 } },
        hasSwung: true,
        isBunt: false,
        resultCode: null,
      })
    })

    expect(rendered.result.current.session.pendingDefensePlay).not.toBeNull()
    expect(rendered.result.current.session.missionRun?.progress.counts['안타'] ?? 0).toBe(0)

    act(() => {
      rendered.result.current.session.actions.finishDefensePlay()
    })

    expect(rendered.result.current.session.pendingDefensePlay).toBeNull()
    expect(rendered.result.current.session.missionRun?.progress.counts['안타']).toBe(1)
    rendered.unmount()
  })

  it('삼진은 수비가 개입할 것이 없어 그 자리에서 끝난다', () => {
    const rendered = setUpBatterMission(1)

    for (let count = 0; count < 3; count += 1) {
      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '스트라이크', isSwinging: true },
          hasSwung: true,
          isBunt: false,
          resultCode: null,
        })
      })
    }

    expect(rendered.result.current.session.pendingDefensePlay).toBeNull()
    expect(rendered.result.current.session.missionRun?.outs).toBe(2)
    rendered.unmount()
  })
})

describe('미션 마선수의 레벨 배율 0xd88aa (0xb6414)', () => {
  const 로제미션 = MISSIONS.find((mission) => mission.side === '투수' && mission.opponentAce === 3)
  const 레오니미션 = MISSIONS.find((mission) => mission.side === '타자' && mission.opponentAce === 2)

  it('투수 미션 마타자(로제, 칸 7)는 레벨이 없으면 Lv1 = 60% 를 먹는다', () => {
    if (로제미션 === undefined) throw new Error('로제 미션이 없다')
    expect(missionOpponentAbility(로제미션)).toEqual({ hit: 348, power: 510, run: 192, defense: 360 })
    expect(missionOpponentAbility(로제미션, { 7: 4 })).toEqual({ hit: 580, power: 850, run: 320, defense: 600 })
    // 다른 칸(마투수 2) 레벨은 상관없다
    expect(missionOpponentAbility(로제미션, { 2: 4 })).toEqual({ hit: 348, power: 510, run: 192, defense: 360 })
  })

  it('타자 미션 마투수(레오니, 칸 1)도 같은 배율을 먹은 뒤 투구 엔진 눈금으로 줄인다', () => {
    if (레오니미션 === undefined) throw new Error('레오니 미션이 없다')
    // 레오니 580·850·580 → 60% = 348·510·348 → /10 반올림
    expect(missionPitcherAbility(레오니미션)).toMatchObject({ control: 35, velocity: 51, breaking: 35 })
    expect(missionPitcherAbility(레오니미션, { 1: 4 })).toMatchObject({ control: 58, velocity: 85, breaking: 58 })
  })

  it('마선수가 아닌 미션은 배율이 없다', () => {
    const 일반 = MISSIONS.find((mission) => mission.opponentAce === 0)
    if (일반 === undefined) throw new Error('일반 미션이 없다')
    expect(missionOpponentAbility(일반)).toBeNull()
  })
})

describe('타자 미션 CPU 견제 — 0x345fc 종류 4 → 0x34848 → 0x50f28 (모드 6 에도 갈림 없음)', () => {
  it('주자 있는 루면 견제 판을 돌려 진루·아웃을 먹이고 재생할 판을 남긴다 — 타석·볼카운트는 그대로', () => {
    const rendered = setUpBatterMission(1) // 1사 3루
    const before = rendered.result.current.session.missionRun!
    // 세션 난수(씨앗 7)는 시작에서 안 쓰인다 — 같은 씨앗으로 같은 판을 돌린 값과 같아야 한다
    const expected = runPickoffPlay({
      targetBase: 3,
      bases: before.bases,
      outs: before.outs,
      random: createSeededRandom(7),
      offenseIsCpu: false,
    })

    act(() => {
      rendered.result.current.session.actions.cpuPickoff(3)
    })

    const after = rendered.result.current.session.missionRun!
    expect(rendered.result.current.session.pickoffReplay?.advance).toEqual(expected.advance)
    expect(after.outs).toBe(before.outs + expected.advance.outsAdded)
    expect(after.remainingPlateAppearances).toBe(before.remainingPlateAppearances)
    expect(after.progress).toBe(before.progress)
    expect(rendered.result.current.runner.atBat.balls).toBe(0)

    act(() => {
      rendered.result.current.session.actions.finishPickoffReplay()
    })
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
    rendered.unmount()
  })

  it('빈 루면 아무 일도 없다 (0x34848 은 주자 있는 루만 고른다)', () => {
    const rendered = setUpBatterMission(1)
    const before = rendered.result.current.session.missionRun

    act(() => {
      rendered.result.current.session.actions.cpuPickoff(1)
    })

    expect(rendered.result.current.session.missionRun).toBe(before)
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
    rendered.unmount()
  })
})

/* ── 투수 미션 투수 = 나리 투수편 저장 (0x213c0 5→3 · 0x1fbd0) ───────────────── */

describe('투수 미션 투수는 투수편 커리어의 0xb6414 값으로 던진다 (`modePitcherOf`)', () => {
  const 강투수 = modePitcherOf({
    ...createPitcherCareer('테스트'),
    ability: { control: 900, velocity: 900, breaking: 900, stamina: 900 },
    skillIds: [16, 17, 22],
    equippedSkillIds: [16, 17, 22],
  })

  it('세션이 넘겨받은 투수를 그대로 내놓는다 — 안 넘기면 신인 투수', () => {
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    const screen: Screen = { kind: '미션선택' }
    const rendered = renderHook(() =>
      useMissionSession({
        runner: useAtBatRunner(), random: createSeededRandom(1), missionRecord, screen, setScreen: vi.fn(),
        pitcher: 강투수,
      }),
    )
    expect(rendered.result.current.pitcher).toBe(강투수)
    const bare = renderHook(() =>
      useMissionSession({
        runner: useAtBatRunner(), random: createSeededRandom(1), missionRecord, screen, setScreen: vi.fn(),
      }),
    )
    expect(bare.result.current.pitcher).toEqual(modePitcherOf(null))
  })

  /** 실투 0x33cbc 는 구속·스킬이 확률 p 만 바꾸고 rand(0,100) 은 늘 한 번이다 — 난수 차례는 투수와 무관 */
  it('투수가 바뀌어도 공 하나의 난수 수는 같다', () => {
    expect(drawsOfOnePitch(1, 9, true, 강투수).drawn).toBe(drawsOfOnePitch(1, 9, true).drawn)
    expect(drawsOfOnePitch(1, 0, false, 강투수).drawn).toBe(drawsOfOnePitch(1, 0, false).drawn)
  })
})

/* ── 투수 미션 사구 뒤 벤치 클리어링 연출 (상태 0x1e) ───────────────────────────── */

/** 씨앗 난수를 감싸 뽑은 수를 센다 */
function countedSeeded(seed: number) {
  const inner = createSeededRandom(seed)
  let draws = 0
  const port: RandomPort = {
    next: () => {
      draws += 1
      return inner.next()
    },
    nextInRange: (minimum: number, maximum: number) => {
      draws += 1
      return inner.nextInRange(minimum, maximum)
    },
    pick: <T,>(candidates: readonly T[]) => {
      draws += 1
      return inner.pick(candidates)
    },
  }
  return { port, drawn: () => draws }
}

const CORNER_CELLS = [0, 2, 6, 8, 3, 5]

/** 씨앗을 넘겨 가며 투수 미션 1 에 공을 던지다 벤치 클리어링에 들어간 자리를 찾는다 */
function sessionInBenchClearing() {
  const mission = MISSIONS.find((row) => row.side === '투수' && row.id === 1)
  if (mission === undefined) throw new Error('투수 미션 1 이 없다')
  for (let seed = 1; seed < 400; seed += 1) {
    const counter = countedSeeded(seed)
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    let screen: Screen = { kind: '미션선택' }
    const setScreen = vi.fn((next: Screen) => {
      screen = next
    })
    const rendered = renderHook(() =>
      useMissionSession({ runner: useAtBatRunner(), random: counter.port, missionRecord, screen, setScreen }),
    )
    act(() => rendered.result.current.actions.begin(mission))
    for (let pitch = 0; pitch < 60; pitch += 1) {
      // 인플레이 타구(수비 화면)나 미션 끝이면 같은 미션을 다시 세운다
      if (rendered.result.current.pitcherRun?.status !== '진행중' || rendered.result.current.pendingDefensePlay !== null) {
        act(() => rendered.result.current.actions.begin(mission))
      }
      const current = rendered.result.current
      const before = counter.drawn()
      // 구석 칸들을 돌려 가며 게이지 없이 — 사구가 나올 만한 자리
      act(() => current.handleThrow(PITCH_TYPES[0], CORNER_CELLS[pitch % CORNER_CELLS.length], 0, false))
      if (rendered.result.current.pendingBenchClearing !== null) {
        return { rendered, counter, drawnByThrow: counter.drawn() - before }
      }
    }
    rendered.unmount()
  }
  throw new Error('벤치 클리어링에 들어가는 씨앗을 못 찾았다')
}

describe('투수 미션 사구 뒤 벤치 클리어링 — 0x4e72c → 0x1e 는 모드를 안 가른다 (홈런더비만 제외)', () => {
  it('들어가면 사구를 붙들고 다음 공을 막는다 — 연출이 끝나야 사구가 먹힌다', () => {
    const { rendered } = sessionInBenchClearing()
    const held = rendered.result.current
    expect(held.pendingBenchClearing?.outcome.kind).toBe('사구')
    const run = held.pitcherRun
    act(() => held.handleThrow(PITCH_TYPES[0], 4, 0, false))
    expect(rendered.result.current.pitcherRun).toBe(run)

    act(() => rendered.result.current.actions.finishBenchClearing(false))
    expect(rendered.result.current.pendingBenchClearing).toBeNull()
  })

  /** 출구에서 틱 10(0x401d4)에 닿았으면 수비 목표 굴림 8 번이 더 나간다 */
  it('틱 10 에 닿고 끝나면 건너뛴 것보다 난수를 8 번 더 쓴다', () => {
    const skipped = sessionInBenchClearing()
    const beforeSkip = skipped.counter.drawn()
    act(() => skipped.rendered.result.current.actions.finishBenchClearing(false))
    const skipDraws = skipped.counter.drawn() - beforeSkip

    const watched = sessionInBenchClearing()
    const beforeWatch = watched.counter.drawn()
    act(() => watched.rendered.result.current.actions.finishBenchClearing(true))
    expect(watched.counter.drawn() - beforeWatch).toBe(skipDraws + 8)
    // 진입 0x3a5f0 의 45 번은 던지는 순간 이미 나갔다
    expect(watched.drawnByThrow).toBeGreaterThanOrEqual(45 + 1)
  })
})

/* ── 필살타법 남은 횟수 (0xaebe4 · 0x4e136) ─────────────────────────────────── */

describe('미션의 필살 남은 칸 — 0xaebe4 가 채우고 0x4e136 이 줄인다', () => {
  const 미션 = (id: number, side: '투수' | '타자') => {
    const found = MISSIONS.find((row) => row.id === id && row.side === side)
    if (found === undefined) throw new Error(`미션 ${id} 없음`)
    return found
  }

  it('타자 미션의 내 타자는 u8 0xd84f0[번호] — 무자비(23) 장착이면 +1, 번호 0 이면 0', () => {
    expect(missionBatterSpecialSwingRemainingOf(-1, { specialSwingNumber: 0, skillIds: [23] })).toBe(0)
    expect(missionBatterSpecialSwingRemainingOf(-1, { specialSwingNumber: 1, skillIds: [] })).toBe(2)
    expect(missionBatterSpecialSwingRemainingOf(-1, { specialSwingNumber: 4, skillIds: [23] })).toBe(6)
    // 한 번 채운(또는 줄인) 값은 그대로 쓴다
    expect(missionBatterSpecialSwingRemainingOf(1, { specialSwingNumber: 4, skillIds: [23] })).toBe(1)
  })

  it('투수 미션 상대 마타자는 번호 = 순번 + 5 · 횟수 0xd84fa[mgr[0x13f + 순번]]', () => {
    // 미션 4 의 상대는 마타자 순번 3 (1부터) → 번호 7 · 칸 5 + 2 = 7
    expect(missionOpponentSpecialSwingOf(미션(4, '투수'), -1)).toEqual({ swingNumber: 7, remaining: 2, aceOrder: 2, aceLevel: 0 })
    expect(missionOpponentSpecialSwingOf(미션(4, '투수'), -1, { 7: 4 })).toEqual({
      swingNumber: 7,
      remaining: 5,
      aceOrder: 2,
      aceLevel: 4,
    })
    expect(missionOpponentSpecialSwingOf(미션(4, '투수'), 0)?.remaining).toBe(0)
  })

  it('일반 타자가 상대인 투수 미션은 필살이 없다 (CPU 일반 타자는 S+0x10 을 안 쓴다)', () => {
    expect(missionOpponentSpecialSwingOf(미션(1, '투수'), -1)).toBeNull()
  })
})

/* ── 투수 미션 마구 — 0xb6d6a 칸 5 · 0xaebe4 팀+0x28 · 0x50e9c 소모 · 0x3de10 공+0x10 ─────────────── */

describe('투수 미션 마구 — 남은 횟수 팀+0x28 과 공+0x10', () => {
  const 마구투수 = modePitcherOf({ ...createPitcherCareer('테스트'), selectedMagicNumber: 2 })

  function 마구세션() {
    const mission = MISSIONS.find((row) => row.side === '투수' && row.id === 1)
    if (mission === undefined) throw new Error('투수 미션 1 이 없다')
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    let screen: Screen = { kind: '미션선택' }
    const setScreen = vi.fn((next: Screen) => {
      screen = next
    })
    const rendered = renderHook(() =>
      useMissionSession({
        runner: useAtBatRunner(), random: createSeededRandom(5), missionRecord, screen, setScreen, pitcher: 마구투수,
      }),
    )
    act(() => rendered.result.current.actions.begin(mission))
    return { rendered, mission }
  }

  const 마구칸 = (remaining: number) => modePitchMenuOf(마구투수, remaining).find(isModeMagicPitchType)!

  it('웨이브 볼(+0x18 = 2)은 0xd84ff[2] = 5 회 — 던질 때마다 줄고 다시 세우면 새로 채운다', () => {
    const { rendered, mission } = 마구세션()
    expect(rendered.result.current.pitcherMagicRemaining).toBe(5)
    act(() => rendered.result.current.handleThrow(마구칸(5), 4, 0, false))
    expect(rendered.result.current.pitcherMagicRemaining).toBe(4)
    act(() => rendered.result.current.actions.begin(mission))
    expect(rendered.result.current.pitcherMagicRemaining).toBe(5)
  })

  it('남은 0 이면 구질 22 를 무시한다 (0x50db8) — 공도 난수도 안 나간다', () => {
    const { rendered } = 마구세션()
    for (let thrown = 0; thrown < 5; thrown += 1) {
      if (rendered.result.current.pitcherRun?.status !== '진행중' || rendered.result.current.pendingDefensePlay !== null) {
        return
      }
      act(() => rendered.result.current.handleThrow(마구칸(5 - thrown), 4, 0, false))
    }
    expect(rendered.result.current.pitcherMagicRemaining).toBe(0)
    if (rendered.result.current.pitcherRun?.status !== '진행중' || rendered.result.current.pendingDefensePlay !== null) return
    const before = rendered.result.current.pitcherRun
    act(() => rendered.result.current.handleThrow(마구칸(0), 4, 0, false))
    expect(rendered.result.current.pitcherRun).toBe(before)
  })
})
