import { describe, expect, it } from 'vitest'
import {
  cpuSwingTickOf,
  hitEndTickOf,
  HUMAN_PITCH_RELEASE_STATE_TICK,
  pitchHitSceneTicksOf,
  pitcherHitContactOf,
  pitcherHitSceneOf,
  passesHeldResult,
  pitchSceneBusyTicksOf,
  pitchResultEntryDelayTicksOf,
  pitchSelectionEntryDelayTicksOf,
  pitcherSideStageFrameOf,
  pitcherSideStateEntriesOf,
} from '@/widgets/batting-stage/lib/pitcherSideStage'
import { PITCHER_RELEASE_TICKS, pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { SHORT_HIT_TICKS } from '@/widgets/batting-stage/lib/hitPause'
import { HIT_PARTICLE_IMAGE } from '@/widgets/batting-stage/lib/hitParticles'

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
      pitcherTickEnd: null,
    })
  })

  it('놓은 틱의 상태 틱은 10 — 공 틱은 투수 단계가 릴리스에 닿은 틱부터 오른다', () => {
    const frame = pitcherSideStageFrameOf(clock(50, 50))
    expect(frame.phase.kind).toBe('투구중')
    expect(frame.pitcherTick).toBe(HUMAN_PITCH_RELEASE_STATE_TICK)
    expect(frame.ballFrame).toBe(HUMAN_PITCH_RELEASE_STATE_TICK - PITCHER_RELEASE_TICKS)
  })

  // 공 틱 N + 1(= 21)의 갱신이 0x12 를 예약하고(0x4e24e → 4e26c 0xbcb49) 다음 틀 머리 0xbc9c8 에서 0x12 틱 0 이 선다
  it('공 틱 N + 1 이 0x12 를 예약하고 다음 틀이 0x12 틱 0 — 0x12 대기 틱 동안 결과, 그 뒤 대기', () => {
    const release = 50
    const atFlightEnd = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 21
    const atEntry = atFlightEnd + 1
    expect(pitcherSideStageFrameOf(clock(atFlightEnd, release)).phase.kind).toBe('투구중')
    expect(pitcherSideStageFrameOf(clock(atEntry, release)).phase).toEqual({
      kind: '결과',
      tick: 0,
      isPaused: false,
      isInPlay: false,
    })
    // 0x4e6d4 4e72c — 틱 < 문턱 15 면 기다리고, 틱 15 의 갱신이 다음 상태를 예약한다 — 0x12 는 틱 0 ~ 15 의 16 그림
    expect(pitcherSideStageFrameOf(clock(atEntry + 15, release)).phase.kind).toBe('결과')
    expect(pitcherSideStageFrameOf(clock(atEntry + 16, release)).phase.kind).toBe('대기')
  })

  it('0x12 에도 투수 틱이 이어진다 — 다음 0xf 진입(대기)까지 투수 그림 객체가 상태 1 의 마지막 자세다', () => {
    const release = 50
    const atEntry = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 22
    expect(pitcherSideStageFrameOf(clock(atEntry + 3, release)).pitcherTick).toBe(
      atEntry + 3 - release + HUMAN_PITCH_RELEASE_STATE_TICK,
    )
    expect(pitcherSideStageFrameOf(clock(atEntry + 16, release)).pitcherTick).toBeNull()
  })

  it('투수 단계는 공 틱 N + 1 의 0x4e060 갱신(0x12 를 예약한 틀)까지만 센다 — 0x12 에서는 그 틱에 굳는다 (0x9e004 는 0xf · 0x11 에서만)', () => {
    const release = 50
    const atFlightEnd = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 21
    const endStateTick = atFlightEnd - release + HUMAN_PITCH_RELEASE_STATE_TICK
    expect(pitcherSideStageFrameOf(clock(atFlightEnd, release)).pitcherTickEnd).toBeNull()
    expect(pitcherSideStageFrameOf(clock(atFlightEnd + 1, release)).pitcherTickEnd).toBe(endStateTick)
    expect(pitcherSideStageFrameOf(clock(atFlightEnd + 10, release)).pitcherTickEnd).toBe(endStateTick)
  })

  it('마투수는 공 틱이 0xcfbe4[순번] 단계에서 오른다 — 싸이커(0)는 상태 틱 20', () => {
    const frame = pitcherSideStageFrameOf({ ...clock(50, 50), aceOrder: 0 })
    expect(frame.ballFrame).toBe(HUMAN_PITCH_RELEASE_STATE_TICK - pitcherReleaseTicksOf(0))
    expect(pitcherReleaseTicksOf(0)).toBe(20)
    expect(cpuSwingTickOf(50, 3, 0) - cpuSwingTickOf(50, 3)).toBe(20 - PITCHER_RELEASE_TICKS)
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

  it('CPU 스윙은 공 틱이 스윙 프레임 F 에 닿는 장면 틱에 건다 (0x4e0dc)', () => {
    const release = 50
    const swingTick = cpuSwingTickOf(release, 18)
    expect(pitcherSideStageFrameOf(clock(swingTick, release)).ballFrame).toBe(18)
  })

  it('공 하나의 상태 경계 — 0x11 은 놓은 틱 − 10, 0x12 는 공 틱 N + 2 의 틀, 그 끝은 문턱 + 1 그림 뒤 (바쁜 틱과 같은 끝)', () => {
    const release = 50
    const entries = pitcherSideStateEntriesOf(release, 20, 15)
    const resultEntry = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 22
    expect(entries).toEqual([
      { tick: release - HUMAN_PITCH_RELEASE_STATE_TICK, state: 0x11 },
      { tick: resultEntry, state: 0x12 },
      { tick: resultEntry + 16, state: 0xf },
    ])
    expect(pitcherSideStageFrameOf(clock(resultEntry, release)).phase.kind).toBe('결과')
    expect(release + pitchSceneBusyTicksOf(20, 15)).toBe(resultEntry + 16)
    // 타석을 끝낸 공(문턱 31)은 0xd 로
    expect(pitcherSideStateEntriesOf(release, 20, 31).at(-1)).toEqual({ tick: resultEntry + 32, state: 0xd })
    // 맞은 공은 0x11 만
    expect(pitcherSideStateEntriesOf(release, 20, 0)).toEqual([{ tick: release - HUMAN_PITCH_RELEASE_STATE_TICK, state: 0x11 }])
  })
})

