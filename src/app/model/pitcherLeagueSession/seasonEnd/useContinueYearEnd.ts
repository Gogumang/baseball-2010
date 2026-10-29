import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { enterPitcherYearEndEvent, nextPitcherYearEndStep } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { careerNationalTeamEventId, isCareerNationalCupYear, NATIONAL_CUP_EVENT } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { regularSeasonPopupOnEnter } from '@/entities/career/model/postseasonFlow'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { postseasonPopupAtom, yearEndViewedAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { cupViewAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useOpenStory } from '@/app/model/pitcherLeagueSession/events/useOpenStory'
import { withPitcherNationalCupEntered } from '@/app/model/pitcherLeagueSession/nationalCup/nationalCupEntry'
import { useStartNewSeason } from '@/app/model/pitcherLeagueSession/seasonEnd/useStartNewSeason'
import { useEnterEnding } from '@/app/model/pitcherLeagueSession/seasonEnd/useEnterEnding'

/** 464 거절 · 462 탈락 — 곧 새 시즌 */
const isCupDeclined = (viewed: readonly number[]) => viewed.includes(NATIONAL_CUP_EVENT.거절) || viewed.includes(NATIONAL_CUP_EVENT.탈락)

/** 연말 사슬의 이벤트 하나를 튼다 — 들어가기 전에 상태 함수가 하는 일(375 앞 MVP 판정 131)을 먼저 */
function useOpenYearEndEvent(scope: PitcherScope) {
  const { commit } = usePitcherSaveWriters(scope)
  const openStory = useOpenStory(scope.atoms)
  return useCallback(
    (current: PitcherCareer, eventId: number, viewed: readonly number[]) => {
      commit(enterPitcherYearEndEvent(current, eventId))
      openStory({ eventId, context: '연말', viewed })
    },
    [commit, openStory],
  )
}

/**
 * 463 출전 — 상태 133 이 0xb7bf1(L) 로 대회를 세우고(+0xbc4 대표팀 마스터 복사 · +0xbe0 첫날 상대) 모드 3 갈래
 * 0xb521d(대표팀, 내 투수, 1) 로 내 칸 k 에 내 투수 복사본을 넣고 134 를 줄에 넣는다. 134 의 틀 0x1b92c 머리가 들어온
 * 첫 틀에 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 — 화면이 띄우고 확인(0x1b1e4)이 준다(`confirmCupTitle`, 장면 0x106 은 모드 3·4 공용)
 * 463 보상 뒤 0x8cca2 — S+0x50 = 3(웹 null) · S+0x12c = 1, 0x8cd44 저장. 대회 칸(0xb7bf1)은 133 이 세운 그대로 파일에 든다
 */
function useEnterYearEndCup(scope: PitcherScope) {
  const { atoms } = scope
  const { commit } = usePitcherSaveWriters(scope)
  return useCallback(
    (current: PitcherCareer) => {
      const entered = withPitcherNationalCupEntered(current)
      const cup = entered.nationalCup ?? createNationalCup()
      commit(entered)
      atoms.set(cupViewAtom, { cup, atStandings: false })
      atoms.set(sceneAtom, '국가대항전')
    },
    [atoms, commit],
  )
}

/** 131 뒤 128 진입 0x120a4 — S+0x50 = 0xf · 저장 (이어하기는 S+0xb4 갈래로 128 에 돌아온다). 정규시즌 우승 보상을 아직 안 받았고 1위면 팝업 0xb */
function useEnterYearEndPostseason(scope: PitcherScope) {
  const { atoms } = scope
  const { commit } = usePitcherSaveWriters(scope)
  return useCallback(
    (current: PitcherCareer, viewed: readonly number[]) => {
      atoms.set(yearEndViewedAtom, viewed)
      commit(current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 })
      atoms.set(postseasonPopupAtom, regularSeasonPopupOnEnter(current))
      atoms.set(sceneAtom, '포스트시즌')
    },
    [atoms, commit],
  )
}

/**
 * 연말 사슬의 다음 걸음 — 이번 연말에 본 이벤트 전부(`viewed`)로 고른다 (`nextPitcherYearEndStep`).
 *
 * ```
 *   136 392 → 393~396 · 130 370 → 371~374 · 131 375 → 376/377 · (128 포스트시즌)
 *   132 501(방출)/504(은퇴식) → 141 · 502 → 380/496 · 380 → 381/382 → 384~391 / 383
 *       줄 [114 → 133] — 연차idx 짝수(1·3·5·7·9·11년차)면 0x10cec 가 133 을 뒤 상태로 넣는다
 *   133 0x1a090: 0xa3de9(S, 3) > 3 → 461(선발) → 463 출전 / 464 거절 · 아니면 462(탈락)
 *   114 끝 0x1c014: 뒤 == 132 → 새 시즌 0x1b768 → 137 → 105
 * ```
 * 국가대표 판정의 목표 단계 3 은 투수 갈래(0xa3e56 표 그대로)다 — `achievedPitcherGoalCount(_, '국가대표')`.
 *
 * 대회 갈래 (타자편 `useCareerSession.continueSeason` 과 같은 자리):
 *   - 463 출전 → 134 국가대항전 대진판 → 135 → 142 → 대표팀으로 던지는 경기 → 결과·보상 → 새 시즌 (8eceab3).
 *   - 464 거절은 S+0x12c = 0 으로 곧 새 시즌 (P5) · 462 탈락: 원본대로 새 시즌 — 114 틀 0x1c014 의 1c0a0~1c0b8 이 뒤 = 105 여도
 *     관리자 +0x305/+0x306 이 서 있으면 새 시즌 처리 0x1b768 로 간다(462 는 +0x306 갈래).
 * 연차idx 는 **끝난 해**의 것이라 새 시즌을 올리기 전에 본다 (0x10ce6~0x10cf8).
 */
export function useContinueYearEnd(scope: PitcherScope) {
  const enterCup = useEnterYearEndCup(scope)
  const enterPostseason = useEnterYearEndPostseason(scope)
  const openYearEndEvent = useOpenYearEndEvent(scope)
  const enterEnding = useEnterEnding(scope)
  const startNewSeason = useStartNewSeason(scope)
  return useCallback(
    (current: PitcherCareer, viewed: readonly number[], endingRequested = false) => {
      if (viewed.includes(NATIONAL_CUP_EVENT.출전)) return enterCup(current)
      if (isCupDeclined(viewed)) return startNewSeason(current)
      const step = nextPitcherYearEndStep(current, viewed, endingRequested)
      if (step.kind === '포스트시즌') return enterPostseason(current, viewed)
      if (step.kind === '이벤트') return openYearEndEvent(current, step.eventId, viewed)
      if (step.kind === '엔딩') return enterEnding(current, step.endingIndex)
      if (!isCareerNationalCupYear(current.season - 1)) return startNewSeason(current)
      openYearEndEvent(current, careerNationalTeamEventId(achievedPitcherGoalCount(current, '국가대표')), viewed)
    },
    [enterCup, enterEnding, enterPostseason, openYearEndEvent, startNewSeason],
  )
}
