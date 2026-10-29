import { useCallback } from 'react'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, isSaveErasedAtom, resumedAtom, resumePointAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { replayedEvaluationAtom, resumedNewSeasonAtom } from '@/app/model/pitcherLeagueSession/atoms/resumeAtoms'
import { endingFromResumeAtom, postseasonPopupAtom, yearCoverFromResumeAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { cupViewAtom, gameOptionsAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { normalizePitcherCareer } from '@/app/model/pitcherLeagueSession/save/normalize'
import {
  cupViewOfResume,
  pitcherResumeOf,
  pitcherSceneOfResume,
  pitcherStoryOfResume,
  postseasonPopupOfResume,
} from '@/app/model/pitcherLeagueSession/save/resume'

/**
 * 엔딩을 떠나 메인 메뉴로 (직접 떴다). 커리어 저장을 지우는 곳은 **명예의 전당 등록** 하나다 — 0x62d40~0x62d7e 의 투수 갈래가
 * 선수 사본(0x1f655) 뒤 `0x224ec(저장, 3)`(모드 저장 지우기 — +0x43 · +0x4f = 0, 투수편 저장 칸을 비운다)를 부른다.
 * 팝업 0x2d · 0x32 "아니오"는 `[this+0x278] = 1` · 화면 전환뿐이고 그 끝 1bfa2~1bfe2 는 장면 0x103(메인 메뉴)으로 나갈 뿐이라
 * 저장이 남는다. 다시 들어오면 장면 0x106 이 새로 서 100 → 0x1c154 가 **남은 저장으로** 이어한다(보너스를 받은 저장이면 141).
 *
 * 등록 없이 떠나면 웹 세션은 앱 동안 살아 있어 여기서 미리 같은 저장으로 이어할 자리를 고른다(`pitcherResumeOf`) — 그 사이 투수
 * 저장을 쓰는 곳은 이 세션뿐이고(지갑 다리는 같은 커리어를 다시 쓸 뿐), 이 자리의 이어할 자리(엔딩 141 · 연말 사슬 이벤트)는
 * 굴림 · 저장 · 소리가 없다. 105 진입 곁가지(부상 엔딩 · 나간 대결 140 · 115 · 훑기 굴림)는 들어와 관리 장면에 닿을 때 도는 도착
 * 고리(`isOnScreen` — 투수편 화면일 때만)라 원본 진입 때와 같은 차례다.
 */
export function useFinishEnding({ atoms, store }: PitcherScope) {
  return useCallback(
    (isRegistered: boolean) => {
      atoms.set(gameOptionsAtom, null)
      if (isRegistered) {
        // 저장은 등록하는 순간 지웠다 (`eraseSaveForHallOfFame`)
        atoms.set(isSaveErasedAtom, false)
        atoms.set(careerAtom, null)
        atoms.set(sceneAtom, '등록')
        return
      }
      const next = pitcherResumeOf(normalizePitcherCareer(store.load()))
      atoms.set(resumedAtom, next)
      atoms.set(replayedEvaluationAtom, false)
      atoms.set(resumedNewSeasonAtom, false)
      atoms.set(resumePointAtom, next.point)
      atoms.set(careerAtom, next.career)
      atoms.set(sceneAtom, pitcherSceneOfResume(next.career, next.point))
      atoms.set(yearCoverFromResumeAtom, next.point.kind === '새시즌')
      atoms.set(endingFromResumeAtom, next.point.kind === '엔딩')
      atoms.set(storyAtom, pitcherStoryOfResume(next.point))
      atoms.set(postseasonPopupAtom, postseasonPopupOfResume(next.career, next.point))
      atoms.set(cupViewAtom, cupViewOfResume(next.point))
    },
    [atoms, store],
  )
}
