// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  missionBatterSpecialSwingRemainingOf,
  missionOpponentAbility,
  missionOpponentSpecialSwingOf,
  missionOpponentStaminaAfterPitch,
  missionPitcherAbility,
  useMissionSession,
  withPitcherNotOut,
} from '@/app/model/useMissionSession'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf, EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { createPatternDeck, rollSceneEffectInit } from '@/entities/batting/model/battedBallOutcome'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { isModeMagicPitchType, modePitchMenuOf, modePitcherOf } from '@/app/model/modePitcher'
import type { ModePitcher } from '@/app/model/modePitcher'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { modePitcherOfHallOfFame } from '@/app/model/modePitcher'
import { EMPTY_COLLECTION, registerHallOfFame, registerHallOfFamePitcher } from '@/entities/collection/model/collection'
import { createCareer } from '@/entities/career/model/playerCareer'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'

/**
 * 이벤트 112 의 match 명령이 여는 마선수 대결 — 이기면 114, 지면 115 로 돌아가야 한다.
 * 브라우저에서 승리 타구를 맞히기 어려워 이 경로만 훅 수준에서 끝까지 돌린다.
 */

const SIKER_TEAM = 16
const WIN_EVENT_ID = 114
const LOSE_EVENT_ID = 115

function setUpSession() {
  const save = vi.fn()
  const missionRecord: MissionRecordPort = { load: () => ({}), save }
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

  return { rendered, setScreen, screenNow: () => screen, save }
}

