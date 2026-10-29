/**
 * '대기'(0xf · 0x10) 갱신 — 0xf(9 그림) + 0x10(7 그림) 뒤 0x11. 틱으로 센다 (`PRE_PITCH_TICKS`). CPU 투구 굴림은 원본 틱 차례로 나눠
 * 그 틱의 파티클 틱(프레임 끝 0x6de84)보다 앞에 굴린다 — 조작 0x498d4 는 매 틱 그리기보다 먼저 돈다:
 *   0xf 틱 0~8 구질 0x344dc(틱마다 한 번) · 0x10 틱 6 목표 0x345fc(또는 견제) · 0x11 틱 10 놓기 0x4dc78
 */
import { CPU_PITCH_TYPE_TICKS, cpuPitchAimOf, cpuPitchTypeTickOf, windUpCpuPitchOf } from '@/entities/pitching/model/selectPitch'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { SCENE_STATE, cancelSceneStateEntriesAfter, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { PRE_PITCH_TICKS } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import { clearSceneResultCodeOnPitch, sceneResultCodeNow } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { cpuPitchArgsNow } from '@/widgets/batting-stage/model/stageAnimation/cpuPitchArgs'
import type { CpuPitchCycle, StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/** 0x10 의 목표 고르기 틱 — 0x53824 는 상태 틱 > 5 인 첫 틱(6)에 0x645 를 보낸다 */
const CPU_AIM_TICK_IN_0X10 = 6
/** 대기 셈이 미리 적는 상태 — 0xf · 0x10 · 0x11 (`sceneStateEntries`) */
export const PRE_PITCH_STATES: readonly number[] = [SCENE_STATE.선택, SCENE_STATE.조준, SCENE_STATE.투구]
/** 마투수 순번 0xb63a1 — 붕붕머신(XlsACE_PIT_DATA +0x18 = 7, 순번 = 번호 − 5) */
const BOONGBOONG_MACHINE_ORDER = 2

/** '대기' 한 틀 — 0x11 에 들었으면 true(같은 틀의 0x11 갱신으로 이어 간다), 아니면 false */
export function advanceWaiting(loop: StageLoop, sceneTick: number): boolean {
  const { phaseStartTickRef, latestRef } = loop.refs
  if (latestRef.current.isPaused) {
    holdPause(loop, sceneTick)
    return false
  }
  if (loop.hasSeenPause) resumeAfterPause(loop)
  // 0xf 가 아직 안 섰다 — 이 틀은 쉬던 상태 그대로다
  if (sceneTick < phaseStartTickRef.current) return false
  const tick = sceneTick - phaseStartTickRef.current
  const cycle = cpuPitchCycleNow(loop)
  rollPitchTypes(loop, cycle, tick)
  if (aimCpuPitch(loop, cycle, tick, sceneTick)) return false
  if (tick < PRE_PITCH_TICKS || cycle.target === null) return false
  enterPitch(loop, { typeNumber: cycle.typeNumber, target: cycle.target }, sceneTick)
  return true
}

/**
 * 쉬는 동안에도 좌우 이동(+0xfe4)은 그대로 둔다 — 지우는 곳은 0xd 진입 48f88 하나(`shiftResetSerial`, BattingStage).
 * 같은 타석의 다음 공은 0xae3e8 → 0xf 로 가 0xd 를 안 지난다
 */
function holdPause(loop: StageLoop, sceneTick: number): void {
  loop.refs.phaseStartTickRef.current = sceneTick
  // 쉬는 동안은 0xf · 0x10 · 0x11 이 안 선다 — 대기 셈이 미리 적어 둔 예약을 거둔다(지난 칸 · 확인 대기가 적은 0xd · 0xe 는 남는다)
  cancelSceneStateEntriesAfter(sceneTick, PRE_PITCH_STATES)
  loop.hasSeenPause = true
}

/**
 * 쉬기가 풀렸다 — 푼 틀(견제 판 끝 0x17 의 0xf 예약 · 0xe 키 처리의 메시지 1 → 0x50c18 의 0xf 예약)의 다음 틀이 0xf 틱 0 이다
 * (0xbcb48 → 0xbc9c8). 예전에는 마지막으로 쉰 틀을 틱 0 으로 셌다 — 한 틀 일렀다
 */
function resumeAfterPause(loop: StageLoop): void {
  const { phaseStartTickRef, resumeTickRef } = loop.refs
  loop.hasSeenPause = false
  const resumeTick = resumeTickRef.current
  resumeTickRef.current = null
  if (resumeTick !== null) phaseStartTickRef.current = Math.max(phaseStartTickRef.current, resumeTick + 1)
}

/** 이번 0xf~0x10 의 굴림 칸 — 대기에 든 장면 틱이 바뀌었으면 새로 세우고 상태 경계를 적는다 */
function cpuPitchCycleNow(loop: StageLoop): CpuPitchCycle {
  const start = loop.refs.phaseStartTickRef.current
  if (loop.cpuPitchCycle !== null && loop.cpuPitchCycle.startTick === start) return loop.cpuPitchCycle
  const cycle: CpuPitchCycle = { startTick: start, typeRolls: 0, typeNumber: 0, target: null }
  loop.cpuPitchCycle = cycle
  // 상태 경계 — 0xf 가 선 틱이 0, 0x39c1c 가 틱 8 에 0x10 을 예약해 틱 9 에, 0x39c5c 가 0x10 틱 6 에 0x11 을 예약해 틱 16 에 선다
  markSceneStateEntries(
    { tick: start, state: SCENE_STATE.선택 },
    { tick: start + CPU_PITCH_TYPE_TICKS, state: SCENE_STATE.조준 },
    { tick: start + PRE_PITCH_TICKS, state: SCENE_STATE.투구 },
  )
  return cycle
}

/** 0xf 틱 0~8 구질 0x344dc — 그림을 건너뛴 틱도 센다(따라잡기) */
function rollPitchTypes(loop: StageLoop, cycle: CpuPitchCycle, tick: number): void {
  const { random } = loop.refs.latestRef.current
  while (cycle.typeRolls < Math.min(CPU_PITCH_TYPE_TICKS, tick + 1)) {
    cycle.typeNumber = cpuPitchTypeTickOf(cpuPitchArgsNow(loop), random)
    cycle.typeRolls += 1
  }
}

/** 0x10 틱 6 — 목표 0x345fc(또는 견제)를 굴린다. 견제면 true */
function aimCpuPitch(loop: StageLoop, cycle: CpuPitchCycle, tick: number, sceneTick: number): boolean {
  if (cycle.target !== null || tick < CPU_PITCH_TYPE_TICKS + CPU_AIM_TICK_IN_0X10) return false
  const { pitchRef, phaseStartTickRef, latestRef } = loop.refs
  const aim = cpuPitchAimOf(cpuPitchArgsNow(loop), latestRef.current.random)
  if (aim.kind !== '견제') {
    cycle.target = aim.target
    return false
  }
  // 0x34848 → 메시지 0x10: 공을 안 던진다(상태 0x11 예약 0x34888 을 안 지난다).
  // 견제 판(상태 0x17)이 끝나면 원본은 같은 타석 다음 공(0xf)으로 돌아온다 — 여기서는 다시 대기로 둔다
  pitchRef.current = null
  phaseStartTickRef.current = sceneTick
  // 0x10 갱신이 견제 판(0x17)을 예약했다 — 다음 틀이 0x17 틱 0 이다(0x11 예약 자리를 지운다)
  markSceneStateEntries({ tick: sceneTick + 1, state: SCENE_STATE.인플레이 })
  latestRef.current.onPickoff?.(aim.base)
  return true
}

/** 0x11 진입 — 놓기(틱 10) 전에는 와인드업 자리만 세운다 (`windUpCpuPitchOf`) */
function enterPitch(loop: StageLoop, release: NonNullable<StageLoop['releasePending']>, sceneTick: number): void {
  const { refs } = loop
  refs.pitchRef.current = windUpCpuPitchOf(cpuPitchArgsNow(loop), release.typeNumber, release.target)
  refs.pitchTypeNumberRef.current = release.typeNumber
  loop.releasePending = release
  // 0x11 진입 0x3de10 — 스윙 예약 · 판정 칸(+0xfd8 · +0xfe0 · +0xfe5)을 공마다 지운다
  refs.swingRef.current = null
  refs.pitchJudgedRef.current = false
  refs.heldResultRef.current = null
  // 새 투구가 시작하면 홈런 글자 연출을 끈다 (원본 +0x1960 을 다음 플레이가 지우는 자리)
  refs.homeRunStartTickRef.current = null
  refs.phaseRef.current = '투구중'
  refs.phaseStartTickRef.current = sceneTick
  markSceneStateEntries({ tick: sceneTick, state: SCENE_STATE.투구 })
  // 3de7c — 투수 그림 객체 상태 1(투구 동작)
  refs.pitcherStartTickRef.current = sceneTick
  loop.pitcherTickEnd = null
  // 3de42~3de66 — 0x11 진입: 구질 +0xfc8 == 22 이고 수비 팀 지금 투수의 순번 0xb63a1 == 2(붕붕머신)면 파티클 관리자를
  // 비운다(0x6dee4, 굴림 없음). 이 프레임의 파티클 틱보다 앞이다
  if (release.typeNumber === MAGIC_PITCH_TYPE_NUMBER && refs.latestRef.current.acePitcher?.order === BOONGBOONG_MACHINE_ORDER) {
    clearParticles(refs.particlesRef.current)
  }
  // 3deea — 0x11 진입이 +0xfd4 를 0 으로 지운다(0xfe0 − 0xc 로 만든 주소라 `xval 0xfd4` 에 안 잡혔다 — r100 정정)
  clearSceneResultCodeOnPitch()
  loop.resultCodeBeforePitch = sceneResultCodeNow()
  loop.judgedResultCode = null
}
