import { applyEventRewards } from '@/entities/story/model/eventReward'
import { awardTitles, nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { prepareNariCupMatch } from '@/entities/career/model/nariCupTeams'
import { nationalCupSideOf, type NationalCup, type NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { careerNationalCupRewardItems, type NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import { rollNariMatchInfoStage } from '@/pages/management/lib/nariMatchPrepare'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { matchPreparedAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { entryViewAtom, matchInfoStageAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'
import { cupTeamsOf } from '@/app/model/careerSession/nationalCup/nationalCupEntry'

/** 국가대항전 134 · 135 — 경기 준비 · 대회 끝 · 칭호 8 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useNationalCupActions(scope: CareerScope) {
  const { atoms, random, recordStat, setScreen } = scope
  const career = useShownCareer(scope)
  const { startNewSeason } = seasonFlowOf(scope)
  return {
    /**
     * 매치업 화면(135) [확인](0x10680) → **경기 준비 142** → [확인] → 사람 경기.
     * `0x1c46c` 가 내 팀을 `0xb7614(L,n,0)`(= 대한민국)로 바꿔 끼우므로 팀 10 으로 친다. S+0x12c 라 마선수 넣기(1c5fe)를
     * 건너뛰고 장면+0x288 만 세운다. 이전 상태가 143 이 아니면 구장 `0x78664(무대, 홈 팀)` — 대회 팀은 10~13 이라
     * **rand(0, 10) 한 번**(취소로 135 에 갔다 다시 와도 또 굴린다).
     *
     * 경기는 **내 선수가 낀 대표팀 칸**(+0xbc4, 133 의 `0xb53f1`)과 그날 상대국 칸(+0xbe0)으로 선다 (`nariCupTeams`).
     * 같은 문(장면+0x288) 안에서 대회 날짜 g ≠ 0 이면 두 칸 투수를 한 칸 돌린다(1c574).
     */
    startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => {
      if (career === null) return
      // 142 진입 0x1c46c(0x1c47a) — +0x6b = 0
      resetLiveGameState()
      if (!atoms.get(matchPreparedAtom)) {
        // 1c574 — 대회 날짜 g ≠ 0 이면 대표팀·상대국 칸 투수 0~3 을 한 칸씩 돌린다(영구, 같은 문 안이라 한 번만)
        atoms.set(rawCareerAtom, (current) =>
          current === null ? current : { ...current, nariCupTeams: prepareNariCupMatch(cupTeamsOf(current, matchup.opponent), cup.day) },
        )
      }
      atoms.set(matchPreparedAtom, true)
      // 홈 팀 = 후공 측(0xb7844 L+0xac 갈래 — 대진 칸 0). 대회 팀은 모두 > 9 라 어느 쪽이든 한 번 굴린다
      atoms.set(
        matchInfoStageAtom,
        rollNariMatchInfoStage(random, {
          mode: BATTER_LEAGUE_MODE,
          myTeamId: matchup.myTeam,
          opponentTeamId: matchup.opponent,
          mySide: nationalCupSideOf(cup, matchup.myTeam),
          // 대회 중 나리 저장 +0xb2 = L+0x32 = 대회 날짜
          dayCounter: cup.day,
        }),
      )
      atoms.set(entryViewAtom, null)
      setScreen({ kind: '경기준비', cup: { matchup, cup } })
    },

    /**
     * 대회 끝 — 결과 팝업(`0x25`)과 보상 팝업(`0x26`)을 모두 닫았을 때 (`0x1b92c`).
     * 보상은 커리어에 얹고, 그 뒤 원본대로 새 시즌 처리(`0x1b768`)다.
     *
     * 국가대항전 플래그(`S+0x12c` — 커리어 `nationalCup`)는 새 시즌 처리(`startNextSeason`, 1b774)가 내린다.
     */
    finishCup: (finish: NationalCupFinish) => {
      if (career === null) return
      const rewarded = applyEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
      // 우승 보상 팝업 0x26 닫힘 0x1bb14 `0x22c7d(1000, 모드 4)` — 보상이 없는 갈래는 부르지 않는다
      if (finish.reward.gamePoint > 0) recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: finish.reward.gamePoint })
      // 히든 팀은 여기서 열지 않는다 — 134 에 들어올 때마다 진입 0x19f30 이 열었다(결승 승리 뒤 진입이 결승 상대까지)
      // 0x1bb28 0x1b768 뒤 134 는 대진판을 그리며 효과기 끝을 기다린다(1bb2c~1bb64) — 대진판 위에 아홉 틀 어두워진 뒤 137
      startNewSeason(rewarded, { holdsPrevious: true })
    },

    /** 134 첫 틀 `0x1b92c` 의 칭호 8 팝업 확인 `0x1b1e4` — 비트 · 곧바로 장착 · 저장 (관리 화면 `confirmTitle` 과 같은 콜백) */
    confirmCupTitle: () => {
      if (career === null) return
      const nationalTitle = nationalCupStandingsTitleOf(career.titleIds)
      if (nationalTitle !== null) atoms.set(rawCareerAtom, awardTitles(career, [nationalTitle]))
    },
  }
}