/** 대결을 시작하고 타구 하나로 끝낸다 */
function playAceMatch(hit: boolean) {
  const { rendered, screenNow, save } = setUpSession()
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
  return { afterStart, status, afterFinish: screenNow(), save }
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
    const { status, afterFinish, save } = playAceMatch(false)

    expect(status, `대결 결과가 실패가 아니다: ${status}`).toBe('실패')
    expect(afterFinish).toMatchObject({ kind: '이벤트', eventId: LOSE_EVENT_ID })
    // 0xa5368(obj, 0) — 횟수를 안 건드린다
    expect(save).not.toHaveBeenCalled()
  })

  it('team 16 을 이기면 0xa5368(obj, 1) 이 타자 15번 칸(타자:16)을 −1 → 0 으로 올린다 (g[0x11f] 를 안 본다)', () => {
    const { status, save } = playAceMatch(true)

    expect(status).toBe('성공')
    expect(save).toHaveBeenCalledWith({ '타자:16': 0 })
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
  // 이 공이 낸 타석 판정 — 타석 화면은 맞는 순간 결과 글자를 안 띄우므로(1e53a14) 글자 대신 판정 코드 · 쏜 패턴으로 가른다
  const pending = rendered.result.current.session.pendingDefensePlay
  const contact = pending === null ? undefined : contactOfOutcome(pending.outcome)
  const result = `${banner}|${contact === undefined ? '판 없음' : `${contact.resultCode}:${contact.pattern.join(',')}`}`
  const maxGauges = rendered.result.current.session.pitcherRun?.perfectGauges ?? 0
  rendered.unmount()
  return { drawn, banner, result, maxGauges }
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
    // 수비 사람 −10(모드 5, 16897fc)을 실은 뒤 다른 판정 코드(땅볼 쪽)가 난다. 다른 코드는 덱 · 특수 타구 표 굴림(514f2,
    // 코드 25 · 26 만)이 달라 굴림 수가 갈린다. 그래서 **같은 판정 코드 · 같은 패턴이 난 칸끼리** 굴림 수를 견준다
    const 칸별 = [1, 5, 7, 8, 9, 0, 12].map((cell) => drawsOfOnePitch(1, cell))
    const 결과별 = new Map<string, Set<number>>()
    for (const { result, drawn } of 칸별) 결과별.set(result, (결과별.get(result) ?? new Set()).add(drawn))
    for (const [result, draws] of 결과별) {
      expect(draws.size, `${result} 칸마다 난수 차례가 다르다: ${[...draws].join(',')}`).toBe(1)
    }
    const 끔 = drawsOfOnePitch(1, 0, false)
    const 같은결과 = 칸별.find((pitch) => pitch.result === 끔.result)
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

describe('타자 미션 도루 — 키는 출발만(0xa9bd4), 공이 도착하면 도루 판(0x3dfac 종류 5)', () => {
  it("'기동력은 나의 힘'(1루 주자) — 출발한 뒤 볼이 도착하면 1루 도루는 세이프, 도루 목표가 오른다 · 재생할 판을 남긴다", () => {
    const rendered = setUpBatterMission(5)
    expect(rendered.result.current.session.stealableBases).toEqual([1])

    act(() => {
      rendered.result.current.session.actions.steal(1)
    })
    // 출발만 했다 — 루·목표는 그대로, 같은 주자는 다시 못 건다
    expect(rendered.result.current.session.missionRun?.bases.first).toBe(true)
    expect(rendered.result.current.session.stealableBases).toEqual([])

    act(() => {
      rendered.result.current.session.handleMissionPitch({
        resolution: { kind: '볼' },
        hasSwung: false,
        isBunt: false,
        resultCode: null,
      })
    })

    const after = rendered.result.current.session.missionRun!
    expect(after.bases).toEqual({ first: false, second: true, third: false })
    expect(after.outs).toBe(0)
    expect(after.progress.counts['도루']).toBe(1)
    expect(rendered.result.current.session.pickoffReplay).not.toBeNull()
    // 타석은 이어진다 — 볼 하나
    expect(rendered.result.current.runner.atBat.balls).toBe(3)
    rendered.unmount()
  })

  it('출발하지 않은 공은 판이 없다 — 루 그대로', () => {
    const rendered = setUpBatterMission(5)
    const before = rendered.result.current.session.missionRun!

    act(() => {
      rendered.result.current.session.handleMissionPitch({
        resolution: { kind: '스트라이크', isSwinging: false },
        hasSwung: false,
        isBunt: false,
        resultCode: null,
      })
    })

    expect(rendered.result.current.session.missionRun?.bases).toEqual(before.bases)
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
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

  it('타자 미션 마투수는 공마다 0xa5e14 로 깎인다 — 새 경기는 10000, 압도 22 면 ×2, 마선수가 아니면 그대로', () => {
    if (레오니미션 === undefined) throw new Error('레오니 미션이 없다')
    // 체력 넷째 칸(run)이 용량 0x66e44 의 재료다 — 사기 100(모드 6 은 V 가 없다)이라 > 90 갈래 +1/20 · 첫 투수 +200 · +250
    const 레오니 = missionOpponentAbility(레오니미션)!
    const 용량 = 레오니.run + Math.trunc(레오니.run / 20) + 200 + 250
    const 직구 = missionOpponentStaminaAfterPitch(10_000, 레오니미션, 1, [])
    expect(직구).toBe(10_000 + Math.trunc(((용량 - 9) * 10_000) / 용량) - 10_000)
    const 압도 = missionOpponentStaminaAfterPitch(10_000, 레오니미션, 1, [22])
    expect(압도).toBe(10_000 + Math.trunc(((용량 - 18) * 10_000) / 용량) - 10_000)
    const 일반 = MISSIONS.find((mission) => mission.side === '타자' && mission.opponentAce === 0)!
    expect(missionOpponentStaminaAfterPitch(10_000, 일반, 1, [])).toBe(10_000)
    // 체력% 는 투구 AI 의 피로·지친 등급으로 간다 (pitcherAbilityOf 셋째 인자)
    expect(missionPitcherAbility(레오니미션, undefined, 40)).not.toEqual(missionPitcherAbility(레오니미션))
  })

  it('세션은 공마다 마투수 체력%를 내리고 새 경기에서 100 으로 되돌린다', () => {
    if (레오니미션 === undefined) throw new Error('레오니 미션이 없다')
    const { rendered } = setUpSession()
    act(() => rendered.result.current.session.actions.begin(레오니미션))
    expect(rendered.result.current.session.opponentStaminaPercent).toBe(100)
    for (let pitch = 0; pitch < 2; pitch += 1) {
      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '볼' },
          hasSwung: false,
          isBunt: false,
          resultCode: null,
          pitchTypeNumber: 1,
        })
      })
    }
    expect(rendered.result.current.session.opponentStaminaPercent).toBeLessThan(100)
    act(() => rendered.result.current.session.actions.begin(레오니미션))
    expect(rendered.result.current.session.opponentStaminaPercent).toBe(100)
    rendered.unmount()
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
      // 타자 미션은 수비가 CPU 다 (0xaa57c 가 레코드 +3 윗 4비트의 사람 칸 반대쪽을 경기[0x31 + 칸] = 1 로 세운다)
      defenseIsCpu: true,
    })

    act(() => {
      rendered.result.current.session.actions.cpuPickoff(3)
    })

    const after = rendered.result.current.session.missionRun!
    expect(rendered.result.current.session.pickoffReplay?.advance).toEqual(expected.advance)
    // 받은 야수의 0xafa60 매 틱 갈래가 도는 판 — 틱 수까지 같다
    expect(rendered.result.current.session.pickoffReplay?.ticks).toHaveLength(expected.ticks.length)
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

/* ── 투수 미션 사람 견제 (0x53580 → 0x53548 → 메시지 0x10 → 0x50f28, 모드 5 갈림 없음) ───────────── */

/** 투수 미션 하나를 세운다 — 씨앗 난수 하나를 시작(0x3fa0e rand(0, 2))부터 그대로 쓴다 */
function setUpPitcherMission(missionId: number, seed: number, throwModeManual?: boolean) {
  const mission = MISSIONS.find((row) => row.side === '투수' && row.id === missionId)
  if (mission === undefined) throw new Error(`투수 미션 ${missionId} 이 없다`)
  return setUpPitcherMissionOf(mission, seed, throwModeManual)
}

function setUpPitcherMissionOf(mission: (typeof MISSIONS)[number], seed: number, throwModeManual?: boolean) {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const random = createSeededRandom(seed)
  let screen: Screen = { kind: '미션선택' }
  const setScreen = vi.fn((next: Screen) => {
    screen = next
  })
  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return {
      runner,
      session: useMissionSession({ runner, random, missionRecord, screen, setScreen, throwModeManual }),
    }
  })
  act(() => rendered.result.current.session.actions.begin(mission))
  return rendered
}

