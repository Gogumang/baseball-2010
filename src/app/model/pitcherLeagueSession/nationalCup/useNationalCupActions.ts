import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
import { awardPitcherTitles } from '@/entities/pitcher-career/model/pitcherTitles'
import { preparePitcherCupMatch } from '@/entities/pitcher-career/model/pitcherCupTeams'
import { careerNationalCupRewardItems, type NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupSideOf, type NationalCup, type NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { rollNariMatchInfoStage } from '@/pages/management/lib/nariMatchPrepare'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  cupMatchAtom,
  cupViewAtom,
  entryViewAtom,
  matchAcesAtom,
  matchInfoStageAtom,
  matchPreparedAtom,
} from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { pitcherCupTeamsOf } from '@/app/model/pitcherLeagueSession/game/gameOptions'
import { useStartNewSeason } from '@/app/model/pitcherLeagueSession/seasonEnd/useStartNewSeason'

/** 국가대항전 134 · 135 · 142 — 옛 훅처럼 그림마다 새 함수다 */
export function useNationalCupActions(scope: PitcherScope) {
  const { atoms, random, recordStat } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  const startNewSeason = useStartNewSeason(scope)
  return {
    /**
     * 135 [확인](0x10680) → **142 경기 준비** — 0x1c46c 가 내 팀을 대진 칸 0·1 중 대한민국(10)으로 끼운다. S+0x12c 라 마선수
     * 넣기(1c5fe)를 건너뛰고, 같은 문(장면+0x288) 안에서 대회 레코드를 오늘 준비로 고친다(`preparePitcherCupMatch` — 상대국 g ≠ 0
     * 이면 돌리기 · 대표팀은 모드 3 갈래). 이전 상태가 143 이 아니면 구장 0x78664(무대, 홈 팀) — 대회 팀은 10~13 이라
     * **rand(0, 10) 한 번**(취소로 135 에 갔다 다시 와도 또). 142 진입 0x1c46c(0x1c47a) — +0x6b = 0.
     * 대회 중 나리 저장 +0xb2 = L+0x32 = 대회 날짜
     */
    startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => {
      if (career === null) return
      resetLiveGameState()
      const isFirstPrepare = !atoms.get(matchPreparedAtom)
      atoms.set(matchPreparedAtom, true)
      const stage = rollNariMatchInfoStage(random, {
        mode: PITCHER_LEAGUE_MODE,
        myTeamId: matchup.myTeam,
        opponentTeamId: matchup.opponent,
        mySide: nationalCupSideOf(cup, matchup.myTeam),
        dayCounter: cup.day,
      })
      // 대회 레코드 고침의 저장은 구장 굴림 뒤 — 옛 훅은 함수 꼴 `setState` 가 이 사건의 그림에서 저장해 굴림보다 늦었다
      // (굴림은 커리어를 안 보니 값은 같다)
      if (isFirstPrepare) {
        commitWith((current) => ({
          ...current,
          nariCupTeams: preparePitcherCupMatch(pitcherCupTeamsOf(current, matchup.opponent), cup.day, current.role),
        }))
      }
      atoms.set(matchInfoStageAtom, stage)
      atoms.set(entryViewAtom, null)
      atoms.set(matchAcesAtom, null)
      atoms.set(cupViewAtom, null)
      atoms.set(cupMatchAtom, { matchup, cup })
      atoms.set(sceneAtom, '경기준비')
    },
    /**
     * 대회 끝 — 결과 팝업 0x25 · 보상 팝업 0x26 을 닫았다 (0x1b92c). 우승이면 보상(인기 +20 · 평판 +30 · 2000만 · G +1000 —
     * 0x22c7d(g, 1000, 모드 3))을 얹고, S+0x12c = 0 · 0x1faa1(g, 1, 1) 로 내 투수 포인터를 원래 레코드로 · 새 시즌 0x1b768.
     * 히든 팀은 여기서 열지 않는다 — 134 진입 0x19f30 이 들어올 때마다 열었다(`openCupHiddenTeams`, 타자편과 같다).
     * 0x1bb28 0x1b768 뒤 134 는 대진판을 그리며 효과기 끝을 기다린다 — 대진 칸은 137 로 넘길 때 걷는다(`enterHeldYearCover`)
     */
    finishCup: (finish: NationalCupFinish) => {
      if (career === null) return
      const rewarded = applyPitcherEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
      if (finish.reward.gamePoint > 0) recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: finish.reward.gamePoint })
      startNewSeason(rewarded, false, true)
    },
    /**
     * 134 진입 0x19f30 → 0x65de4 가 처음 연 히든 팀 — 전역 +0x7a+k = 1 · 전역 저장 0x1f1b9(커리어 저장은 아니다).
     * 커리어 `openedHiddenIds` 에 넣으면 앱이 전역 기록으로 모은다(`App` 의 투수편 히든 모음).
     */
    openCupHiddenTeams: (teams: readonly number[]) => {
      atoms.set(careerAtom, (previous) => {
        if (previous === null) return previous
        const missing = teams.filter((id) => !previous.openedHiddenIds.includes(id))
        return missing.length === 0 ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, ...missing] }
      })
    },
    /** 134 첫 틀 0x1b92c 의 칭호 8 팝업 확인 0x1b1e4 — 비트 · 곧바로 장착 · 저장 (관리 화면 `confirmTitle` 과 같은 콜백) */
    confirmCupTitle: () => {
      commitWith((current) => {
        const title = nationalCupStandingsTitleOf(current.titleIds)
        return title === null ? current : awardPitcherTitles(current, [title])
      })
    },
  }
}
