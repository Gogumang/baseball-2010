import { useCallback } from 'react'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { SCENE_STATE, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { isHomeRunResolution, judgeTextOf } from '@/widgets/batting-stage/lib/stageText'
import { RESULT_PHASE_TICKS, resultPhaseTicksOf } from '@/widgets/batting-stage/lib/stagePhaseTicks'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 결과(0x12)를 세운다 — 문구 · 결과 길이 · 알림 */
export type ShowResult = (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable: boolean, tick: number) => void

export function useShowResult(refs: StageRefs, sceneBuntKindOfThisPitch: () => number): ShowResult {
  const { buntRef, homeRunStartTickRef, isHitByPitchResultRef, isInPlayResultRef, latestRef, phaseEntryRef, resultTextRef, resultTicksRef } = refs
  return useCallback(
    (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable: boolean, tick: number) => {
      const latest = latestRef.current
      buntRef.current = null
      const isHomeRun = isHomeRunResolution(detail)
      // 공 끝 0x4e24e 가 이 틀에 0x12 를 예약한다(4e26c → 0xbcb49) — 0x12 는 다음 틀이 틱 0 이다(`phaseEntryRef`)
      homeRunStartTickRef.current = isHomeRun ? tick + 1 : null
      resultTicksRef.current = resultPhaseTicksOf(detail.resolution, latest.hud)
      /** 타석을 끝낸 공(문턱 0x1f) */
      const endsAtBat = resultTicksRef.current > RESULT_PHASE_TICKS
      // 판정 v — 타석을 끝낸 스트라이크 · 볼은 삼진(애니 9) · 볼넷(애니 6) 글자다 (`judgeTextOf`)
      resultTextRef.current = judgeTextOf(detail.resolution, endsAtBat)
      isInPlayResultRef.current = false
      // 사구(st[0x12]) — 0x12 틱 0~7 에 타자 머리 위 표시(4a0ce, `batterOverlayMarks`)
      isHitByPitchResultRef.current = detail.resolution.kind === '사구'
      phaseEntryRef.current = { phase: '결과', tick: tick + 1 }
      // 0x12 는 다음 틀이 틱 0, 문턱 갱신이 예약한 다음 상태는 그 `resultTicks` 틀 뒤에 선다(0x4e6d4 → 판정 A)
      markSceneStateEntries(
        { tick: tick + 1, state: SCENE_STATE.결과 },
        // 타석을 끝낸 공(문턱 0x1f)이면 판정 A 가 0xd(밀어내기면 0x17 판) — 아니면 같은 타석 다음 공 0xf
        { tick: tick + 1 + resultTicksRef.current, state: endsAtBat ? SCENE_STATE.준비 : SCENE_STATE.선택 },
      )
      const reply = latest.onPitchResolved(detail, pitch, isUncatchable, sceneBuntKindOfThisPitch(), tick)
      // 0x3dfac 낫아웃 갈래가 판정 칸을 지웠으면(3e0aa) 0x12 틱 0 의 판정 글자 · 삼진 파티클이 없다 — 진입이 그 그림보다 먼저다
      if (reply != null && reply.judgementCleared === true) {
        resultTextRef.current = judgeTextOf(detail.resolution, resultTicksRef.current > RESULT_PHASE_TICKS, true)
      }
    },
    [
      buntRef,
      homeRunStartTickRef,
      isHitByPitchResultRef,
      isInPlayResultRef,
      latestRef,
      phaseEntryRef,
      resultTextRef,
      resultTicksRef,
      sceneBuntKindOfThisPitch,
    ],
  )
}