/** 같은 씨앗으로 시작 굴림 하나를 먹인 난수 — 세션이 견제 판에 넘기는 난수와 같은 자리 */
function seededAfterStart(seed: number): RandomPort {
  const random = createSeededRandom(seed)
  // 경기 장면 시작 — 상태 7 장면 덱 섞기(0x3e340 → 0xb08e8) · 효과 객체(3ef6e 0x90190, 1202 번) · 상태 9 시뮬 초기화 rand(0, 2)
  createPatternDeck(random)
  rollSceneEffectInit(random)
  rollSimulatorInit(random)
  return random
}

describe('투수 미션 사람 견제 — 구질 고르기 0xf 의 0x53548 은 모드 5 를 안 막는다', () => {
  // 미션 12 "최강의 챔피언" — 1사 1·3루, 2볼
  it("'3' 은 1루 견제 판을 사람 수비·송구 설정으로 돌려 먹이고 재생할 판을 남긴다 — 투구 수·볼카운트는 그대로", () => {
    const rendered = setUpPitcherMission(12, 11)
    const before = rendered.result.current.session.pitcherRun!
    const ballsBefore = rendered.result.current.runner.atBat.balls
    const expected = runPickoffPlay({
      targetBase: 1,
      bases: before.bases,
      outs: before.outs,
      random: seededAfterStart(11),
      offenseIsCpu: true,
      defenseIsCpu: false,
      throwMode: '수동',
    })

    // 판이 실제로 돌았다 (1루 주자가 있다)
    expect(expected.ticks.length).toBeGreaterThan(0)

    act(() => rendered.result.current.session.actions.pickoff('3'))

    const after = rendered.result.current.session.pitcherRun!
    expect(rendered.result.current.session.pickoffReplay?.advance).toEqual(expected.advance)
    expect(rendered.result.current.session.pickoffReplay?.ticks).toHaveLength(expected.ticks.length)
    expect(after.outs).toBe(before.outs + expected.advance.outsAdded)
    expect(after.totalOuts).toBe(before.totalOuts + expected.advance.outsAdded)
    // 견제는 투구가 아니다 — 남은 투구 수·볼카운트·목표를 안 건드린다
    expect(after.remainingPitches).toBe(before.remainingPitches)
    expect(after.progress).toBe(before.progress)
    expect(rendered.result.current.runner.atBat.balls).toBe(ballsBefore)

    act(() => rendered.result.current.session.actions.finishPickoffReplay())
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
    rendered.unmount()
  })

  it('환경설정 송구 자동(+0xf4)을 그대로 넘긴다 — 0xae6c8 의 답이 된다', () => {
    const rendered = setUpPitcherMission(12, 5, false)
    const before = rendered.result.current.session.pitcherRun!
    const expected = runPickoffPlay({
      targetBase: 3,
      bases: before.bases,
      outs: before.outs,
      random: seededAfterStart(5),
      offenseIsCpu: true,
      defenseIsCpu: false,
      throwMode: '자동',
    })

    act(() => rendered.result.current.session.actions.pickoff('7'))

    expect(rendered.result.current.session.pickoffReplay?.advance).toEqual(expected.advance)
    expect(rendered.result.current.session.pickoffReplay?.ticks).toHaveLength(expected.ticks.length)
    rendered.unmount()
  })

  it("빈 루('1' 2루)·견제 키가 아닌 키는 아무 일도 없다 (0x50f28 의 0xa9878 · 0x53548 의 세 키)", () => {
    const rendered = setUpPitcherMission(12, 11)
    const before = rendered.result.current.session.pitcherRun

    act(() => rendered.result.current.session.actions.pickoff('1'))
    act(() => rendered.result.current.session.actions.pickoff('5'))

    expect(rendered.result.current.session.pitcherRun).toBe(before)
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
    rendered.unmount()
  })

  it('타자 미션에서는 투수 미션 견제가 없다 — 던지는 쪽이 아니다', () => {
    const rendered = setUpBatterMission(1)
    const before = rendered.result.current.session.missionRun

    act(() => rendered.result.current.session.actions.pickoff('7'))

    expect(rendered.result.current.session.missionRun).toBe(before)
    expect(rendered.result.current.session.pickoffReplay).toBeNull()
    rendered.unmount()
  })
})

/* ── 견제사도 '아웃' 목표에 든다 (아웃 콜 결과 13 → 0xa7d0c → R+0x13c · 판정 0xaaa6c aacd6) ──────── */

