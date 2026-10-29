import { useCallback } from 'react'
import { nextOpponentOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { nariTeamsOf, renumberedBattingOrderOf, seatNariMatchAces } from '@/entities/career/model/nariTeamRecord'
import { leagueDayCounterOf, leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import { rollNariMatchAces, rollNariMatchInfoStage } from '@/pages/management/lib/nariMatchPrepare'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom, shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { matchPreparedAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { entryViewAtom, matchAcesAtom, matchInfoStageAtom } from '@/app/model/careerSession/atoms/uiAtoms'

/** 142 진입 0x1c54a — 두 팀 칸 번호를 다시 매긴다(0xb8768): 타순 = 레코드 안 내 줄 첨자 + 1. 바뀐 것이 없으면 그대로 */
export function withRenumberedBattingOrder(current: PlayerCareer | null): PlayerCareer | null {
  if (current === null) return current
  const battingOrder = renumberedBattingOrderOf(current)
  return battingOrder === current.battingOrder ? current : { ...current, battingOrder }
}

/** 109 순위표 · 142 경기 준비에 들어선다 — 여러 하위 훅이 같이 쓴다 */
export function useMatchPrepare({ atoms, openedAces, random, setScreen }: CareerScope) {
  /**
   * 109 다음경기 앞 순위표에 들어선다 — 진입 0x10d8c: `S+0x50 = 4`(0x10db0) · 이전 ≠ 142 면 저장(0x1fded · 0x22755).
   * 이전이 142 여도 값은 이미 4 라 웹은 늘 같은 값을 쓴다. 이어하기가 이 값으로 109 에 돌아온다(`resumePointOf`).
   */
  const enterNextGameStandings = useCallback(
    (fromManagement: boolean) => {
      atoms.set(rawCareerAtom, (current) => (current === null || current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
      setScreen({ kind: '다음경기순위', fromManagement })
    },
    [atoms, setScreen],
  )

  /**
   * 142 경기 준비에 들어선다 — 진입 0x1c46c. 이 장면에서 처음이면(장면+0x288 == 0) 국가대항전이 아닐 때 마선수 넷을
   * 굴린다(`rollNariMatchAces`, 난수 4). 로테이션·투수 +0x2c 는 웹이 경기를 세울 때(`beginGame`) 같은 값으로 구한다.
   */
  const enterMatchPrepare = useCallback(
    (postseasonFromReentry?: boolean) => {
      // 142 진입 0x1c46c 의 첫 줄(0x1c47a) — 0xb6814(전역 상태): +0x6b = 0
      resetLiveGameState()
      if (!atoms.get(matchPreparedAtom)) {
        atoms.set(matchPreparedAtom, true)
        const aces = rollNariMatchAces(random, openedAces)
        atoms.set(matchAcesAtom, aces)
        // 1c62e~1c660 — 굴린 넷을 두 팀 레코드에 넣는다(저장에 남는다 — 빼는 코드가 없다)
        atoms.set(rawCareerAtom, (current) =>
          current === null
            ? current
            : { ...current, nariTeams: seatNariMatchAces(nariTeamsOf(current), current.teamId, nextOpponentOf(current), aces) },
        )
      }
      // 1c7ae~1c87c — 무대 · 구장 0x78664(무대, 홈 팀) · 0x5fd04. 리그 팀은 0~9 라 굴리지 않는다(마선수 굴림 뒤 자리).
      // 지난 그림의 커리어를 본다(옛 `careerRef` — 위에서 넣은 마선수는 팀 · 날짜 · 측을 안 바꾼다)
      const prepared = atoms.get(shownCareerMirrorAtom).current
      if (prepared !== null) {
        atoms.set(
          matchInfoStageAtom,
          rollNariMatchInfoStage(random, {
            mode: BATTER_LEAGUE_MODE,
            myTeamId: prepared.teamId,
            opponentTeamId: nextOpponentOf(prepared),
            mySide: leagueGamePlayerSideOf(prepared),
            dayCounter: leagueDayCounterOf(prepared),
          }),
        )
      }
      atoms.set(rawCareerAtom, withRenumberedBattingOrder)
      atoms.set(entryViewAtom, null)
      setScreen(postseasonFromReentry === undefined ? { kind: '경기준비' } : { kind: '경기준비', postseasonFromReentry })
    },
    [atoms, openedAces, random, setScreen],
  )

  return { enterNextGameStandings, enterMatchPrepare }
}
