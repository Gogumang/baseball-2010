import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { applyCoverAssignment, claimCoverOfBase } from '@/entities/fielding/model/coverAssignment'
import { basePosition, FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import {
  RETURN_SLACK_TICKS,
  fielderSlackAtPlayEnd,
  placedAt,
  withCarriedSlack,
} from '@/entities/fielding/model/fielderPose'
import { AI_STATE, createFielders, initialPlayView } from '@/entities/fielding/model/fieldingState'
import { passedBallShot } from '@/entities/fielding/model/passedBall'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { forecastCatch } from '@/features/defense-play/model/catchForecast'
import { DEFENSE_SCENE_START, type DefenseScene } from '@/features/defense-play/model/defenseScene'
import { runPassedBallPlay } from '@/features/defense-play/model/passedBallPlay'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { RUNNER_PLAY_RESULT } from '@/features/defense-play/model/runnerPlayEngine'
import { runStealPlay, stealPlayEngineInputOf } from '@/features/defense-play/model/stealPlay'
import { runWalkPlay } from '@/features/defense-play/model/walkPlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
const 남김 = (value: number): DefenseScene => ({
  ...DEFENSE_SCENE_START,
  fielderSlack: Array.from({ length: 9 }, () => value),
})

describe('야수 +0xcc 는 판 사이로 남는다 — 생성자 a0df0 · vt8c a0ee0 · vt20 b1156(인자 ≠ 0) · 목록 틱 a1330 (r196)', () => {
  it('뒤로 튄 파울(사건 7)은 아홉 야수 모두 5 를 남긴다 — 파울 갈래는 공 칸만 봐 같은 그림의 G1 · G2 가 같다', () => {
    const 결과 = runDefensePlay({
      outcome: registerContact(땅볼아웃, { pattern: [311, 273, 247, 1], resultCode: 9 }),
      trajectory: battedBallTrajectory([311, 273, 247, 1]),
      bases: EMPTY_BASES,
      outs: 0,
    })
    expect(결과.log).toContain('3틱 사건 7 — 야수 9명 AI 0xf (0xb2c58)')
    expect(결과.scene.fielderSlack).toEqual(Array.from({ length: 9 }, () => RETURN_SLACK_TICKS))
  })

  it('G2 에서만 닫힌 판은 다음 그림의 목록 틱이 하나 더 줄인다 (`closingListFrame`)', () => {
    const 오 = 야수들.map((fielder) => ({ ...fielder, arrivalSlackTicks: 5 }))
    expect(fielderSlackAtPlayEnd(오, false)).toEqual(Array.from({ length: 9 }, () => 5))
    expect(fielderSlackAtPlayEnd(오, true)).toEqual(Array.from({ length: 9 }, () => 4))
    // 잠긴 야수(+0xb4 > 0)는 그 목록 틱이 a12b4 에서 끝나 +0xcc 를 안 줄인다
    const 잠김 = 오.map((fielder) => (fielder.slot === 3 ? { ...fielder, actionLockTicks: 2 } : fielder))
    expect(fielderSlackAtPlayEnd(잠김, true)[3]).toBe(5)
  })

  it('vt20(0) 판은 앞 판의 값을 들고 연다 — 0xbef58 은 위치만 옮기고 목표는 vt14 관문이 열릴 때만', () => {
    expect(withCarriedSlack(야수들, [5, 4, 0]).map((fielder) => fielder.arrivalSlackTicks)).toEqual([5, 4, 0, 0, 0, 0, 0, 0, 0])
    const 루 = basePosition(1)
    expect(placedAt(야수들[2], 루, 1)).toMatchObject({ position: 루, target: 루, targetBase: 1 })
    const 막힘 = placedAt({ ...야수들[2], arrivalSlackTicks: 5 }, 루, 1)
    expect(막힘.position).toEqual(루)
    expect(막힘.target).toEqual(FIELDER_START_POSITIONS[2])
    expect(막힘.targetBase).toBe(-1)

    // 도루 판 b297a — 1~4 야수는 루 위에 서지만 목표는 시작 자리에 남는다
    const 시작 = stealPlayEngineInputOf({ bases: { ...EMPTY_BASES, first: true }, stealingFrom: [1], outs: 0, scene: 남김(5) })
    for (const slot of [1, 2, 3, 4]) {
      expect(시작.fielders[slot]?.target).toEqual(FIELDER_START_POSITIONS[slot])
      expect(시작.fielders[slot]?.arrivalSlackTicks).toBe(5)
    }
  })

  it('도루 판(1 · 3루, 1루 도루) — +0xcc 가 늦게 보이는 야수(vtc0)를 보고 3루 주자가 판 시작에 홈으로 뛰어 잡힌다', () => {
    const 도루 = (scene?: DefenseScene) =>
      runStealPlay({
        bases: { ...EMPTY_BASES, first: true, third: true },
        stealingFrom: [1],
        outs: 0,
        runAbility: 200,
        random: createSeededRandom(1),
        defenseIsCpu: true,
        scene,
      })
    expect(도루().resultCode).toBeNull()
    const 남은판 = 도루(남김(5))
    expect(남은판.log).toContain('판 시작 2번 주자 자동 진루 → 4루')
    expect(남은판.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
  })

  it('폭투 판 — 예보 복제도 +0xcc 를 베껴 포수가 6 틱 늦게 쥔다', () => {
    const 폭투 = (scene?: DefenseScene) =>
      runPassedBallPlay({
        shot: passedBallShot(createSeededRandom(7)),
        bases: { ...EMPTY_BASES, first: true },
        outs: 0,
        random: createSeededRandom(1),
        defenseIsCpu: true,
        scene,
      })
    expect(폭투().log).toContain('18틱 1번 야수가 공을 쥐었다')
    expect(폭투(남김(5)).log).toContain('24틱 1번 야수가 공을 쥐었다')
  })

  it('견제 · 밀어내기 판 — 결과는 같고, 목록 틱이 줄인 나머지를 다음 판으로 넘긴다', () => {
    const 견제 = (scene?: DefenseScene) =>
      runPickoffPlay({
        targetBase: 1,
        bases: { ...EMPTY_BASES, first: true },
        outs: 0,
        random: createSeededRandom(1),
        defenseIsCpu: true,
        scene,
      })
    const 그냥 = 견제()
    const 남은판 = 견제(남김(5))
    expect(남은판.resultCode).toBe(그냥.resultCode)
    expect(남은판.ticks[0]?.fielders).not.toEqual(그냥.ticks[0]?.fielders)
    expect(남은판.scene.fielderSlack).toEqual(Array.from({ length: 9 }, () => 0))

    const 밀어내기 = runWalkPlay({ bases: { ...EMPTY_BASES, first: true }, outs: 0, pitchJudgement: 3, scene: 남김(5) })
    expect(밀어내기.scene.fielderSlack).toEqual(Array.from({ length: 9 }, () => 0))
  })
})

describe('vt14 관문 — 커버 b25b6 · 커버 가져가기 vt48 도 잠금 · vtc8 이 막으면 목표를 안 받는다 (r196)', () => {
  const 커버 = { ran: true, covers: [1, 2, 3, 4], secondBaseHelper: -1, secondBaseCover: 3, idleSlots: [], coverStates: [{ slot: 2, base: 1 }] }
  it('AI 는 늘 루 + 2, 목표는 관문이 열릴 때만 루 좌표', () => {
    const 열림 = applyCoverAssignment(야수들, { ...커버, fielders: 야수들 })[2]
    expect(열림).toMatchObject({ aiState: AI_STATE.COVER_FIRST, target: basePosition(1), targetBase: 1 })
    const 남은 = 야수들.map((fielder) => ({ ...fielder, arrivalSlackTicks: 4 }))
    const 막힘 = applyCoverAssignment(남은, { ...커버, fielders: 남은 })[2]
    expect(막힘?.aiState).toBe(AI_STATE.COVER_FIRST)
    expect(막힘?.target).toEqual(FIELDER_START_POSITIONS[2])

    const play = { ...initialPlayView(5), coverOfBase: [1, 2, 3, 4] }
    const 가져감 = claimCoverOfBase(play, 남은, 6, 1).fielders[6]
    expect(가져감?.aiState).toBe(AI_STATE.COVER_FIRST)
    expect(가져감?.target).toEqual(FIELDER_START_POSITIONS[6])
  })
})

describe('움직임 허용 +0x13c — 예보 머리 b1376 이 `a ≠ 0 || 공+0xaac` 로, 두 번째 패스 b189a 가 1 로 적는다 (r196)', () => {
  const 공 = battedBallTrajectory([180, 40, 600, 1])
  it('판 시작 예보 vt24(1)은 참 · 보통 송구 예보 vt24(0)은 거짓 · 악송구 · 원바운드는 참', () => {
    expect(forecastCatch(공, 야수들, { from: 0, to: Number.POSITIVE_INFINITY }).movable).toBe(true)
    const 보통 = forecastCatch(공, 야수들, { from: 0, to: Number.POSITIVE_INFINITY }, { secondPass: { movable: false } })
    expect(보통.movable).toBe(보통.secondPassStarted)
    expect(
      forecastCatch(공, 야수들, { from: 0, to: Number.POSITIVE_INFINITY }, { secondPass: { movable: true } }).movable,
    ).toBe(true)
  })
})