describe("투수 미션 견제사는 '아웃' 목표(R+0x13c)에 든다 — 0x51b36 → 0xa7d0c(a7d52) · 판 끝 판정 0xaaa6c(ae5c4)", () => {
  // 미션 12 "최강의 챔피언" 1사 1·3루 — 씨앗 55 의 1루 견제는 견제사다 (같은 씨앗의 기대 판으로 확인 — 장면 초기화의 효과 객체 1202 번(3ef6e)이
  // 끼며 씨앗 20 은 세이프가 됐다. 1~60 가운데 견제사는 55 하나)
  const mission12 = MISSIONS.find((row) => row.side === '투수' && row.id === 12)!
  const expectedOf = (seed: number) =>
    runPickoffPlay({
      targetBase: 1,
      bases: mission12.start.runners,
      outs: mission12.start.outs,
      random: seededAfterStart(seed),
      offenseIsCpu: true,
      defenseIsCpu: false,
      throwMode: '수동',
    })

  it("견제사 하나 = '아웃' 칸 +1 · 이닝 아웃 +1 — 목표가 탈삼진뿐이면 진행 중 그대로", () => {
    expect(expectedOf(55).advance.outsAdded).toBe(1)
    const rendered = setUpPitcherMission(12, 55)
    const before = rendered.result.current.session.pitcherRun!

    act(() => rendered.result.current.session.actions.pickoff('3'))

    const after = rendered.result.current.session.pitcherRun!
    expect(after.progress.counts['아웃']).toBe((before.progress.counts['아웃'] ?? 0) + 1)
    expect(after.totalOuts).toBe(before.totalOuts + 1)
    // 타석이 끝난 게 아니다 — 타석 수·삼진콤보는 그대로
    expect(after.progress.plateAppearances).toBe(before.progress.plateAppearances)
    expect(after.progress.counts['삼진콤보']).toBe(before.progress.counts['삼진콤보'])
    expect(after.status).toBe('진행중')
    rendered.unmount()
  })

  it("'아웃' 목표가 견제사로 차면 판 끝 판정에서 바로 성공 — 0xaa928 이 상태 1 로 안 남는다", () => {
    const 아웃한개 = { ...mission12, goals: ['아웃'], goalCounts: { '아웃': 1 } }
    const rendered = setUpPitcherMissionOf(아웃한개, 55)

    act(() => rendered.result.current.session.actions.pickoff('3'))

    expect(rendered.result.current.session.pitcherRun!.status).toBe('성공')
    rendered.unmount()
  })

  it('세이프면 칸이 그대로다', () => {
    expect(expectedOf(11).advance.outsAdded).toBe(0)
    const rendered = setUpPitcherMission(12, 11)
    const before = rendered.result.current.session.pitcherRun!

    act(() => rendered.result.current.session.actions.pickoff('3'))

    expect(rendered.result.current.session.pitcherRun!.progress).toBe(before.progress)
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

/* ── 미션 선수 고르기 (하위 17 · +0xa5/+0xa6) ───────────────────────────── */

describe('미션 선수 고르기 — 명예 선수를 고르면 0x1fbd0 · 0x1fc20 이 명전 기록을 준다', () => {
  const 명전투수 = { ...createPitcherCareer('철완'), endingIndex: 5, ability: { control: 950, velocity: 950, breaking: 950, stamina: 950 }, selectedMagicNumber: 2 }
  const 명전타자 = { ...createCareer('전설'), endingIndex: 4, equippedSkillIds: [22], specialSwingNumber: 3 }
  const 투수등록 = registerHallOfFamePitcher(EMPTY_COLLECTION, 명전투수, 99_999)
  if (투수등록.kind !== '등록') throw new Error('등록 실패')
  const 타자등록 = registerHallOfFame(투수등록.collection, 명전타자, 99_999)
  if (타자등록.kind !== '등록') throw new Error('등록 실패')
  const hallOfFame = 타자등록.collection
  const 나리투수 = modePitcherOf(createPitcherCareer('나리'))

  function 세션(initial: Screen = { kind: '미션선택' }) {
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    return renderHook(({ screen }: { screen: Screen }) =>
      useMissionSession({
        runner: useAtBatRunner(), random: createSeededRandom(1), missionRecord, screen, setScreen: vi.fn(),
        pitcher: 나리투수, batterSkillIds: [7], hallOfFame,
      }), { initialProps: { screen: initial } })
  }

  it('처음에는 아무도 안 골랐다 — 나리 투수·명예 타자 없음', () => {
    const { result } = 세션()
    expect(result.current.player).toBeNull()
    expect(result.current.pitcher).toBe(나리투수)
    expect(result.current.hallOfFameBatter).toBeNull()
  })

  it('명예 투수(코드 3)를 고르면 그 기록으로 던지고 목록 편이 투수가 된다 (모드 5)', () => {
    const { result } = 세션()
    act(() => result.current.actions.choosePlayer({ side: '투수', hallOfFameIndex: 0 }))
    expect(result.current.pitcher).toEqual(modePitcherOfHallOfFame(hallOfFame.hallOfFamePitchers[0]))
    expect(result.current.lastSide).toBe('투수')
    expect(result.current.hallOfFameBatter).toBeNull()
  })

  it('명예 타자(코드 4)를 고르면 그 타자가 친다 — 투수는 나리 그대로', () => {
    const { result } = 세션()
    act(() => result.current.actions.choosePlayer({ side: '타자', hallOfFameIndex: 0 }))
    expect(result.current.hallOfFameBatter).toMatchObject({ skillIds: [22], specialSwingNumber: 3 })
    expect(result.current.pitcher).toBe(나리투수)
    expect(result.current.lastSide).toBe('타자')
  })

  it('나리 선수(코드 1·2)는 −1 — 나리 값 그대로', () => {
    const { result } = 세션()
    act(() => result.current.actions.choosePlayer({ side: '투수', hallOfFameIndex: null }))
    expect(result.current.pitcher).toBe(나리투수)
  })

  it('미션 모드 화면을 떠나면 고른 선수를 지운다 — 다시 들어오면 0x5eb8c 가 +0xa5/+0xa6 을 −1 로 되돌린다', () => {
    const rendered = 세션()
    act(() => rendered.result.current.actions.choosePlayer({ side: '투수', hallOfFameIndex: 0 }))
    rendered.rerender({ screen: { kind: '미션설명', mission: MISSIONS[0] } })
    expect(rendered.result.current.player).not.toBeNull()
    rendered.rerender({ screen: { kind: '메인메뉴' } })
    expect(rendered.result.current.player).toBeNull()
  })

  it('투수편 마선수 대결(+0x176 ≠ 0)은 고른 명예 투수가 아니라 나리 투수가 던진다', () => {
    const rendered = 세션()
    act(() => rendered.result.current.actions.choosePlayer({ side: '투수', hallOfFameIndex: 0 }))
    const mission = aceMatchMissionOf(16, '투수')
    if (mission === null) throw new Error('투수 미션 16 이 없다')
    act(() => rendered.result.current.actions.beginPitcherAceMatch(mission))
    expect(rendered.result.current.pitcher).toBe(나리투수)
  })
})

/* ── 경기 시작 rand(0, 2) — 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e → 0xc0dac ─────────── */

describe('미션 경기 시작은 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번부터다 (모드 5·6 도 공통 꼬리를 탄다)', () => {
  function 기록난수() {
    const inner = createSeededRandom(3)
    const calls: [number, number][] = []
    const port: RandomPort = {
      ...inner,
      nextInRange: (min: number, max: number) => {
        calls.push([min, max])
        return inner.nextInRange(min, max)
      },
    }
    return { port, calls }
  }

  it.each([['타자', MISSIONS.find((m) => m.side === '타자')!], ['투수', MISSIONS.find((m) => m.side === '투수')!]] as const)(
    '%s 미션 begin — 굴림 하나 rand(0, 2)', (_side, mission) => {
      const { port, calls } = 기록난수()
      const rendered = renderHook(() =>
        useMissionSession({
          runner: useAtBatRunner(), random: port, missionRecord: { load: () => ({}), save: vi.fn() },
          screen: { kind: '미션선택' }, setScreen: vi.fn(),
        }))
      act(() => rendered.result.current.actions.begin(mission))
      expect(calls).toEqual([[0, 2]])
    })

  it('마선수 대결(beginAceMatch · beginPitcherAceMatch)도 한 번', () => {
    const { port, calls } = 기록난수()
    const rendered = renderHook(() =>
      useMissionSession({
        runner: useAtBatRunner(), random: port, missionRecord: { load: () => ({}), save: vi.fn() },
        screen: { kind: '투수편' }, setScreen: vi.fn(),
      }))
    const batter = aceMatchMissionOf(SIKER_TEAM, '타자')
    const pitcher = aceMatchMissionOf(16, '투수')
    if (batter === null || pitcher === null) throw new Error('대결 미션이 없다')
    act(() => rendered.result.current.actions.beginAceMatch(batter, { resultEvents: [1, 2], context: '대결결과', carried: EMPTY_STORY_CARRY }))
    expect(calls).toEqual([[0, 2]])
    act(() => rendered.result.current.actions.beginPitcherAceMatch(pitcher))
    expect(calls).toEqual([[0, 2], [0, 2]])
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

/* ── 투수편 마선수 대결 (SYS 8 → 투수 미션 team − 1 → +0x177) ─────────────────── */

describe('투수편 마선수 대결 — 투수 미션 team − 1 을 던지고 이겼나(+0x177 = 미션객체+0xbc)를 돌려준다', () => {
  /** 메디카(team 16 → 투수 미션 레코드 15 · 웹 id 16)를 끝날 때까지 한가운데 직구로 던진다 */
  function playPitcherAceMatch(seed: number, options: { giveUp?: boolean } = {}) {
    const save = vi.fn()
    const missionRecord: MissionRecordPort = { load: () => ({}), save }
    const onGamePointReward = vi.fn()
    const setScreen = vi.fn()
    const random = createSeededRandom(seed)
    const pitcher = modePitcherOf(createPitcherCareer('대결투수'))
    const screen: Screen = { kind: '투수편' }
    const rendered = renderHook(() => {
      const runner = useAtBatRunner()
      return useMissionSession({ runner, random, missionRecord, screen, setScreen, onGamePointReward, pitcher })
    })
    const mission = aceMatchMissionOf(16, '투수')
    if (mission === null) throw new Error('투수 미션 16 이 없다')

    act(() => rendered.result.current.actions.beginPitcherAceMatch(mission))
    const started = rendered.result.current
    if (options.giveUp === true) act(() => rendered.result.current.actions.giveUpPitcher())
    for (let pitch = 0; pitch < 20 && rendered.result.current.pitcherRun?.status === '진행중'; pitch += 1) {
      const session = rendered.result.current
      if (session.pendingDefensePlay !== null) {
        act(() => session.actions.finishDefensePlay())
        continue
      }
      if (session.pendingBenchClearing !== null) {
        act(() => session.actions.finishBenchClearing(false))
        continue
      }
      act(() => session.handleThrow(PITCH_TYPES[0], 4, 9, true))
    }
    const status = rendered.result.current.pitcherRun?.status
    let isWin: boolean | null = null
    act(() => {
      isWin = rendered.result.current.actions.finishPitcherAceMatch()
    })
    const after = rendered.result.current
    rendered.unmount()
    return { mission, pitcher, started, status, isWin, after, save, onGamePointReward, setScreen }
  }

  it('투수 미션 16 "메디카 공략" 을 투수편 내 투수로 세우고 앱 화면은 그대로 둔다 (투수편 라우트가 그린다)', () => {
    const { mission, pitcher, started, setScreen } = playPitcherAceMatch(1)

    expect(mission).toMatchObject({ side: '투수', id: 16, name: '메디카', goalCounts: { 아웃: 1 } })
    expect(started.pitcherAceMatchMission).toBe(mission)
    expect(started.pitcherRun?.mission).toBe(mission)
    expect(started.pitcher).toBe(pitcher)
    expect(setScreen).not.toHaveBeenCalled()
  })

  it('아웃을 잡으면(성공) 이겼다 — G 보상은 없고(0x4ef3e 의 +0x176 갈래) 투수 15번 칸만 −1 → 0 (0xa5368)', () => {
    // 씨앗 3 — 한가운데 공으로 아웃을 잡는 판(장면 초기화의 효과 객체 1202 번(3ef6e)이 끼며 씨앗 1 은 실패 판이 됐다)
    const { status, isWin, after, save, onGamePointReward } = playPitcherAceMatch(3)

    expect(status).toBe('성공')
    expect(isWin).toBe(true)
    expect(after.pitcherRun).toBeNull()
    expect(after.pitcherAceMatchMission).toBeNull()
    expect(save).toHaveBeenCalledWith({ '투수:16': 0 })
    expect(onGamePointReward).not.toHaveBeenCalled()
  })

  it('실패하면 졌다', () => {
    const { status, isWin } = playPitcherAceMatch(2)

    expect(status).toBe('실패')
    expect(isWin).toBe(false)
  })

  it('포기도 실패라 졌다', () => {
    const { isWin } = playPitcherAceMatch(1, { giveUp: true })

    expect(isWin).toBe(false)
  })

  it('대결 중이 아니면 끝낼 것이 없다 (null) — 보통 투수 미션의 끝(finishPitcher)과 섞이지 않는다', () => {
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    const screen: Screen = { kind: '미션선택' }
    const rendered = renderHook(() => {
      const runner = useAtBatRunner()
      return useMissionSession({ runner, random: createSeededRandom(1), missionRecord, screen, setScreen: vi.fn() })
    })
    const ordinary = MISSIONS.find((row) => row.side === '투수' && row.id === 1)
    if (ordinary === undefined) throw new Error('투수 미션 1 이 없다')
    act(() => rendered.result.current.actions.begin(ordinary))

    let result: boolean | null = true
    act(() => {
      result = rendered.result.current.actions.finishPitcherAceMatch()
    })
    expect(result).toBeNull()
    expect(rendered.result.current.pitcherRun).not.toBeNull()
    rendered.unmount()
  })
})

/* ── 낫아웃 — 삼진 +1(a7cc4) · 판의 아웃 콜 · 정산 보정 −1(a8cfc) ──────────────────────────────── */

describe("투수 미션 낫아웃의 '아웃' 칸 — 판정 0xaaa6c 는 정산 보정 뒤 값을 본다", () => {
  // 투수 16 "메디카" — 목표 '아웃' 1 · 타석 제한 1
  const 메디카 = MISSIONS.find((row) => row.side === '투수' && row.id === 16)!
  const 낫아웃판 = (outsAdded: number, batterSafe: boolean) =>
    ({
      kind: 9,
      strikeout: 'batterRuns',
      result: {
        advance: { bases: { first: batterSafe, second: false, third: false }, runsScored: 0, outsAdded },
        runnerFates: [{ fromBase: 0, scored: false, retired: !batterSafe }],
      },
    }) as unknown as PitchArrivalPlay

  it("타자주자가 살면 '아웃' 은 0 — 삼진 +1 이 보정 −1 로 빠져 목표를 못 채우고 타석 제한으로 실패다", () => {
    const run = withPitcherNotOut(startPitcherMission(메디카), { kind: '삼진' }, 낫아웃판(0, true))
    expect(run.progress.counts['탈삼진']).toBe(1)
    expect(run.progress.counts['아웃']).toBe(0)
    expect(run.bases.first).toBe(true)
    expect(run.status).toBe('실패')
  })

  it("타자주자가 1루에서 잡히면 아웃 콜 하나로 '아웃' 1 — 성공", () => {
    const run = withPitcherNotOut(startPitcherMission(메디카), { kind: '삼진' }, 낫아웃판(1, false))
    expect(run.progress.counts['아웃']).toBe(1)
    expect(run.totalOuts).toBe(1)
    expect(run.status).toBe('성공')
  })
})

describe('보통 타자 미션 경기 중 나가기 — 0x40140: 0xa5368(…, 0) 뒤 곧장 메인 메뉴(0x103 하위 4)', () => {
  it('결과 화면·미션 목록을 안 거치고 클리어 기록도 안 쓴다', () => {
    const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
    let screen: Screen = { kind: '미션선택' }
    const setScreen = vi.fn((next: Screen) => {
      screen = next
    })
    const rendered = renderHook(() => {
      const runner = useAtBatRunner()
      return useMissionSession({ runner, random: createSeededRandom(1), missionRecord, screen, setScreen })
    })
    const mission = MISSIONS.find((row) => row.side === '타자')!
    act(() => rendered.result.current.actions.begin(mission))
    expect(screen.kind).toBe('미션진행')

    act(() => rendered.result.current.actions.quitBatterMission())
    expect(screen).toEqual({ kind: '메인메뉴' })
    expect(rendered.result.current.missionRun).toBeNull()
    expect(missionRecord.save).not.toHaveBeenCalled()
    rendered.unmount()
  })
})

describe('상태 0xe 의 OK 대기 — 미션(모드 5·6)도 새 타석마다 (0x39e14 → 0x532b0)', () => {
  it('미션을 세우면 대기가 서고, 타석이 끝나면(결과 연출 뒤 새 타석) 새 대기다 — 같은 타석의 다음 공은 그대로다', () => {
    const { rendered } = setUpSession()
    const mission = MISSIONS.find((row) => row.side === '타자')
    if (mission === undefined) throw new Error('타자 미션이 없다')
    act(() => rendered.result.current.session.actions.begin(mission))
    const 처음 = rendered.result.current.session.sceneConfirm
    expect(처음).not.toBeNull()
    const 스트라이크 = () =>
      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '스트라이크', isSwinging: true },
          hasSwung: true,
          isBunt: false,
          resultCode: null,
        })
      })
    스트라이크()
    expect(rendered.result.current.session.sceneConfirm).toBe(처음)
    스트라이크()
    스트라이크()
    // 삼진 — 0xd → 0xe
    expect(rendered.result.current.session.sceneConfirm).not.toBe(처음)
  })
})

describe('투수 미션 경기 중 메뉴 "나가기" (0x40140 모드 5·6 갈래)', () => {
  it('결과 화면 없이 곧장 메인 메뉴 — 클리어 기록을 안 건드린다', () => {
    const { rendered, setScreen } = setUpSession()
    const mission = MISSIONS.find((row) => row.side === '투수')
    if (mission === undefined) throw new Error('투수 미션이 없다')
    act(() => rendered.result.current.session.actions.begin(mission))
    act(() => rendered.result.current.session.actions.quitPitcherMission())
    expect(rendered.result.current.session.pitcherRun).toBeNull()
    expect(setScreen).toHaveBeenLastCalledWith({ kind: '메인메뉴' })
    expect(rendered.result.current.session.clearCounts).toEqual({})
  })
})

describe('미션의 파울 각 공도 수비 판을 돈다 — 파울로 닫히면 같은 타석 스트라이크(0x35108 → 0xb6b58), 잡히면 파울 뜬공 아웃', () => {
  const 파울코드 = Object.entries(BATTED_BALL_PATTERNS).flatMap(([code, patterns]) =>
    patterns.filter((pattern) => !isFairAngle(pattern[0])).map((pattern) => ({ resultCode: Number(code), pattern })),
  )[0]

  it('타자 미션: 쏜 공이 실린 파울은 판을 붙들고 스트라이크는 판이 파울로 닫힐 때 오른다', () => {
    const rendered = setUpBatterMission(1)
    act(() => {
      rendered.result.current.session.handleMissionPitch({
        resolution: { kind: '파울' },
        hasSwung: true,
        isBunt: false,
        resultCode: 파울코드.resultCode,
        pattern: 파울코드.pattern,
        foulContact: 파울코드,
      })
    })
    const pending = rendered.result.current.session.pendingDefensePlay
    expect(pending?.isFoulPlay).toBe(true)
    expect(pending?.input.strikes).toBe(0)
    expect(contactOfOutcome(pending!.outcome)?.pattern).toEqual(파울코드.pattern)
    expect(rendered.result.current.runner.atBat.strikes).toBe(0)

    act(() => {
      rendered.result.current.session.actions.finishDefensePlay({
        ...runDefensePlay(pending!.input),
        foulEnded: true,
        outcome: undefined,
        caughtOnTheFly: false,
      })
    })
    expect(rendered.result.current.session.pendingDefensePlay).toBeNull()
    expect(rendered.result.current.runner.atBat.strikes).toBe(1)
    expect(rendered.result.current.runner.atBat.outcome).toBeNull()
    expect(rendered.result.current.session.missionRun?.status).toBe('진행중')
    rendered.unmount()
  })

  it('투수 미션: CPU 타자의 파울 각 공(`playsFoulBall`)도 판을 붙든다 — 볼카운트는 판이 닫힐 때까지 그대로', () => {
    let 파울판 = 0
    // 장면 초기화의 효과 객체 1202 번(3ef6e)이 끼며 1~8 에는 파울 각 공이 없어졌다 — 씨앗 11 이 첫 공에 낸다
    for (let seed = 1; seed <= 12 && 파울판 === 0; seed += 1) {
      const rendered = setUpPitcherMission(12, seed)
      for (let pitch = 0; pitch < 40 && rendered.result.current.session.pitcherRun?.status === '진행중'; pitch += 1) {
        const session = rendered.result.current.session
        if (session.pendingBenchClearing !== null) {
          act(() => session.actions.finishBenchClearing(false))
          continue
        }
        if (session.pendingDefensePlay !== null) {
          act(() => session.actions.finishDefensePlay())
          continue
        }
        const 앞 = rendered.result.current.runner.atBat
        act(() => session.handleThrow(PITCH_TYPES[0], pitch % 9, 9, true))
        const pending = rendered.result.current.session.pendingDefensePlay
        if (pending?.isFoulPlay !== true) continue
        파울판 += 1
        expect(pending.side).toBe('투수')
        expect(pending.input.strikes).toBe(앞.strikes)
        expect(rendered.result.current.runner.atBat).toEqual(앞)
        const result = runDefensePlay(pending.input)
        act(() => rendered.result.current.session.actions.finishDefensePlay(result))
        expect(rendered.result.current.session.pendingDefensePlay).toBeNull()
        if (result.foulEnded === true) {
          expect(rendered.result.current.runner.atBat.strikes).toBe(Math.min(앞.strikes + 1, 2))
        } else {
          expect(result.outcome).toEqual({ kind: '아웃', detail: '뜬공아웃' })
        }
        break
      }
      rendered.unmount()
    }
    expect(파울판).toBeGreaterThan(0)
  })
})

describe('미션 상대 CPU 교체 — 0xf 진입 0x3d954 (타자 미션 0xac428 · `missionCpuTeam`)', () => {
  it("3점 홈런으로 CPU 투수의 이닝 실점이 3 이 되면 다음 타석 0xe 뒤에 바꾼다 — 22 'Time!' · 등판음 14 · OK 를 두 번 받는다", () => {
    vi.useFakeTimers()
    try {
      const played: number[] = []
      const sound = { ...createSilentSound(), play: (id: number) => played.push(id) }
      const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
      let screen: Screen = { kind: '미션선택' }
      const setScreen = vi.fn((next: Screen) => {
        screen = next
      })
      const rendered = renderHook(() => {
        const runner = useAtBatRunner()
        return {
          runner,
          session: useMissionSession({ runner, random: createSeededRandom(7), missionRecord, screen, setScreen, sound }),
        }
      })
      // '미스터 타점왕' — 1회 1사 2·3루, 4타점 목표. 상대 팀 8 의 4번째 선발(마스터 3번)이 던진다
      const mission = MISSIONS.find((row) => row.side === '타자' && row.id === 9)!
      act(() => {
        rendered.result.current.session.actions.begin(mission)
      })
      rendered.rerender()
      expect(rendered.result.current.session.sceneConfirm?.entries).toBe(1)

      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '타구', outcome: { kind: '홈런' } },
          hasSwung: true,
          isBunt: false,
          resultCode: null,
        })
      })
      const afterHomeRun = rendered.result.current.session.missionRun!
      expect(afterHomeRun.status).toBe('진행중')
      expect(afterHomeRun.cpu.pitching).toMatchObject({ inningRunsAllowed: 3, ourRuns: 3, mound: { pitcherSlot: 0 } })
      // 결과 띠가 떠 있는 동안은 0xd 앞 — 아직 안 묻는다
      expect(played).not.toContain(22)

      played.length = 0
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      const changed = rendered.result.current.session.missionRun!
      expect(changed.cpu.pitching?.mound.pitcherSlot).not.toBe(0)
      expect(changed.cpu.pitching?.mound.justChanged).toBe(true)
      expect(played).toEqual([22, 14])
      // 0x16 → 0xd → 0xe — 같은 걸음의 둘째 0xe
      expect(rendered.result.current.session.sceneConfirm?.entries).toBe(2)
      rendered.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
