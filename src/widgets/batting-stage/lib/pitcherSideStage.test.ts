import { describe, expect, it } from 'vitest'
import {
  HUMAN_PITCH_RELEASE_STATE_TICK,
  passesHeldResult,
  pitcherSideStageFrameOf,
} from '@/widgets/batting-stage/lib/pitcherSideStage'
import { PITCHER_RELEASE_TICKS } from '@/widgets/batting-stage/lib/stageScenery'

const clock = (nowTick: number, releaseTick: number | null) => ({
  nowTick,
  releaseTick,
  frameCount: 20,
  resultTicks: 15,
  isPaused: false,
  pausedSinceTick: 0,
})

describe('사람이 던지는 타석 장면 — 놓은 틱(0x11 틱 10)에서 거꾸로 0x11 · 0x12 를 다시 돈다', () => {
  it('던진 공이 없으면 대기 — 투수는 대기 동작, 공 없음', () => {
    expect(pitcherSideStageFrameOf(clock(100, null))).toEqual({
      phase: { kind: '대기', tick: 0, isPaused: false },
      ballFrame: -1,
      pitcherTick: null,
    })
  })

  it('놓은 틱의 상태 틱은 10 — 공 틱은 투수 단계가 릴리스에 닿은 틱부터 오른다', () => {
    const frame = pitcherSideStageFrameOf(clock(50, 50))
    expect(frame.phase.kind).toBe('투구중')
    expect(frame.pitcherTick).toBe(HUMAN_PITCH_RELEASE_STATE_TICK)
    expect(frame.ballFrame).toBe(HUMAN_PITCH_RELEASE_STATE_TICK - PITCHER_RELEASE_TICKS)
  })

  it('공 틱 N + 1 에서 0x12 로 — 0x12 대기 틱 동안 결과, 그 뒤 대기', () => {
    const release = 50
    const atFlightEnd = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 21
    expect(pitcherSideStageFrameOf(clock(atFlightEnd - 1, release)).phase.kind).toBe('투구중')
    expect(pitcherSideStageFrameOf(clock(atFlightEnd, release)).phase).toEqual({
      kind: '결과',
      tick: 0,
      isPaused: false,
      isInPlay: false,
    })
    expect(pitcherSideStageFrameOf(clock(atFlightEnd + 14, release)).phase.kind).toBe('결과')
    expect(pitcherSideStageFrameOf(clock(atFlightEnd + 15, release)).phase.kind).toBe('대기')
  })

  it('맞은 공(0x12 를 안 지남)은 비행 뒤 곧장 대기', () => {
    const release = 50
    const atFlightEnd = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 21
    expect(pitcherSideStageFrameOf({ ...clock(atFlightEnd, release), resultTicks: 0 }).phase.kind).toBe('대기')
  })

  it('쉬는 대기(0xd · 0xe)는 쉬기 시작한 뒤 틱을 센다', () => {
    expect(pitcherSideStageFrameOf({ ...clock(30, null), isPaused: true, pausedSinceTick: 22 }).phase).toEqual({
      kind: '대기',
      tick: 8,
      isPaused: true,
    })
  })

  it('0x12 를 지나는 판정 — 맞히지 못한 공만', () => {
    expect(passesHeldResult({ kind: '볼' })).toBe(true)
    expect(passesHeldResult({ kind: '스트라이크', isSwinging: true })).toBe(true)
    expect(passesHeldResult({ kind: '사구' })).toBe(true)
    expect(passesHeldResult({ kind: '파울' })).toBe(false)
  })
})
