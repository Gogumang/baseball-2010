// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf, EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'

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
function drawsOfOnePitch(missionId: number, gaugeCell = 9, gaugeSettingOn = true) {
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
      session: useMissionSession({ runner, random: counter.port, missionRecord, screen, setScreen }),
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
    const 칸별 = [1, 5, 7, 8, 9, 0, 12].map((cell) => drawsOfOnePitch(1, cell).drawn)
    expect(new Set(칸별).size, `칸마다 난수 차례가 다르다: ${칸별.join(',')}`).toBe(1)
    expect(drawsOfOnePitch(1, 0, false).drawn).toBe(칸별[0] + 1)
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
