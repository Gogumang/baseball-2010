/** 타석 루프 — rAF 틀마다 진입 → 키 → 갱신 → 파티클 틱 → 그림 차례로 한 번 돈다 (경기 장면 0x52c50) */
import { gameSceneTickNow, gameSceneTickOf, gameSceneTickStartTime, gameSceneTimeOf, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { cancelSceneStateEntriesAfter } from '@/shared/lib/commonWindow/sceneStateEntries'
import { openSceneKeyLatch, runSceneKeys } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { clearParticles } from '@/entities/particle/model/particleScene'
import { observeFrozenClock, startFrozenClock } from '@/widgets/batting-stage/lib/frozenClock'
import { createStageLoop, type StageLoop, type StageLoopRefs, type StageParticleKit } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { advancePhase } from '@/widgets/batting-stage/model/stageAnimation/advancePhase'
import { PRE_PITCH_STATES } from '@/widgets/batting-stage/model/stageAnimation/advanceWaiting'
import { drawFrozenFrame } from '@/widgets/batting-stage/model/stageAnimation/frozenFrame'
import { stageFrameReadsOf } from '@/widgets/batting-stage/model/stageAnimation/frameReads'
import { stepStageParticles } from '@/widgets/batting-stage/model/stageAnimation/particleSteps'
import { stageSceneNow } from '@/widgets/batting-stage/model/stageAnimation/stageSceneNow'
import { drawStageFrame } from '@/widgets/batting-stage/model/stageAnimation/drawStageFrame'

/** 캔버스 루프를 세운다 — 그릴 캔버스가 없으면 안 세운다(undefined). 돌려준 함수가 루프를 거둔다 */
export function startStageLoop(refs: StageLoopRefs, particleKit: StageParticleKit): (() => void) | undefined {
  const canvas = refs.canvasRef.current
  const context = effectContextOf(canvas)
  if (!canvas || !context) return undefined
  // 화면이 받은 장면 키(도루 '3'/'2'/'1' 0x53670 → 0x53610 · 0xe 의 OK)도 이 루프가 도는 동안 이 칸에 받은 차례대로 든다
  const releaseKeyOwner = openSceneKeyLatch(refs.keyLatch)
  const loop = createStageLoop(refs, particleKit, canvas, context)
  const frame = (rawNow: number) => {
    runStageFrame(loop, rawNow)
    loop.animationHandle = requestAnimationFrame(frame)
  }
  refs.phaseStartTickRef.current = gameSceneTickNow()
  loop.animationHandle = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(loop.animationHandle)
    refs.shownTicks.clear()
    // 부품이 내려가면 미리 적은 0x10 · 0x11 예약은 서지 않는다(지난 칸과 이미 정한 0x12 · 0x13 · 0x17 은 남는다 — 판정이 낸 것)
    if (refs.phaseRef.current === '대기') cancelSceneStateEntriesAfter(gameSceneTickNow(), PRE_PITCH_STATES)
    releaseKeyOwner()
  }
}

function runStageFrame(loop: StageLoop, rawNow: number): void {
  if (isGameSceneFrozen()) {
    drawFrozenFrame(loop, rawNow)
    return
  }
  const { refs } = loop
  const sceneTick = gameSceneTickOf(gameSceneTimeOf(rawNow))
  const tickTime = gameSceneTickStartTime(sceneTick)
  const isBackdrop = refs.latestRef.current.isResultBackdrop === true
  watchBackdrop(loop, isBackdrop, tickTime)
  enterReservedPhase(loop, sceneTick)
  // 52d9e 키 0x498d4 — 앞 틀 뒤에 받은 키를 진입 뒤 · 갱신 앞에서 처리한다(`sceneKeyLatch`). 좌우 이동은 이 틀의 그림부터,
  // 스윙 · 번트 예약은 이 틀의 갱신(0x4e060)이 본다
  runSceneKeys(refs.keyLatch, sceneTick)
  if (!isBackdrop) advancePhase(loop, sceneTick)
  const reads = stageFrameReadsOf(loop, { sceneTick, tickTime, isBackdrop })
  const particles = stepStageParticles(loop, { nowTick: sceneTick, isBackdrop, side: reads.side, tickLength: reads.tickLength })
  const settlementRain = loop.settlementEffect?.kind === 'rain' ? loop.settlementEffect.rain : null
  const stageScene = stageSceneNow(loop, reads, particles, { rawNow, settlementRain })
  drawStageFrame(loop, stageScene, { sceneTick, particles, settlementRain })
  // 이 틱의 그림이 화면에 섰다(입력이 같아 건너뛴 그림도 캔버스에 남은 그림이 이 틱 그림이다) — 이 뒤에 난 키는 이 틱을 보고 누른 것이다
  // (`shownSceneTicks` — 원본은 키를 받은 틀 = 마지막으로 그린 틀)
  refs.shownTicks.mark(sceneTick, performance.now())
}

/** 결과 창 뒤 배경 시계 — 배경에서 나가면 정산 효과를 치우고(재도전) 시계를 끈다 */
function watchBackdrop(loop: StageLoop, isBackdrop: boolean, tickTime: number): void {
  if (isBackdrop) {
    loop.backdropClock = observeFrozenClock(
      loop.backdropClock ?? startFrozenClock(tickTime),
      tickTime,
      loop.refs.latestRef.current.isSceneFrozen === true,
    )
    return
  }
  if (loop.settlementEffect !== undefined) {
    // 정산을 나가 같은 타석 화면이 다시 경기로 돈다(미션 재도전) — 0x4b100 4b3b6 이 나갈 때 파티클을 다 치운다(0x6dee4,
    // 굴림 없음). 효과 객체는 경기 중에 안 돌고(0x901a0 은 정산 그림 · 홈런 글자만 부른다) 다음 정산 진입 0x4ea0c 가 다시 깐다
    clearParticles(loop.refs.particlesRef.current)
    loop.settlementEffect = undefined
  }
  loop.backdropClock = null
}

/**
 * 결과 창 뒤 배경(0x19 · 0x1a)에는 투구 갱신이 없다 — 투구 단계를 멈춘다(파티클 틱은 아래 — 프레임 끝 0x6de85 는 돈다).
 * 0xbc9c8 — 앞 틀의 갱신이 예약한 단계는 이 틀 머리에서 틱 0 으로 선다(진입 → 키 → 갱신 차례, 52cd4~52e14)
 */
function enterReservedPhase(loop: StageLoop, sceneTick: number): void {
  const { phaseEntryRef, phaseRef, phaseStartTickRef } = loop.refs
  const entry = phaseEntryRef.current
  if (entry === null || sceneTick < entry.tick) return
  phaseRef.current = entry.phase
  phaseStartTickRef.current = entry.tick
  phaseEntryRef.current = null
}
