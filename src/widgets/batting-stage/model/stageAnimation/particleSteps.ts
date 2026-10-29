/**
 * 파티클은 **원본 틱**에 맞춰 굴린다 — rAF 가 60fps 라도 갱신은 틱마다 한 번이다.
 * 탭이 쉬다 돌아오면 밀린 틱이 한꺼번에 쌓이므로 따라잡기는 몇 틱으로 끊는다. 이 루프의 첫 그림은 세지 않는다(null).
 * 원본은 단말이 부르는 틀마다 한 번 갱신하고 시간으로 따라잡지 않는다 — 따라잡기는 rAF 가 틱을 건너뛴 그림 몫이고, 탭이 쉬는 동안
 * 틀이 안 도는 것은 단말 몫이다(일시정지 0x2da0 은 소리 · 장면 vt+0x18 · 0x74458 뿐 — TODO C-18)
 */
import { appTickOfGameSceneTick, gameSceneTickStartTime, isCommonWindowShown } from '@/shared/lib/commonWindow/commonWindow'
import { clearParticles, emitParticles, tickParticles } from '@/entities/particle/model/particleScene'
import { claimSceneParticleTick } from '@/entities/particle/model/sceneParticleManager'
import { enterSettlementEffect, tickSettlementEffect } from '@/entities/batting/model/settlementEffect'
import { fireworksPortOf, stepStageFrame } from '@/widgets/batting-stage/lib/homeRunEffects'
import { strikeoutJudgeParticlesOf } from '@/widgets/batting-stage/lib/judgeParticles'
import { skyColorsOf, skyColumnOfInning } from '@/widgets/batting-stage/lib/stageScenery'
import type { SettlementEffectSource } from '@/widgets/batting-stage/model/stageRefs'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { emitMagicBallParticlesAt } from '@/widgets/batting-stage/model/stageAnimation/magicBallParticles'
import { emitHitGroundParticleAt } from '@/widgets/batting-stage/model/stageAnimation/hitStage'

const PARTICLE_CATCH_UP_LIMIT = 4

export interface ParticleFrame {
  /** 결과 배경의 정산 재료 — 타석이면 undefined */
  readonly settlement: SettlementEffectSource | undefined
  /** 공용 창이 서 있어 파티클 틱 · 그리기를 건너뛰는 틀 */
  readonly isParticleGated: boolean
}

/** 이 틀의 파티클 · 효과 틱 — 밀린 틱을 원본 프레임 차례로 따라잡는다 */
export function stepStageParticles(
  loop: StageLoop,
  frame: { readonly nowTick: number; readonly isBackdrop: boolean; readonly side: number; readonly tickLength: number },
): ParticleFrame {
  const { nowTick, isBackdrop } = frame
  if (loop.particleTick === null) loop.particleTick = nowTick
  const settlement = isBackdrop ? loop.refs.latestRef.current.settlement : undefined
  // 경기 장면 프레임 0x52c50 의 파티클 게이트 53048~5304c — 공용 창 [0x140005c]+9 가 서 있으면 관리자 틱 0x6de85 · 그리기 0x6dd69 를
  // 둘 다 건너뛴다. 그동안 상태 갱신(52cc6 → 52ef2)과 상태 그리기(52f0e~52f24 → 53032, 장면을 다시 그리는 첫 그림 [+0x250] 말고)도
  // 건너뛰므로 그 안의 효과 틱(0x40faa · 정산 0x4a384)도 없다 — 이 그림들의 틱은 따라잡지 않고 버린다(원본 틀이 돌지 않은 것과 같다)
  const isParticleGated = isCommonWindowShown()
  const steps = isParticleGated ? 0 : Math.min(PARTICLE_CATCH_UP_LIMIT, nowTick - loop.particleTick)
  if (settlement !== undefined && loop.settlementEffect === undefined) enterSettlement(loop, settlement)
  // 틱마다 원본 프레임 차례 — (치우기) → (홈런 효과 깔기) → 글자 유지 그림의 효과 틱 0x40faa → 파티클 틱 0x6de84
  const firstSteppedTick = nowTick - steps
  if (settlement !== undefined) stepSettlementTicks(loop, settlement, firstSteppedTick, steps)
  // 정산 효과가 없는 결과 배경(홈런더비 결과 창 0x1a — 갱신 0x3c0b8 · 그리기 0x45c18 는 구름 0x78449 · 배경 0x78579 · 창뿐, 효과 틱 없음)도
  // 프레임 끝 관리자 틱 0x6de85 는 돈다(53048 의 게이트는 공용 창만 본다 — 경기 상태를 안 가린다). 굴림은 경기 난수
  else if (isBackdrop) stepBackdropTicks(loop, firstSteppedTick, steps)
  else stepGameTicks(loop, firstSteppedTick, steps, frame)
  loop.particleTick = nowTick
  return { settlement, isParticleGated }
}

