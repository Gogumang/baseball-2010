import { PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { ballParticleFactsOf } from '@/features/defense-play/model/ballParticleFacts'
import { type DefensePlayView, type ViewStateInput, holderMarkOf, viewStateOf } from '@/features/defense-play/model/defensePlayView'
import { PITCHER_SLOT } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { runnerStates } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'

/** **화면 스냅샷** — 판 틱 `at` 의 그림. 판이 G2 에서만 닫힌 그림(`closingListFrame`)은 다음 틱 자리로 한 번 더 찍는다 */
export function snapshotAt(g: PickoffFrame, at: number, fieldersNow: readonly FielderState[]): DefensePlayView {
  return viewStateOf({
    tick: at,
    // 슬라이딩 먼지 방향 0x9ff40 의 0x9fe80 이 보는 +0x84
    previousTargetOf: (index) => g.runners.find((runner) => runner.state.index === index)?.previousTarget ?? NONE,
    ...ballViewOf(g, at),
    fielders: fieldersNow,
    runners: runnerStates(g),
    catchKind: null,
    chaserSlot: PITCHER_SLOT,
    throwingSlot: at < PITCHER_THROW_MOTION_TICKS ? PITCHER_SLOT : NONE,
    throwBase: g.flight?.base ?? g.targetBase,
    previousActions: g.previousActions,
    // 머리에서 경기 멈춤(+0x1993)이 서 있던 그림 — 0x3f060 이 3f0a4 에서 돌아가 카메라가 안 움직인다
    cameraFrozen: g.pausedAtHead,
    ...holderMarksViewOf(g),
    ballParticles: ballParticlesOf(g, at),
    ...inputViewOf(g),
  })
}

/** 판 첫 그림부터 투수의 견제 동작을 그리는 그림 수 */
const PITCHER_THROW_MOTION_TICKS = 3

/**
 * 공 칸 — 쫓는 공이 없으면 공 가진 야수 자리(없으면 대상 루). 공 그리기 0x36dfc(36e90) — 쥔 공(+0x12c)은 공 · 그림자를 안 그린다.
 * 공+0x68 — 판 시작 · 송구 · 다시 쏘기가 0 으로 둔 그림은 0x36dfc 36e24 가 공 · 그림자를 건너뛴다.
 * 레이저 잔상 0x37076 — +0x1991 동안 지금 공 궤적의 t = 0 점에서 공까지
 */
function ballViewOf(g: PickoffFrame, at: number) {
  const trail = g.laserTrailOn && g.ballPath !== null ? g.ballPath.trajectory.pointAt(g.ballPath.startTick) : null
  return {
    ball: g.chase !== null ? g.chase.trajectory.pointAt(at) : (g.fielders[g.play.ballHolderSlot]?.position ?? basePosition(g.targetBase)),
    ballIsFlying: g.chase !== null,
    ballHeld: g.play.held,
    ballPlaybackTick: at - (g.chase?.startTick ?? 0),
    laserTrailFrom: trail,
  }
}

/** 레이저 반짝임(경기+0x19ad — 타구 진행기와 같은 근사) · 공 가진 야수 고리 0x43cb0(경기+0x19ac · +0x130 · 공격 주체 · +0x19ad) */
function holderMarksViewOf(g: PickoffFrame) {
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
 * +0xfd4(결과 코드) — 견제는 0x11 을 안 지나 **앞 공**의 스윙 판정 값이 남는다(`sceneResultCode`)
 */
function ballParticlesOf(g: PickoffFrame, at: number): ViewStateInput['ballParticles'] {
  const chase = g.chase
  if (chase === null || g.play.held) return null
  return ballParticleFactsOf({
    ballTick: at - chase.startTick,
    at,
    trajectory: chase.trajectory,
    onTrajectory: true,
    bigHitWatch: false,
    playKind: PICKOFF_PLAY_KIND,
    resultCode: g.input.sceneResultCode ?? null,
  })
}

/** 판 입력 · 판 시작에서 그대로 넘기는 그림 칸 */
function inputViewOf(g: PickoffFrame) {
  return {
    runnerAceIndexes: g.runnerAceIndexes,
    runnerAceSprite: g.runnerAceSprite,
    sceneResultCode: g.input.sceneResultCode ?? null,
    aceIndexes: g.input.aceIndexes,
    defenseTeamIndex: g.input.defenseTeamIndex,
    fielderRecords: g.input.fielderRecords,
    offenseTeamIndex: g.input.offenseTeamIndex,
  }
}
