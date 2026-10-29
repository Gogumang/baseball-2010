import { useCallback } from 'react'
import { unjudgedSwingDetailOf } from '@/features/play-at-bat/model/resolvePitch'
import { unjudgedWhiffSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import { playContactSoundNow, vibratePitch } from '@/widgets/batting-stage/model/battingStage/pitchFeedback'
import type { FinishPitch } from '@/widgets/batting-stage/model/battingStage/useFinishPitch'
import type { ShowResult } from '@/widgets/batting-stage/model/battingStage/useShowResult'

/**
 * **공 끝** — 0x4e060 의 4e24e: 공 틱 > N 이고 맞지 않았으면 0x12. 판정을 들고 있으면 그 결과, 스윙은 나갔는데 판정이 없었으면
 * (공이 타자 근처가 아니던 헛스윙 · 키 틱 N 의 늦은 스윙) 굴림 없는 헛스윙 스트라이크, 아니면 안 친 공 판정(사구 · 볼 · 스트라이크)이다.
 */
export function useEndPitch(refs: StageRefs, aceBatterIndex: number, finishPitch: FinishPitch, showResult: ShowResult): (tick: number) => void {
  const { heldResultRef, latestRef, pitchRef, pitchTypeNumberRef, swingRef } = refs
  return useCallback(
    (tick: number) => {
      const held = heldResultRef.current
      if (held !== null) {
        heldResultRef.current = null
        held(tick)
        return
      }
      const pitch = pitchRef.current
      if (pitch === null) return
      const swing = swingRef.current
      if (swing === null || !swing.isReleased) {
        finishPitch(null, tick)
        return
      }
      // 판정 없는 헛스윙은 이 틀(공 끝 0x4e060 의 4e21c — 0x12 예약 4e24e 와 같은 갱신)에 8/27 을 낸다. 심판 콜은 다음 틀 0x12 진입이다
      playContactSoundNow(swing.isUnjudgedWhiff ? unjudgedWhiffSoundIdOf(aceBatterIndex >= 0) : null)
      const pitchTypeNumber = pitchTypeNumberRef.current
      const latest = latestRef.current
      // 타자 손 — 판정 공(`situationOf`)과 같은 값. 공 도착 판(낫아웃)의 타자주자 타석 자리를 고른다
      const detail = unjudgedSwingDetailOf(null, latest.batterHand ?? batterSideOfForm(latest.batterForm))
      const withType = pitchTypeNumber === null ? detail : { ...detail, pitchTypeNumber }
      vibratePitch(latest, withType, swing.frame, pitch)
      showResult(withType, pitch, false, tick)
    },
    [aceBatterIndex, finishPitch, heldResultRef, latestRef, pitchRef, pitchTypeNumberRef, showResult, swingRef],
  )
}