/** 0x4f42c 는 구장 +0x14(지금 하늘 칸 = 경기 상태 +0x6b, 0부터)로 하늘 색을 본다 */
function enterSettlement(loop: StageLoop, settlement: SettlementEffectSource): void {
  const skyRow = loop.refs.latestRef.current.skyRow ?? 0
  loop.settlementEffect = enterSettlementEffect(
    {
      isWin: settlement.isWin,
      skyColorIndex: skyColorsOf(skyRow, skyColumnOfInning(settlement.inning)).colorIndex,
      side0Score: settlement.side0Score,
      side1Score: settlement.side1Score,
    },
    settlement.random,
  )
}

/** 이 걸음(장면 틱 `firstSteppedTick + step + 1`)의 앱 틀에 관리자 틱이 아직 안 돌았는가 — 앱 틀당 한 번(`claimSceneParticleTick`) */
function claimsManagerTick(loop: StageLoop, firstSteppedTick: number, step: number): boolean {
  return claimSceneParticleTick(loop.refs.particlesRef.current, appTickOfGameSceneTick(firstSteppedTick + step + 1))
}

function stepSettlementTicks(loop: StageLoop, settlement: SettlementEffectSource, firstSteppedTick: number, steps: number): void {
  const { particlesRef } = loop.refs
  for (let step = 0; step < steps; step += 1) {
    const effect = loop.settlementEffect
    if (effect !== null && effect !== undefined)
      tickSettlementEffect(effect, fireworksPortOf(particlesRef.current, loop.particleKit.configOf), settlement.random)
    if (claimsManagerTick(loop, firstSteppedTick, step)) tickParticles(particlesRef.current, settlement.random)
  }
}

function stepBackdropTicks(loop: StageLoop, firstSteppedTick: number, steps: number): void {
  for (let step = 0; step < steps; step += 1) {
    if (claimsManagerTick(loop, firstSteppedTick, step)) tickParticles(loop.refs.particlesRef.current, loop.refs.latestRef.current.random)
  }
}

function stepGameTicks(
  loop: StageLoop,
  firstSteppedTick: number,
  steps: number,
  frame: { readonly side: number; readonly tickLength: number },
): void {
  for (let step = 0; step < steps; step += 1) stepGameTick(loop, firstSteppedTick + step + 1, frame)
}

/** 타석 한 틱 — 0x17 진입 치우기 · 0x11 · 0x13 · 0x12 그림의 파티클 · 홈런 효과 틱과 프레임 끝 관리자 틱 */
function stepGameTick(loop: StageLoop, steppedTick: number, frame: { readonly side: number; readonly tickLength: number }): void {
  const { inPlayEnteredTickRef, particlesRef, latestRef } = loop.refs
  // 0x17 진입 0x46418 의 4673e — 0x13 을 끝낸 틱(그 틱의 파티클 틱 · 그리기는 0x13 끝에 쏜 016 까지 한 번 돈다) 다음 틱에 비운다
  const inPlayEnteredTick = inPlayEnteredTickRef.current
  if (inPlayEnteredTick !== null && steppedTick > inPlayEnteredTick) {
    inPlayEnteredTickRef.current = null
    clearParticles(particlesRef.current)
  }
  // 이 틱의 0x11 그림이 쏘는 마구 공 파티클 — 그 틀 끝 관리자 틱(아래 `stepStageFrame` 의 0x6de84) 앞
  emitMagicBallParticlesAt(loop, steppedTick)
  // 이 틱의 0x13 그림이 땅에 닿은 타구 공 자리에 쏘는 파티클(3b472)
  emitHitGroundParticleAt(loop, steppedTick)
  emitStrikeoutParticles(loop, steppedTick, frame.side)
  const latest = latestRef.current
  loop.stageEffects = stepStageFrame(loop.stageEffects, {
    time: gameSceneTickStartTime(steppedTick),
    millisecondsPerTick: frame.tickLength,
    window: latest.homeRunText ?? null,
    effectsClearedAt: latest.effectsClearedAt ?? null,
    // 홈런더비 판(0x17)의 필드 공 그리기 0x36dfc 파티클 — 필드 층이 그 틱 그림 몫을 낸다
    drawShots: latest.fieldPlayShotsAt?.(steppedTick) ?? [],
    particles: particlesRef.current,
    random: latest.random,
    configOf: loop.particleKit.configOf,
    appTick: appTickOfGameSceneTick(steppedTick),
  })
}

/** 0x12 틱 0 의 그림 — 판정 글자 0x393b4 가 삼진이면 양끝 파티클을 쏜다(`strikeoutJudgeParticlesOf`). 맞은 공(0x13 · 0x17)은 0x12 가 아니다 */
function emitStrikeoutParticles(loop: StageLoop, steppedTick: number, side: number): void {
  const { phaseRef, phaseStartTickRef, isInPlayResultRef, resultTextRef, particlesRef } = loop.refs
  if (phaseRef.current !== '결과' || steppedTick !== phaseStartTickRef.current || isInPlayResultRef.current) return
  for (const shot of strikeoutJudgeParticlesOf(resultTextRef.current, side)) {
    emitParticles(particlesRef.current, loop.particleKit.configOf(shot.id), shot.x, shot.y, shot.img)
  }
}
