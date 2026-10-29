import { type WorldPoint, basePosition } from '@/entities/fielding/model/fieldGeometry'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import type { DefensePlayView, ViewStateInput } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { holderMarkOf } from '@/features/defense-play/model/defensePlayView/holderMark'
import { viewStateOf } from '@/features/defense-play/model/defensePlayView/viewStateOf'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerStates } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import type { RunnerPlayEngineInput } from '@/features/defense-play/model/runnerPlay/types/runnerPlayTypes'

/** **5. 그림** — 판 틱 `at` 의 그림. 판이 G2 에서만 닫힌 그림(`closingListFrame`)은 다음 틱 자리로 한 번 더 찍는다 */
export function snapshotAt(g: RunnerPlayFrame, at: number, fieldersNow: readonly FielderState[]): DefensePlayView {
  return viewStateOf({
    tick: at,
    // 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 보는 +0x84
    previousTargetOf: (index) => g.runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
    ...ballViewOf(g, at),
    fielders: fieldersNow,
    runners: runnerStates(g),
    catchKind: null,
    chaserSlot: g.chase?.slot ?? g.play.ballHolderSlot,
    ...throwViewOf(g, at),
    previousActions: g.previousActions,
    // 머리에서 경기 멈춤(+0x1993)이 서 있던 그림 — 0x3f060 이 3f0a4 에서 돌아가 카메라가 안 움직인다
    cameraFrozen: g.pausedAtHead,
    ...holderMarksViewOf(g),
    ballParticles: ballParticlesOf(g, at),
    ...inputViewOf(g.input),
  })
}

/**
 * 공 칸 — 쫓는 공이 없으면 놓인 공(밀어내기) · 공 가진 야수 자리. 공 그리기 0x36dfc(36e90) — 쥔 공(+0x12c)은 공 · 그림자를 안 그린다.
 * 공+0x68 — 판 시작 · 송구 · 다시 쏘기가 0 으로 둔 그림은 0x36dfc 36e24 가 공 · 그림자를 건너뛴다.
 * 레이저 잔상 0x37076 — +0x1991 동안 지금 공 궤적의 t = 0 점에서 공까지
 */
function ballViewOf(g: RunnerPlayFrame, at: number) {
  const trail = g.laserTrailOn && g.ballPath !== null ? g.ballPath.trajectory.pointAt(g.ballPath.startTick) : null
  return {
    ball: g.chase !== null ? g.chase.trajectory.pointAt(at) : restingBallPointOf(g),
    ballIsFlying: g.chase !== null,
    ballHeld: g.play.held,
    ballPlaybackTick: at - (g.chase?.startTick ?? 0),
    laserTrailFrom: trail,
  }
}

function restingBallPointOf(g: RunnerPlayFrame): WorldPoint {
  return g.input.restingBall ?? g.fielders[g.play.ballHolderSlot]?.position ?? basePosition(0)
}

/** 던진 뒤 송구 동작을 그리는 그림 수 */
const THROW_MOTION_TICKS = 3

function throwViewOf(g: RunnerPlayFrame, at: number) {
  const flight = g.flight
  if (flight === null) return { throwingSlot: NONE, throwBase: NONE }
  return { throwingSlot: at < flight.releaseTick + THROW_MOTION_TICKS ? flight.from : NONE, throwBase: flight.base }
}

/**
 * 레이저 반짝임(경기+0x19ad) — 공 쥔 야수(+0x130) · 반짝임 켜짐 (타구 진행기와 같은 근사).
 * 공 가진 야수 고리 0x43cb0 — 경기+0x19ac · +0x130 · 공격 주체 · +0x19ad
 */
function holderMarksViewOf(g: RunnerPlayFrame) {
  return {
    laserShiningSlot: g.laserFlags.shining && g.play.held ? g.play.ballHolderSlot : NONE,
    holderMark: holderMarkOf({
      grabbed: g.grabbed,
      holderSlot: g.play.ballHolderSlot,
      offenseIsCpu: g.input.offenseIsCpu === true,
      isShining: g.laserFlags.shining,
    }),
    holderPlate: g.input.fielderPlates?.[g.play.ballHolderSlot] ?? null,
    fumbleTicks: g.fumbleMarks,
    throwErrorTicks: g.throwErrorMarks,
  }
}

/**
 * 공 그리기 0x36dfc 의 튐 파티클 — 0x46c88 이 판 종류를 안 보고 늘 부른다(`ballParticleFactsOf`). 큰 타구 갈래는 판 종류 ∈ {1, 8} 이라 없다.
 * 공은 송구 · 다시 쏘기 · 폭투가 깐 궤적(세계 0xbfed0)을 판 틱으로 읽는다. 쥔 공 · 쫓는 공이 없는 그림은 안 쏜다.
 * +0xfd4(결과 코드)는 스윙 판정 51308 이 적고 0x11 진입이 공마다 지우는 칸이라 이 판이 열린 때의 값 그대로다(`sceneResultCode`)
 */
function ballParticlesOf(g: RunnerPlayFrame, at: number): ViewStateInput['ballParticles'] {
  const chase = g.chase
  if (chase === null || g.play.held) return null
  return ballParticleFactsOf({
    ballTick: at - chase.startTick,
    at,
    trajectory: chase.trajectory,
    onTrajectory: true,
    bigHitWatch: false,
    playKind: g.input.kind,
    resultCode: g.input.sceneResultCode ?? null,
  })
}

/** 판 입력에서 그대로 넘기는 그림 칸 */
function inputViewOf(input: RunnerPlayEngineInput) {
  return {
    runnerAceIndexes: input.runnerAceIndexes,
    runnerAceSprite: input.runnerAceSprite ?? null,
    sceneResultCode: input.sceneResultCode ?? null,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    fielderRecords: input.fielderRecords,
    offenseTeamIndex: input.offenseTeamIndex,
  }
}
