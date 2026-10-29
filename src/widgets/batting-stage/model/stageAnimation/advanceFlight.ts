/** 0x11('투구중') 갱신 — 놓기(틱 10, 0x4dc78) · 투구 순간 소리(0x3f378) · 날아가는 공의 예약 풀기 · 판정 · 공 끝(0x4e060) */
import { releaseCpuPitch } from '@/entities/pitching/model/selectPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import { activeSound } from '@/shared/api/audio/soundPort'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { isBuntJudgeFrame } from '@/widgets/batting-stage/lib/buntStance'
import { isBallInSwingReach, nextFlightEvent, swingReleaseTickOf, type FlightEvent } from '@/widgets/batting-stage/lib/swingWindow'
import { ballFrameOf, ballFrameStartTick, type SwingReservation } from '@/widgets/batting-stage/model/stageRefs'
import { writeSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { cpuPitchArgsNow } from '@/widgets/batting-stage/model/stageAnimation/cpuPitchArgs'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/** 0x11 의 공 놓기 틱 — 0x4e078 은 상태 틱 > 9 인 첫 틱(10)에 0x4dc78 을 부른다 */
export const CPU_RELEASE_TICK_IN_0X11 = 10

/** 0x11 틱 10 — 0x4dc78: 제구 등급 · 제구 오차 · 실투 · 곡선을 굴려 와인드업 자리를 진짜 공으로 바꾼다. 아직 놓기 전이면 false(이 틀 갱신 끝) */
export function releasePendingPitch(loop: StageLoop, sceneTick: number): boolean {
  const { phaseRef, phaseStartTickRef, pitchRef, pitchTypeNumberRef, latestRef } = loop.refs
  const pending = loop.releasePending
  if (phaseRef.current !== '투구중' || pending === null) return true
  if (sceneTick - phaseStartTickRef.current < CPU_RELEASE_TICK_IN_0X11) return false
  const choice = releaseCpuPitch(cpuPitchArgsNow(loop), pending.typeNumber, pending.target, latestRef.current.random)
  loop.releasePending = null
  // 4de9c +8 = 0 · 4deae 실투면 +8 = 4 — 공마다 다시 적는다
  loop.mistakeMarkPitch = choice.isMistakePitch ? choice.pitch : null
  pitchRef.current = choice.pitch
  pitchTypeNumberRef.current = choice.pitchTypeNumber
  return true
}

/**
 * 투구 순간 소리 12 / 28 (0x3f378) — 공 프레임이 서는 틱(릴리스 단계 도달, `ballFrameAt` 0)에 한 번.
 * 사람이 칠 때 CPU 투수가 던지는 공이다 — 원본 식은 던지는 쪽을 가르지 않는다(사람 투구는 각 진행 고리가 낸다)
 */
function playReleaseSound(loop: StageLoop, pitch: Pitch, frame: number): void {
  if (frame < 0 || loop.releaseSoundPitch === pitch) return
  loop.releaseSoundPitch = pitch
  activeSound().play(
    pitchReleaseSoundIdOf({
      typeNumber: loop.refs.pitchTypeNumberRef.current ?? 0,
      pitcherMagicNumber: pitch.pitcherMagicNumber ?? 0,
      ballMagicNumber: pitch.magicNumber ?? 0,
    }),
  )
}

/** 날아가는 공 한 틀 — 0x4e060 한 갱신의 차례대로. 판정이 0x13 을 예약했거나 공이 끝났으면 true(이 틀 갱신 끝) */
export function advanceFlight(loop: StageLoop, sceneTick: number): boolean {
  const { phaseRef, phaseStartTickRef, pitchRef, swingRef, buntRef, pitchJudgedRef, latestRef } = loop.refs
  const pitch = pitchRef.current
  if (phaseRef.current !== '투구중' || pitch === null) return false
  const frame = ballFrameOf(sceneTick - phaseStartTickRef.current, latestRef.current.acePitcher?.order)
  playReleaseSound(loop, pitch, frame)
  const frameCount = pitch.frameCount
  const zoneDepth = (ZONE_CENTERS[pitch.stageSide] ?? ZONE_CENTERS[0]).z
  // 예약 풀기(F + 1) → 번트 · 스윙 판정(F + 2 · N − 1) → 공 끝(N + 1) (`nextFlightEvent`)
  for (;;) {
    const swing = swingRef.current
    const bunt = buntRef.current
    const event = nextFlightEvent(
      {
        frameCount,
        swing,
        bunt,
        isJudged: pitchJudgedRef.current,
        isInReach: (tick) => isBallInSwingReach(pitch.worldPath, frameCount, tick, zoneDepth),
        // 번트 자세는 공이 N−1 틱에 닿는 그 틱에 깊이 조건 없이 판정한다 (0x4e15c r7 → 0x4e1fe 메시지 0x6aa, 확정)
        isBuntJudgeTick: (at) => bunt !== null && isBuntJudgeFrame(at, frameCount, bunt),
      },
      frame,
    )
    if (event === null) return false
    if (applyFlightEvent(loop, event, swing, sceneTick)) return true
  }
}

/** 사건 하나 — 갱신을 끝내야 하면 true */
function applyFlightEvent(loop: StageLoop, event: FlightEvent, swing: SwingReservation | null, sceneTick: number): boolean {
  const handlers = loop.refs.handlersRef.current
  if (event.kind === '스윙나감' && swing !== null) {
    releaseSwingAt(loop, swing, handlers.releaseSwing)
    return false
  }
  if (event.kind === '판정없는헛스윙' && swing !== null) {
    loop.refs.swingRef.current = { ...swing, isUnjudgedWhiff: true }
    return false
  }
  if (event.kind === '판정') return judgeAt(loop, event, sceneTick, handlers.judgePitch)
  // 0x4e24e — 공 틱 > N 이고 맞지 않았으면 0x12. 이 그림의 0x4e060 이 투수를 마지막으로 센다
  loop.pitcherTickEnd = sceneTick - (loop.refs.pitcherStartTickRef.current ?? sceneTick)
  handlers.endPitch(sceneTick)
  return true
}

/** 0xb9374 — 그림의 스윙도 그 틱부터 */
function releaseSwingAt(loop: StageLoop, swing: SwingReservation, releaseSwing: (swing: SwingReservation) => void): void {
  const { swingRef, swingStartTickRef, phaseStartTickRef, latestRef } = loop.refs
  const released = { ...swing, isReleased: true }
  swingRef.current = released
  swingStartTickRef.current = ballFrameStartTick(swingReleaseTickOf(swing.frame), phaseStartTickRef.current, latestRef.current.acePitcher?.order)
  releaseSwing(released)
}

/** 판정 0x6aa — 맞은 공이면 0x13 을 예약해 true, 헛맞음은 0x11 에 남아 공 끝을 기다린다(false) */
function judgeAt(
  loop: StageLoop,
  event: Extract<FlightEvent, { readonly kind: '판정' }>,
  sceneTick: number,
  judgePitch: StageLoop['refs']['handlersRef']['current']['judgePitch'],
): boolean {
  const { pitchJudgedRef, shiftRef, pitcherStartTickRef, phaseEntryRef, pendingHitRef } = loop.refs
  pitchJudgedRef.current = true
  judgePitch(
    {
      frame: event.frame,
      shift: shiftRef.current,
      buntKind: event.buntKind,
      ...(event.isSpecial ? { isSpecial: true } : {}),
    },
    sceneTick,
  )
  // 0x6aa → 0x5130e 가 판정 결과를 +0xfcc~+0xfd7 에 쓴다 — 맞은 공이면 그 코드, 헛맞음이면 홈런성이 아닌 코드
  const pitcherTickNow = sceneTick - (pitcherStartTickRef.current ?? sceneTick)
  // 맞은 공만 0x13('타격')을 예약한다 — 판정 고리가 방금 예약 칸을 썼다
  const isContact = phaseEntryRef.current?.phase === '타격'
  loop.judgedResultCode = { tick: pitcherTickNow, code: isContact ? (pendingHitRef.current?.detail.resultCode ?? null) : null }
  writeSceneResultCode(loop.judgedResultCode.code)
  if (!isContact) return false
  // 0x6aa 가 0x13 을 예약한 그림 — 이 그림의 0x4e060 이 투수를 마지막으로 센다
  loop.pitcherTickEnd = pitcherTickNow
  return true
}
