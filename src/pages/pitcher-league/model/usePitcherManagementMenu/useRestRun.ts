import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { restResultTextOf } from '@/entities/career/model/trainingText'
import { recoverAfterPitcherRest, runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'
import { pitcherRestDetailRowsOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import type { PitcherMenuDetail } from './menuTypes'
import { REST_STATE } from './menuText'

export type PitcherRestPhase = 'playing' | 'result' | null

/**
 * 상태 **127** 휴식 — [휴식] 예가 연출 0x85230(`RestScene`)을 틀고(`'playing'`), 틀 0x19080 이 연출 끝(0x84e58)을 본 틀에
 * 0x18e3c(굴림 rand · 결과 창 0x741a0 · S+4 = 1 · 저장 0x1fded/0x22755)를 부른다(`'result'`).
 *
 * 돌려주는 차례: [휴식 단계, 단계 쓰기, 연출 끝]
 */
export function useRestRun(
  career: PitcherCareer,
  random: RandomPort,
  onSave: (career: PitcherCareer) => void,
  onReenter: (from?: number) => void,
  setNotice: Dispatch<SetStateAction<string>>,
  setIsResultWindowOpen: Dispatch<SetStateAction<boolean>>,
  setDetail: Dispatch<SetStateAction<PitcherMenuDetail | null>>,
) {
  const [restPhase, setRestPhase] = useState<PitcherRestPhase>(null)

  const finishRest = useCallback(() => {
    if (restPhase !== 'playing') return
    setRestPhase('result')
    const rest = runPitcherRest(career, random)
    onSave(rest.career)
    // 상세 결과 창(0x18fc2 → 0x872a1) — 글은 StrMODE[24] "사기" + " " + |수치| + [83]/[84] (0x18e3c 18e7c~18eb4, `restResultTextOf`)
    setDetail({
      rows: pitcherRestDetailRowsOf(rest.career, rest.moraleGain),
      messages: [restResultTextOf(rest.moraleGain)],
      /*
       * 결과 창을 **닫을 때** 회복 판정 0x1b308 (콜백 0x1d671, 질병 60% · 부상 30%, G 2-2).
       * 타자편 `useCareerSession` 이 `recoverAfterRest` 를 부르는 자리와 같다.
       */
      afterClose: () => {
        setRestPhase(null)
        const recovered = recoverAfterPitcherRest(rest.career, random)
        onSave(recovered.career)
        if (recovered.recoveries.length > 0) setNotice(recovered.recoveries.join(' '))
        else setIsResultWindowOpen(false)
        // 127 → 105 (0x1b466 `0xbcb49(0x69)`) — 알림(1b45c)은 105 위에 뜬다: 다음 틀 0xbc9c9 가 창과 상관없이 105 를 세운다
        onReenter(REST_STATE)
      },
    })
  }, [career, onReenter, onSave, random, restPhase, setDetail, setIsResultWindowOpen, setNotice])

  return [restPhase, setRestPhase, finishRest] as const
}