describe('CPU 타자가 맞힌 공 — 판정 틀(스윙 F + 1)까지 0x11, 다음 틀이 0x13 틱 0, 0x13 끝의 다음 틀이 0x17', () => {
  const release = 50
  const hit = { judgeBallTick: 13, ticks: 8 }
  const hitClock = (nowTick: number) => ({ ...clock(nowTick, release), resultTicks: 0, hit })
  const judgeTick = release - HUMAN_PITCH_RELEASE_STATE_TICK + PITCHER_RELEASE_TICKS + 13

  it('판정 틀까지는 공이 난다 — 다음 틀이 0x13(타격) 틱 0, 투수는 판정 틀에 굳는다', () => {
    expect(pitcherSideStageFrameOf(hitClock(judgeTick)).phase.kind).toBe('투구중')
    expect(pitcherSideStageFrameOf(hitClock(judgeTick)).ballFrame).toBe(13)
    const entry = pitcherSideStageFrameOf(hitClock(judgeTick + 1))
    expect(entry.phase).toEqual({ kind: '타격', tick: 0, isPaused: false })
    expect(entry.ballFrame).toBe(-1)
    expect(entry.pitcherTickEnd).toBe(PITCHER_RELEASE_TICKS + 13)
    // 0x13 은 틱 0 ~ 8 의 아홉 그림 — 그 뒤(0x17)도 마지막 그림에 둔다(화면이 수비 판으로 넘긴다)
    expect(pitcherSideStageFrameOf(hitClock(judgeTick + 9)).phase).toEqual({ kind: '타격', tick: 8, isPaused: false })
    expect(pitcherSideStageFrameOf(hitClock(judgeTick + 30)).phase).toEqual({ kind: '타격', tick: 8, isPaused: false })
  })

  it('상태 경계 — 0x11 · 0x13 · 0x17, 수비 판을 띄우는 틱과 같다', () => {
    expect(pitcherSideStateEntriesOf(release, 20, 0, null, hit)).toEqual([
      { tick: release - HUMAN_PITCH_RELEASE_STATE_TICK, state: 0x11 },
      { tick: judgeTick + 1, state: 0x13 },
      { tick: judgeTick + 1 + 9, state: 0x17 },
    ])
    expect(release + pitchHitSceneTicksOf(hit)).toBe(judgeTick + 1 + 9)
  })

  it('OK · 5 건너뛰기를 읽은 0x13 틱에 0x17 을 예약한다 (0x406e8 40708)', () => {
    expect(hitEndTickOf({ ...hit, ticks: 30, skipTick: 4 })).toBe(4)
    expect(hitEndTickOf({ ...hit, ticks: 3, skipTick: 4 })).toBe(3)
    // 문턱이 0 아래면 진입 틀(0)이 넘긴다
    expect(hitEndTickOf({ ...hit, ticks: -5 })).toBe(0)
  })

  it('큰 타구 멈춤 중 창이 선 첫 그림([창+0x250])이 [+0x10a8] 을 한 번 더 줄이면 막음이 일찍 풀려 0x17 도 그만큼 이르다 (r178)', () => {
    // 창 그림이 없으면 문턱 그대로 · 0x13 틱 3 뒤 창 그림 하나 — 막음을 틱 6 그림이 푼다
    expect(hitEndTickOf({ ...hit, ticks: 30 })).toBe(30)
    expect(hitEndTickOf({ ...hit, ticks: 30, frozenDraws: [3] })).toBe(29)
    // 건너뛰기 틱이 더 이르면 그 틱
    expect(hitEndTickOf({ ...hit, ticks: 30, frozenDraws: [3], skipTick: 4 })).toBe(4)
  })

  it('판정 공 틱 — 스윙은 F + 1(스윙이 나간 다음 틀), 번트는 N − 1 (0x4e15c)', () => {
    const pattern = [90, 900, 300, 0] as const
    const contact = { pattern, resultCode: 10 }
    expect(pitcherHitSceneOf(contact, { frame: 15, buntKind: 0 }, 20, 0).judgeBallTick).toBe(16)
    expect(pitcherHitSceneOf(contact, { frame: 5, buntKind: 2 }, 20, 0).judgeBallTick).toBe(19)
    // 0x13 길이는 타자편과 같은 셈(`hitPauseTicksOf`)
    const scene = pitcherHitSceneOf(contact, { frame: 15, buntKind: 0 }, 20, 0)
    expect(scene.ticks).toBeLessThanOrEqual(SHORT_HIT_TICKS)
    expect(scene.watchesBigHit).toBe(false)
  })

  it('필살 스윙으로 맞은 공은 보통 불꽃 대신 필살 파티클을 쏜다 (0x49aec 가 [sp+0x60] 을 세운다)', () => {
    const contact = { pattern: [90, 1300, 300, 0] as const, resultCode: 10, specialSwing: { number: 1, isAceBatter: false } }
    const special = pitcherHitSceneOf(contact, { frame: 15, buntKind: 0 }, 20, 0)
    expect(special.specialSwing).toEqual({ number: 1, isAceBatter: false })
    expect(special.resultCode).toBe(10)
    // 번호 1 파워 스윙 — effect_power 그림 · 002.ptc(id 1, img 6)
    const contactOut = pitcherHitContactOf(special, 0, null, 0)
    expect(contactOut.effect?.folder).toBe('./sprites/effect_power/frames')
    expect(contactOut.particles).toEqual([{ id: 1, img: 6, offsetY: 0 }])
    // 마타자(순번 3 크라이져) — 번호를 안 보고 점프표 0xd01e4
    const ace = pitcherHitSceneOf({ ...contact, specialSwing: { number: 0, isAceBatter: true } }, { frame: 15, buntKind: 0 }, 20, 0)
    expect(pitcherHitContactOf(ace, 0, 3, 0).particles).toEqual([{ id: 20, img: 5, offsetY: 25 }])
    // 필살이 아니면 보통 불꽃
    const plain = pitcherHitSceneOf({ ...contact, specialSwing: undefined }, { frame: 15, buntKind: 0 }, 20, 0)
    expect(plain.particleId).toBe(5)
    expect(pitcherHitContactOf(plain, 0, null, 0)).toEqual({ effect: null, particles: [{ id: 5, img: HIT_PARTICLE_IMAGE, offsetY: 0 }] })
  })

  it('번트로 맞은 공은 보통 불꽃 · ptc 가 없다 — 49faa 스윙 객체 S+8(번트 자세) ≠ 0 (r215)', () => {
    const contact = { pattern: [90, 1300, 300, 0] as const, resultCode: 10 }
    const bunt = pitcherHitSceneOf(contact, { frame: 5, buntKind: 2 }, 20, 0)
    expect(bunt.isBuntStance).toBe(true)
    expect(pitcherHitContactOf(bunt, 0, null, 0)).toEqual({ effect: null, particles: [] })
    expect(pitcherHitSceneOf(contact, { frame: 15, buntKind: 0 }, 20, 0).isBuntStance).toBe(false)
  })
})

describe('사람이 던진 공의 틀 셈 (`PitchStepSoundTiming`)', () => {
  it('0xf 진입 틀은 장면이 다시 대기로 돌아오는 틀과 같다 — 0x12 틱 0 에서 문턱 + 1 뒤 (0x4e6d4 → 0x3d954)', () => {
    for (const frameCount of [20, 26, 31]) {
      for (const resultTicks of [0xf, 0x1f]) {
        expect(pitchSelectionEntryDelayTicksOf(frameCount, resultTicks)).toBe(pitchSceneBusyTicksOf(frameCount, resultTicks))
        expect(pitchSelectionEntryDelayTicksOf(frameCount, resultTicks)).toBe(
          pitchResultEntryDelayTicksOf(frameCount) + resultTicks + 1,
        )
      }
    }
  })
})
