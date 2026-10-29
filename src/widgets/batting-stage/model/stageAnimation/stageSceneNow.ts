/** 이 틀의 그림 입력(`StageScene`) — 갱신 · 파티클 틱 뒤에 그 틀의 칸을 읽어 짓는다. 주자 · 구름 시계는 여기서 센다 */
import type { SceneRain } from '@/entities/batting/model/settlementEffect'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { stepRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { bigHitReleaseTickOf, bigHitSwingSkipsOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { observeSceneCloudFrame, sceneCloudFrameOf } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { HitInStage, StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import type { StageFrameReads } from '@/widgets/batting-stage/model/stageAnimation/frameReads'
import type { ParticleFrame } from '@/widgets/batting-stage/model/stageAnimation/particleSteps'
import { contactPartOf, pitchPartOf, type PitcherPose } from '@/widgets/batting-stage/model/stageAnimation/scenePitchParts'
import { lookPartOf, pitcherClockPartOf } from '@/widgets/batting-stage/model/stageAnimation/sceneLookParts'
import { backdropPartOf, hudPartOf, sceneryOf } from '@/widgets/batting-stage/model/stageAnimation/sceneBackdropParts'

/** 마운드 투수의 폼·손 — 던진 공이 실은 값(그 투수 레코드)을 먼저, 없으면 레퍼토리(같은 레코드의 폼·+0x18) */
function pitcherPoseOf(loop: StageLoop, reads: StageFrameReads): PitcherPose {
  const { pitch } = reads
  const repertoire = loop.refs.latestRef.current.pitcherAbility.repertoire
  const pitcherForm = pitch?.pitcherForm ?? repertoire?.form ?? 0
  return { pitcherForm, pitcherHand: pitcherHandOfPitch({ pitcherForm, pitcherMagicNumber: pitcherMagicNumberOf(reads, repertoire) }) }
}

/** 투수 레코드 +0x18 — 던진 공이 실은 값, 없으면 레퍼토리 */
function pitcherMagicNumberOf(reads: StageFrameReads, repertoire: PitcherAbility['repertoire']): number {
  return reads.pitch?.pitcherMagicNumber ?? repertoire?.magicId ?? 0
}

/** 0x35b94 는 타석 상태 그림(0x13 포함)마다 한 번 — 루에 (숨김 없이) 주자가 선 애니만 한 칸씩 (`stepRunnerAnimationClock`) */
function stepRunnerSteps(loop: StageLoop, reads: StageFrameReads, runnerFrames: number): StageScene['runnerAnimationSteps'] {
  const stageHud = loop.refs.latestRef.current.hud
  if (stageHud === null || reads.isBackdrop) return undefined
  return stepRunnerAnimationClock(
    loop.refs.latestRef.current.runnerAnimationClock?.current ?? loop.localRunnerClock,
    stageHud.bases,
    stageHud.hiddenRunnerBases ?? [],
    runnerFrames,
  )
}

/** 이번 0x13 — 0x13 을 끝내는 틀도 아직 0x13 그림이다(`hitInStage`) */
function hitNowOf(loop: StageLoop): HitInStage | null {
  const hit = loop.hitInStage
  if (loop.refs.phaseRef.current !== '타격' || hit === null) return null
  return hit.startTick === loop.refs.phaseStartTickRef.current ? hit : null
}

/** 0x13 의 스윙 멈춤 · 반 속도(3f1ea · 3f2dc) — 건너뛴 칸만큼 스윙 시작을 늦춰 본다(0x13 뒤에도 그 칸만큼 늦다) */
function swingStartTickNow(loop: StageLoop, sceneTick: number): number | null {
  const swingStartTick = loop.refs.swingStartTickRef.current
  const hold = loop.hitInStage
  if (swingStartTick === null) return null
  if (hold === null || hold.swingStartTick !== swingStartTick) return swingStartTick
  return (
    swingStartTick + bigHitSwingSkipsOf(hold.pending.watchesBigHit, hold.startTick, hold.endTick, sceneTick, bigHitReleaseTickOf(hold.frozenDraws))
  )
}

export function stageSceneNow(
  loop: StageLoop,
  reads: StageFrameReads,
  particles: ParticleFrame,
  frame: { readonly rawNow: number; readonly settlementRain: SceneRain | null },
): StageScene {
  const { sceneTick, isBackdrop } = reads
  const pose = pitcherPoseOf(loop, reads)
  const runnerFrames = loop.runnerTick < 0 ? 1 : sceneTick - loop.runnerTick
  loop.runnerTick = sceneTick
  // 구름 0x78448 — 0x3f060 은 '대기'(0xd~0x10)에서만 부르고 0x11 · 0x12 · 0x13 · 0x17 은 안 센다. 결과 창 0x19 · 0x1a 는 그리기
  // 0x4a384 · 0x45c18 이 그림마다 부른다 (`stageScenery` 의 `cloudScrollAt`)
  const cloudCalls = observeSceneCloudFrame(sceneCloudFrameOf(frame.rawNow), isBackdrop || loop.refs.phaseRef.current === '대기', loop.cloudCursor)
  const runnerAnimationSteps = stepRunnerSteps(loop, reads, runnerFrames)
  const hitNow = hitNowOf(loop)
  const swingStartTick = swingStartTickNow(loop, sceneTick)
  return {
    ...pitchPartOf(loop, reads, pose, swingStartTick),
    ...contactPartOf(loop, reads, hitNow),
    ...lookPartOf(loop, reads),
    ...pitcherClockPartOf(loop, reads),
    tick: sceneTick,
    redrawTicks: loop.redrawTicks,
    ...(runnerAnimationSteps === undefined ? {} : { runnerAnimationSteps }),
    ...backdropPartOf(loop, reads, particles, frame.settlementRain),
    ...hudPartOf(loop, reads),
    scenery: sceneryOf(loop, reads, cloudCalls),
  }
}
