import { applyPostseasonCpuGames, type PlayerCareer } from '@/entities/career/model/playerCareer'
import type { Screen } from '@/app/model/screen'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  popupAfterChampion,
  REGULAR_SEASON_HIDDEN_ID,
  regularSeasonOpenedHiddenIds,
} from '@/entities/career/model/postseasonFlow'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useMatchPrepare } from '@/app/model/careerSession/nextGame/useMatchPrepare'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'

type PostseasonScreen = Extract<Screen, { kind: '포스트시즌' }>

/** 포스트시즌 대진 128 · 연말 사슬 시험 진입점 (그림마다 새 함수 — 옛 꼴 그대로) */
export function usePostseasonActions(scope: CareerScope) {
  const { atoms, aceLevels, random, readRegularSeasonOtherModes, announceHiddenOpen, screen, setScreen } = scope
  const career = useShownCareer(scope)
  const { enterMatchPrepare } = useMatchPrepare(scope)
  const { enterYearEndChain, finishPostseason } = seasonFlowOf(scope)

  /** 팝업 0xb — 정규시즌 우승 보상을 얹고 128 에 머문다. 팝업 8(한국시리즈 우승)은 보상 뒤 132 */
  const closeRegularSeasonPopup = (current: PlayerCareer, postseasonScreen: PostseasonScreen) => {
    const otherModes = readRegularSeasonOtherModes?.()
    const rewarded = applyRegularSeasonReward(current, REGULAR_SEASON_HIDDEN_ID.타자편, otherModes)
    atoms.set(rawCareerAtom, rewarded)
    // 0x15c4e · 0x15c76 의 0x62369 — 새로 열었으면 공용 창 알림 (0x29 먼저, 타자편 0x22 는 대기)
    announceHiddenOpen?.(regularSeasonOpenedHiddenIds(current, rewarded, otherModes))
    setScreen({ ...postseasonScreen, popup: null })
  }

  return {
    /**
     * 대진 화면 128 [확인] — 키 0x13da0. 팝업이 떠 있으면 키가 안 먹는다(0x1d06a 의 0x754f9 검사).
     * 끝났으면 우승 팀 발표(팝업 7), 내 차례면 142 경기 준비(→ 144 → 경기 장면),
     * 아니면 CPU 끼리 돌려 바뀐 대진을 보여 주고 128 에 머문다.
     */
    pressPostseason: () => {
      if (career === null || career.postseason === null) return
      if (screen.kind !== '포스트시즌' || screen.popup !== null) return
      // 0x13da0 의 세 갈래 (`pressPostseasonBracket` 과 같은 차례) — CPU 끼리 경기(0xc2760)는 리그 표의 +0x2c 로 서고
      // 깎인 값을 남긴다(회복 없음). 그래서 CPU 갈래는 표를 잇는 `applyPostseasonCpuGames` 로 돌린다
      const series = career.postseason
      if (series.round === '종료') return setScreen({ ...screen, popup: { kind: '우승발표', champion: series.champion ?? -1 } })
      // 내 차례 → 142 경기 준비 (0x13da0)
      if (isMyTurn(series, career.teamId)) return enterMatchPrepare(screen.fromReentry === true)
      atoms.set(rawCareerAtom, applyPostseasonCpuGames(career, random, aceLevels))
    },

    /** 대진 화면 128 의 팝업 닫힘 — 틀 0x15984 */
    closePostseasonPopup: () => {
      if (career === null || screen.kind !== '포스트시즌' || screen.popup === null) return
      const popup = screen.popup
      if (popup.kind === '정규시즌우승') return closeRegularSeasonPopup(career, screen)
      if (popup.kind !== '우승발표') return finishPostseason(applyKoreanSeriesReward(career))
      const next = popupAfterChampion(career, popup.champion)
      if (next !== null) return setScreen({ ...screen, popup: next })
      finishPostseason(career)
    },

    /**
     * **웹 전용 디버그(시험용 진입점)** — 지금 커리어로 136 연말 사슬을 곧장 튼다. 화면은 이 길을 부르지 않는다:
     * 원본 길은 116 끝(`confirmGameResult`)이 [114 → 136] 으로 곧장 간다(`enterYearEndChain`).
     */
    beginYearEnd: () => {
      if (career === null) return
      enterYearEndChain(career)
    },
  }
}
