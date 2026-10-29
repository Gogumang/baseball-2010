/** 그림 입력의 타자 · 투수 몫 — CPU 타자 스윙 자세 · 생김새 · 투수 덧그림 재료 */
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { batterFrameAt, bodyTypeOf, NO_EQUIPMENT, NO_PITCHER_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { cpuSwingTickOf, hitEndTickOf, HUMAN_PITCH_RELEASE_STATE_TICK } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { bigHitReleaseTickOf, bigHitSwingSkipsOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

type BatterParts = Pick<
  StageScene,
  | 'swingFrame'
  | 'bodyType'
  | 'aceBatterOrder'
  | 'batterSkinIndex'
  | 'batterTeamIndex'
  | 'batterEquipment'
  | 'side'
  | 'hud'
  | 'pitcherStaminaPercent'
  | 'pitcherMistakeMarkDraw'
  | 'runnerAces'
>

type PitcherParts = Pick<
  StageScene,
  'acePitcher' | 'pitcherEquipment' | 'pitcherForm' | 'pitcherHand' | 'pitcherSkinIndex' | 'pitcherTeamIndex' | 'warmCast'
>

export function batterSceneParts(loop: PitcherSideLoop, frame: PitcherSideFrame): BatterParts {
  const { current, nowTick } = frame
  const bodyType = bodyTypeOf(current.batterForm)
  const swingTick = swingTickOf(loop, frame)
  return {
    swingFrame: batterFrameAt({
      tick: nowTick,
      swingTick,
      isBunting: isBuntingAt(loop, frame, swingTick),
      bodyType,
      ...(current.aceBatterOrder === undefined ? {} : { aceOrder: current.aceBatterOrder }),
    }),
    bodyType,
    ...(current.aceBatterOrder === undefined ? {} : { aceBatterOrder: current.aceBatterOrder }),
    batterSkinIndex: current.batterSkinIndex,
    batterTeamIndex: current.batterTeamIndex,
    batterEquipment: current.batterEquipment ?? NO_EQUIPMENT,
    side: frame.side,
    hud: current.hud,
    pitcherStaminaPercent: current.pitcherStaminaPercent ?? null,
    // 실투 "!" — 놓은 틱(0x11 틱 10)의 그림이 첫 그림(1)이다. 그림 한 번 = 장면 틱 하나로 센다(타자편과 같다 — `pitcherFatigue`)
    pitcherMistakeMarkDraw: mistakeMarkDrawOf(loop, frame),
    ...(current.runnerAces === undefined ? {} : { runnerAces: current.runnerAces }),
  }
}

export function pitcherSceneParts(frame: PitcherSideFrame): PitcherParts {
  const { current } = frame
  return {
    acePitcher: current.acePitcher ?? null,
    pitcherEquipment: current.pitcherEquipment ?? NO_PITCHER_EQUIPMENT,
    pitcherForm: current.pitcherForm,
    pitcherHand: current.pitcherHand,
    pitcherSkinIndex: current.pitcherSkinIndex ?? 0,
    pitcherTeamIndex: current.pitcherTeamIndex ?? current.hud?.ourTeamId ?? null,
    warmCast: current.warmCast ?? null,
  }
}

function mistakeMarkDrawOf(loop: PitcherSideLoop, frame: PitcherSideFrame): number | null {
  const releaseTick = loop.releaseTick
  if (!loop.shownMistake || releaseTick === null || frame.stage.phase.kind !== '투구중') return null
  return frame.nowTick - releaseTick + 1
}

/** CPU 스윙 자세가 번트인가 — 스윙 틱에 닿은 번트 스윙 */
function isBuntingAt(loop: PitcherSideLoop, frame: PitcherSideFrame, swingTick: number | null): boolean {
  const swing = loop.shownSwing
  if (swingTick === null || swing === null || swing.buntKind === 0) return false
  return frame.nowTick >= swingTick && frame.stage.phase.kind !== '대기'
}

/** 스윙은 이 공이 날거나 0x12 인 동안만 — 대기로 돌아오면 대기 자세 */
function swingTickRawOf(loop: PitcherSideLoop, frame: PitcherSideFrame): number | null {
  const { releaseTick, shownSwing } = loop
  if (releaseTick === null || shownSwing === null || frame.stage.phase.kind === '대기') return null
  return cpuSwingTickOf(releaseTick, shownSwing.frame, frame.current.acePitcher?.order ?? null)
}

/** 0x13 의 스윙 멈춤 · 반 속도(0x3f060 3f1ea · 3f2dc — `bigHitSwingSkipsOf`) — 건너뛴 칸만큼 스윙 시작을 늦춰 본다(타자편과 같다) */
function swingTickOf(loop: PitcherSideLoop, frame: PitcherSideFrame): number | null {
  const swingTickRaw = swingTickRawOf(loop, frame)
  const { hitBase, hit } = frame
  const releaseTick = loop.releaseTick
  if (swingTickRaw === null || hitBase === null || hit === null || releaseTick === null) return swingTickRaw
  /** 0x13 의 장면 틱 경계 — 0x13 틱 0(판정 틀 J 다음 그림) · 0x17 이 선 그림 */
  const hitStartTick = releaseTick - HUMAN_PITCH_RELEASE_STATE_TICK + pitcherReleaseTicksOf(frame.aceOrder) + hit.judgeBallTick + 1
  return (
    swingTickRaw +
    bigHitSwingSkipsOf(
      hitBase.watchesBigHit,
      hitStartTick,
      hitStartTick + hitEndTickOf(hit) + 1,
      frame.nowTick,
      bigHitReleaseTickOf(loop.marks.frozenDraws),
    )
  )
}
