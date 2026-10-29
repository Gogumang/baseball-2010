import { useCallback } from 'react'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { cupGameAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { useStartMatch } from '@/app/model/careerSession/game/useStartMatch'
import { leagueMatchSetupOf } from '@/app/model/careerSession/game/leagueMatchSetup'
import { cupMatchSetupOf } from '@/app/model/careerSession/nationalCup/nationalCupEntry'

/** 정규 · 포스트시즌 경기와 국가대항전 경기를 세운다 */
export function useBeginGame(scope: CareerScope) {
  const { atoms, aceLevels } = scope
  const startMatch = useStartMatch(scope)

  /** 정규 · 포스트시즌 경기 (`leagueMatchSetupOf`) */
  const beginGame = useCallback(
    (from?: PlayerCareer) => {
      // `from` — 메인 메뉴의 "곧장 경기"(0x327b8 모드 4 갈래)는 저장을 올린 그 자리에서 세운다(아직 그려지기 전이라 상자가 옛 값)
      const current = from ?? atoms.get(shownCareerMirrorAtom).current
      atoms.set(cupGameAtom, null)
      startMatch(leagueMatchSetupOf(current, aceLevels))
    },
    [aceLevels, atoms, startMatch],
  )

  /**
   * 국가대항전 경기를 세운다 — 142 확인(`confirmMatchPrepare`)과 곧장 경기(`resumeInterruptedGame`)가 같이 쓴다.
   * 경기가 끝나면 이 대회로 하루를 넘긴다 (`finishCupGame`). (그림마다 새 함수 — 옛 꼴 그대로)
   */
  const beginCupGame = (current: PlayerCareer, matchup: NationalCupMatchup, cup: NationalCup) => {
    atoms.set(cupGameAtom, cup)
    startMatch(cupMatchSetupOf(current, matchup, cup))
  }

  return { beginGame, beginCupGame }
}
