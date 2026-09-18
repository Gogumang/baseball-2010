import { useEffect } from 'react'
import { selectPitch } from '@/entities/pitching/model/selectPitch'
import { lastSwingFrameOf } from '@/entities/batting/model/swingTiming'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { renderBattingStage } from '@/widgets/batting-stage/lib/renderBattingStage'
import { batterFrameNow, pitchSituationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, pitchTickAt } from '@/widgets/batting-stage/model/stageRefs'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 다음 투구까지의 준비 시간 */
const WIND_UP_MILLISECONDS = 850
/** 결과 문구를 보여주는 시간 */
const RESULT_DISPLAY_MILLISECONDS = 1150
const SPECIAL_PITCH = 'SPECIAL'
const SKY_ROW_COUNT = 6

type FinishPitch = (swing: BattingSwing | null, now: number) => void

/** 캔버스 애니메이션 루프와 투구 단계 진행. */
export function useStageAnimation(refs: StageRefs, finishPitch: FinishPitch) {
  const {
    canvasRef,
    pitchRef,
    phaseRef,
    phaseStartedAtRef,
    resultTextRef,
    swingStartedAtRef,
    shiftRef,
    buntRef,
    latestRef,
  } = refs

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    let animationHandle = 0
    const openedAt = performance.now()
    // 하늘 표 행 = 구장 팀 데이터 +0xb2 — 웹은 팀 데이터에 그 칸이 없어 원본의 대체 규칙 rand(0,6) 을 쓴다 (추정)
    const skyRow = randomIntegerBelow(latestRef.current.random, 0, SKY_ROW_COUNT)

    const advancePhase = (now: number) => {
      const elapsed = now - phaseStartedAtRef.current

      if (phaseRef.current === '대기') {
        if (latestRef.current.isPaused) {
          // 타석이 끝나 쉬는 동안 — 다음 타석 준비(0x48d50)처럼 좌우 이동을 되돌린다
          shiftRef.current = 0
          phaseStartedAtRef.current = now
          return
        }
        if (elapsed >= WIND_UP_MILLISECONDS) {
          const { pitcherAbility, random } = latestRef.current
          pitchRef.current = selectPitch(pitcherAbility, pitchSituationOf(latestRef.current.hud), random)
          phaseRef.current = '투구중'
          phaseStartedAtRef.current = now
        }
        return
      }

      const pitch = pitchRef.current
      if (phaseRef.current === '투구중' && pitch !== null) {
        const frame = ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
        const bunt = buntRef.current
        // 번트 자세는 공이 플레이트에 닿는 순간(N−1) 판정한다 — 판정 시점은 추정
        if (bunt !== null && frame >= pitch.frameCount - 1) {
          finishPitch({ frame: bunt.frame, shift: shiftRef.current, buntKind: bunt.kind }, now)
          return
        }
        if (frame > lastSwingFrameOf(pitch.frameCount, pitch.type === SPECIAL_PITCH)) {
          finishPitch(null, now)
          return
        }
      }

      if (phaseRef.current === '결과' && elapsed >= RESULT_DISPLAY_MILLISECONDS) {
        phaseRef.current = '대기'
        phaseStartedAtRef.current = now
        pitchRef.current = null
      }
    }

    const frame = (now: number) => {
      advancePhase(now)

      const pitch = pitchRef.current
      const tickLength = millisecondsPerFrame()
      const isPitching = phaseRef.current === '투구중' && pitch !== null
      const ballFrame = isPitching ? ballFrameAt(now, phaseStartedAtRef.current, tickLength) : -1

      renderBattingStage(context, {
        pitch,
        frame: ballFrame,
        shift: shiftRef.current,
        isEagleEyeEnabled: latestRef.current.isEagleEyeEnabled && phaseRef.current === '투구중',
        resultText: phaseRef.current === '결과' ? resultTextRef.current : '',
        swingFrame: batterFrameNow(now, swingStartedAtRef.current, buntRef.current !== null),
        hud: latestRef.current.hud,
        acePitcher: latestRef.current.acePitcher,
        pitcherTick: isPitching ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : null,
        tick: pitchTickAt(now, openedAt, tickLength),
        resultTick: phaseRef.current === '결과' ? pitchTickAt(now, phaseStartedAtRef.current, tickLength) : 0,
        // 구장 번호를 고르는 규칙(st+0x70)이 미확인이라 0 번 구장으로 둔다 (추정)
        scenery: { skyRow, stadium: 0 },
      })

      animationHandle = requestAnimationFrame(frame)
    }

    phaseStartedAtRef.current = performance.now()
    animationHandle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationHandle)
    // ref 묶음은 값이 바뀌지 않는다. finishPitch만 바뀔 수 있다.
  }, [finishPitch])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      // 탭이 숨겨진 동안 requestAnimationFrame이 멈춘다. 돌아왔을 때 경과 시간이
      // 통째로 쌓여 있으면 진행 중이던 투구가 곧바로 스트라이크로 처리되므로
      // 타석을 다시 준비 상태로 되돌린다.
      phaseRef.current = '대기'
      phaseStartedAtRef.current = performance.now()
      pitchRef.current = null
      buntRef.current = null
      resultTextRef.current = ''
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
