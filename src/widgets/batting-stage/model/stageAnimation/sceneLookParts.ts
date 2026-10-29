/** 그림 입력의 생김새 · 투수 시계 몫 — 타자 · 투수 그림 재료와 투수 그림 객체 틱 · 홈런 갈래 */
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import type { StageFrameReads } from '@/widgets/batting-stage/model/stageAnimation/frameReads'
import { CPU_RELEASE_TICK_IN_0X11 } from '@/widgets/batting-stage/model/stageAnimation/advanceFlight'

/** 실투 "!" — 놓은 0x11 틱 10 의 그림이 첫 그림(1)이다 (`pitcherFatigue` 의 실투 "!") */
function mistakeMarkDrawOf(loop: StageLoop, reads: StageFrameReads): number | null {
  const { pitch } = reads
  if (!reads.isPitching || pitch === null || pitch !== loop.mistakeMarkPitch) return null
  return reads.sceneTick - loop.refs.phaseStartTickRef.current - CPU_RELEASE_TICK_IN_0X11 + 1
}

export function lookPartOf(loop: StageLoop, reads: StageFrameReads) {
  const latest = loop.refs.latestRef.current
  return {
    isFieldPlay: latest.isFieldPlay === true,
    omitsHud: latest.isHudOmitted === true,
    bodyType: reads.bodyType,
    ...(latest.aceBatterOrder === undefined ? {} : { aceBatterOrder: latest.aceBatterOrder }),
    batterSkinIndex: latest.batterSkinIndex,
    batterTeamIndex: latest.batterTeamIndex,
    batterEquipment: latest.batterEquipment,
    side: reads.side,
    hud: latest.hud,
    pitcherStaminaPercent: latest.pitcherStaminaPercent ?? null,
    pitcherMistakeMarkDraw: mistakeMarkDrawOf(loop, reads),
    ...(latest.runnerAces === undefined ? {} : { runnerAces: latest.runnerAces }),
    acePitcher: latest.acePitcher,
    ...(latest.pitcherEquipment === undefined ? {} : { pitcherEquipment: latest.pitcherEquipment }),
    ...(latest.pitcherSkinIndex === undefined ? {} : { pitcherSkinIndex: latest.pitcherSkinIndex }),
    ...(latest.pitcherTeamIndex === undefined ? {} : { pitcherTeamIndex: latest.pitcherTeamIndex }),
    warmCast: latest.warmCast ?? null,
  }
}

/**
 * 투수 그리기의 홈런 갈래(0x3908a)가 결과 코드 [+0xfd4] · 감상 플래그 +0x199a 를 본다 — 투수를 그리는 0x11 · 0x12 · 0x13 에서.
 * 맞은 공의 인플레이(웹 '결과' isInPlay = 원본 0x17)는 그리기 0x46c88 이 0x38d1c 를 안 불러 없다
 */
function pitcherHitMarkOf(loop: StageLoop, reads: StageFrameReads) {
  const { phaseRef, isInPlayResultRef } = loop.refs
  if (reads.pitcherStartTick === null || (phaseRef.current === '결과' && isInPlayResultRef.current)) return null
  const judged = loop.judgedResultCode
  return {
    codeBeforePitch: loop.resultCodeBeforePitch,
    judgedTick: judged === null ? null : judged.tick,
    judgedCode: judged === null ? null : judged.code,
    isBigHit: reads.pendingHit?.watchesBigHit ?? false,
  }
}

export function pitcherClockPartOf(loop: StageLoop, reads: StageFrameReads) {
  const { pitcherStartTick } = reads
  return {
    pitcherTick: pitcherStartTick === null ? null : reads.sceneTick - pitcherStartTick,
    pitcherTickEnd: pitcherStartTick === null ? null : loop.pitcherTickEnd,
    pitcherHitMark: pitcherHitMarkOf(loop, reads),
  }
}
