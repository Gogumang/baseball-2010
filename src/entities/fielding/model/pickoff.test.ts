import { describe, expect, it } from 'vitest'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, createFielders } from '@/entities/fielding/model/fieldingState'
import {
  isPickoffCover,
  PICKOFF_COVER_OF_BASE,
  PICKOFF_PLAY_KIND,
  pickoffThrowBase,
  RUNNER_LEAD_DISTANCE,
  startPickoff,
} from '@/entities/fielding/model/pickoff'
import {
  PASSED_BALL_CATCHER_ACTION,
  PASSED_BALL_PLAY_KIND,
  PASSED_BALL_THRESHOLD,
  PASSED_BALL_VERTICAL_SPEED,
  passedBallShot,
  rollPassedBall,
  startsPassedBallPlay,
} from '@/entities/fielding/model/passedBall'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

describe('견제 — 플레이 종류 4 · AI 상태 0xe (0xb28be · 0xb47da)', () => {
  it('루 커버가 "루 번호 + 1" 로 고정된다 — 2루 견제도 늘 2루수(3)가 받는다', () => {
    expect(PICKOFF_COVER_OF_BASE).toEqual([1, 2, 3, 4])
    expect(isPickoffCover(야수들[3], 2)).toBe(true)
    expect(isPickoffCover(야수들[5], 2)).toBe(false) // 유격수 선택이 없다
  })

  it('투수가 공을 쥔 채 시작하고 상태 0xe 가 된다', () => {
    const 시작 = startPickoff(1)
    expect(시작.play.kind).toBe(PICKOFF_PLAY_KIND)
    expect(시작.play.ballHolderSlot).toBe(0)
    expect(시작.play.held).toBe(true)
    expect(시작.play.everHeld).toBe(true)
    expect(시작.ballOnGround).toBe(true)
    expect(시작.pitcherAiState).toBe(AI_STATE.PICKOFF)
    expect(시작.coverTargets.get(3)).toEqual(basePosition(2))
  })

  it('상태 0xe 는 state[0x27] 루로 던진다 (플레이+0x127 이 아니다 — S8 정정 2)', () => {
    expect(pickoffThrowBase(2)).toBe(2)
    expect(startPickoff(2).play.manualThrowBase).toBe(2)
  })

  it('**주자 리드 폭이라는 값이 원본에 없다** — 주자는 루 좌표에 정확히 선다', () => {
    expect(RUNNER_LEAD_DISTANCE).toBe(0)
  })
})

describe('state[0x19] 0.1% 사건 — 포수 뒤로 빠진 공 (S8 5절)', () => {
  it('문턱은 10 이고 rand(0,10000) 과 견준다 (≈0.1%)', () => {
    expect(PASSED_BALL_THRESHOLD).toBe(10)
    expect(rollPassedBall(1, 고정(0.0009))).toBe(true)
    expect(rollPassedBall(1, 고정(0.001))).toBe(false)
  })

  it('홈런더비(모드 7)에서는 굴리지 않는다', () => {
    expect(rollPassedBall(7, 고정(0))).toBe(false)
  })

  it('볼넷·사구로 끝난 투구는 이 판을 열지 않는다', () => {
    expect([1, 2, 5].map(startsPassedBallPlay)).toEqual([true, true, true])
    expect([3, 4].map(startsPassedBallPlay)).toEqual([false, false])
  })

  it('무작위 각 60~130 · 세기 160~280 · 수직 −100 으로 공을 쏜다', () => {
    expect(passedBallShot(고정(0))).toEqual({ angle: 60, strength: 160, verticalSpeed: -100 })
    expect(passedBallShot(고정(0.999)).angle).toBeLessThanOrEqual(130)
    expect(passedBallShot(고정(0.999)).strength).toBeLessThanOrEqual(280)
    expect(PASSED_BALL_VERTICAL_SPEED).toBe(-100)
  })

  it('플레이 종류 9 · 포수 동작 6(에러) 으로 넘어간다', () => {
    expect(PASSED_BALL_PLAY_KIND).toBe(9)
    expect(PASSED_BALL_CATCHER_ACTION).toBe(6)
  })
})
