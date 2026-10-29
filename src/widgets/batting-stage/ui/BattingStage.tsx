import { useEffect } from 'react'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { useClaimSceneParticles } from '@/widgets/particles/model/useClaimSceneParticles'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import { useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageCastPreload } from '@/widgets/batting-stage/model/useStageCastPreload'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import { useIsCommonWindowOpen } from '@/shared/lib/commonWindow/commonWindow'
import type { BattingStageProps } from '@/widgets/batting-stage/model/battingStage/battingStageProps'
import { battingStageInputOf, stageLatestOf, takesStageKeysOf } from '@/widgets/batting-stage/model/battingStage/battingStageInput'
import { useSceneBuntKind } from '@/widgets/batting-stage/model/battingStage/useSceneBuntKind'
import { useShowResult } from '@/widgets/batting-stage/model/battingStage/useShowResult'
import { useFinishPitch } from '@/widgets/batting-stage/model/battingStage/useFinishPitch'
import { useEndPitch } from '@/widgets/batting-stage/model/battingStage/usePitchEnd'
import { useCommitHit } from '@/widgets/batting-stage/model/battingStage/useCommitHit'
import { useFlightProbe, useReleaseSwing, useStageActions } from '@/widgets/batting-stage/model/battingStage/useStageKeyHooks'
import { useStageTouchOffers } from '@/widgets/batting-stage/model/battingStage/useStageTouchOffers'
import * as styles from '@/widgets/batting-stage/ui/BattingStage.css'

/**
 * 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. 판정 틀 · 공 끝 · 0x13 끝 · 키 동작은 `model/battingStage` 의 훅이 들고,
 * 이 부품은 차례대로 세워 루프(`useStageAnimation`) · 조작(`useStageControls`)에 넘긴다.
 */

export function BattingStage(props: BattingStageProps) {
  const isCommonWindowOpen = useIsCommonWindowOpen()
  const input = battingStageInputOf(props)
  const { canBunt, specialSwingNumber, aceBatterIndex, specialSwingRemaining, isBatterOwnPlayer, careerYearIndex } = input
  // 지금 선 타자 · 투수의 스윙 · 번트 · 투구 그림을 미리 받는다(안 기다린다 — 그리기는 그대로)
  useStageCastPreload({
    batterForm: input.batterForm,
    aceBatterIndex,
    batterEquipmentLevels: input.batterEquipmentLevels,
    acePitcherOrder: props.acePitcher?.order ?? null,
    pitcherEquipmentNibbles: input.pitcherEquipmentNibbles,
  })
  const refs = useStageRefs(stageLatestOf(input, isCommonWindowOpen))
  // 0xd 진입 0x48d50 의 48f88 — 좌우 이동 +0xfe4 = 0 (번호가 바뀔 때만. 쉬는 동안은 안 지운다)
  const { canvasRef, pitchRef, shiftRef } = refs
  useEffect(() => {
    if (props.shiftResetSerial !== undefined) shiftRef.current = 0
  }, [props.shiftResetSerial, shiftRef])
  const { kindRef: sceneBuntKindRef, kindOfThisPitch: sceneBuntKindOfThisPitch } = useSceneBuntKind(pitchRef, input.sceneBuntKind)
  const showResult = useShowResult(refs, sceneBuntKindOfThisPitch)
  const finishPitch = useFinishPitch({
    refs,
    marks: { aceBatterIndex, specialSwingNumber, isBatterOwnPlayer, careerYearIndex },
    sceneBuntKindOfThisPitch,
    showResult,
    particleConfigOf,
  })
  const endPitch = useEndPitch(refs, aceBatterIndex, finishPitch, showResult)
  const releaseSwing = useReleaseSwing(specialSwingRemaining, input.onSpecialSwingUsed)
  const commitHit = useCommitHit(refs)
  const actions = useStageActions({
    refs,
    sceneBuntKindRef,
    sceneBuntKindOfThisPitch,
    specialSwingNumber,
    aceBatterIndex,
    specialSwingRemaining,
  })
  useFlightProbe(refs, input.flightProbeRef)

  // 타석 장면은 원본 틱 차례(갱신 → 그리기 → 프레임 끝 0x6de84)로 앱 전역 파티클 관리자를 직접 굴리고 그린다
  useClaimSceneParticles()
  useStageAnimation(refs, { judgePitch: finishPitch, endPitch, commitHit, releaseSwing })
  const pointerHandlers = useStageControls(refs, actions)
  // 공을 안 던지는 동안(결과 연출 `isPaused` · 결과 창 배경 · 공용 창)은 터치 상황 버튼을 거둔다
  const takesStageKeys = takesStageKeysOf(props, isCommonWindowOpen)
  useStageTouchOffers({ takesStageKeys, canBunt, specialSwingNumber, aceBatterIndex, specialSwingRemaining })

  return (
    <canvas
      ref={canvasRef}
      className={styles.stage}
      // 홈런더비 판(0x17) — 밑에 깔린 필드 화면이 비치도록 바탕을 뺀다(`isFieldPlay`)
      style={props.isFieldPlay === true ? { background: 'transparent' } : undefined}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      {...pointerHandlers}
    />
  )
}
