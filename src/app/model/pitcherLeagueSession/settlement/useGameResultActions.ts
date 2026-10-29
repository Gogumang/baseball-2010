import { useCallback } from 'react'
import { isPitcherManagementCycleOpen, isPitcherSeasonFinished, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
import { pitcherStreakEventOfCareer } from '@/entities/pitcher-career/model/pitcherStreaks'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { entersYearEndChainInPostseason, regularSeasonPopupOnEnter } from '@/entities/career/model/postseasonFlow'
import type { EventReward } from '@/entities/story/model/eventReward'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { postseasonPopupAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { evaluationRewardsAtom, nextGameFromManagementAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useContinueYearEnd } from '@/app/model/pitcherLeagueSession/seasonEnd/useContinueYearEnd'

type HeldRewards = { readonly rewards: readonly EventReward[]; readonly given: number } | null

/**
 * 116 → 114: 0x8a6fc 가 쌓은 내장 이벤트를 114 가 틀며 연속 기록 보상 명령(평판 · 집중/새가슴/더티볼)을 먹는다 —
 * 이어하기로 116 을 다시 띄웠으면 또 먹는다(원본 그대로, 타자편 `streakEventOf` 와 같은 자리). 창이 선 명령은 이미 줬다
 * (`giveEvaluationRewards`) — 남은 몫만
 */
function evaluationRewardedOf(career: PitcherCareer, held: HeldRewards): PitcherCareer {
  if (held !== null) return applyPitcherEventRewards(career, held.rewards.slice(held.given))
  if (career.seasonEndState === 116) return applyPitcherEventRewards(career, pitcherStreakEventOfCareer(career).rewards)
  return career
}

/** 이미 준 몫 — 처음이면(116 에 들어선 그대로) 연속 기록 이벤트의 보상 줄을 0 부터. 116 이 아니면 없다 */
function heldOrStreakRewardsOf(career: PitcherCareer, held: HeldRewards): HeldRewards {
  if (held !== null) return held
  return career.seasonEndState === 116 ? { rewards: pitcherStreakEventOfCareer(career).rewards, given: 0 } : null
}

/**
 * 포스트시즌 경기 뒤 — 116 의 끝(0x12b74~0x12b94)이 S+0xb4 ≠ 0 이면 **S+0xb2(= L+0x32) == 0 → [114 → 136],
 * 아니면 [114 → 128]** (R9 116절, 모드 갈림 없음). 관리 주기·부상 엔딩·중간평가를 타지 않는다.
 * 내 시리즈가 끝난 경기는 0xb7724 가 L+0x32 = −1(b777a), 하루 끝 0xb818c(0x4f29c)가 +1 → 0 이라 136 부터 사슬을
 * **다시 돈다** — 136 진입 0x10bb0 이 0x8bdc9(392) 를 본 표시 없이 다시 튼다(0x8bdc8 → 0xae170). 원본 그대로다.
 * B-05 고침이면 시리즈 끝(대진이 막 열린 때 말고)은 사슬을 다시 안 틀고 128 로 (`entersYearEndChainInPostseason`)
 */
function reentersYearEndChain(counted: PitcherCareer): boolean {
  return counted.postseason !== null && leagueDayCounterOf(counted) === 0 && entersYearEndChainInPostseason(counted.postseason)
}

/**
 * 116 경기 뒤 평가 — 평가 이벤트의 보상 명령(`giveEvaluationRewards`)과 [확인](`confirmGameResult`).
 */
export function useGameResultActions(scope: PitcherScope) {
  const { atoms } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const continueYearEnd = useContinueYearEnd(scope)
  /**
   * 116 → 114 평가 이벤트의 보상 명령 — 이미 준 몫. 0x8c460 이 명령마다 주고 끝(0x8b0e4 · 0x8cd44)에서 저장하므로 첫 몫을 줄 때
   * S+0x50 이 114 진입 값(3 · 0xb — 웹 null)으로 저장된다(타자편 `giveEvaluationRewards`, Q-23)
   */
  const giveEvaluationRewards = useCallback(
    (count: number) => {
      if (career === null || scene !== '경기결과') return
      const held = heldOrStreakRewardsOf(career, atoms.get(evaluationRewardsAtom))
      if (held === null || count <= held.given) return
      const { rewards, given } = held
      atoms.set(evaluationRewardsAtom, { rewards, given: count })
      commit({ ...applyPitcherEventRewards(career, rewards.slice(given, count)), seasonEndState: null })
    },
    [atoms, career, commit, scene],
  )
  /**
   * 116 [확인] → 114 — 0x8a6fc 가 쌓은 평가 내장 이벤트를 틀고, 114 진입 0x11d00 이 S+0x50 = 2 → 3(웹 null), 116 의 끝
   * (0x12b74~0x12bb2)이 고른 뒤 상태로 간다.
   *   - 포스트시즌 경기 뒤: g == 0 이면 [114 → 136] 을 곧장 예약(0xbcb49(0x88) · 0xbcb49(0x72), 12b8c~12bbe — 사이에 시즌 요약 화면이
   *     없다), 아니면 128 진입 0x120a4 — S+0x50 = 0xf · 저장
   *   - 정규시즌이 닫혔으면(`isPitcherSeasonFinished`, 0xb818c) 시즌 끝 사슬(136→…→132) — 45번째 경기는 하루 끝 0xb818c 가 대진
   *     0xb80a8 을 열며 L+0x32 = 0 이라 위와 같은 [114 → 136] 이다
   *   - **2경기 주기** — 116 의 끝이 `S+0xb2`(경기 수)의 **비트0** 을 본다(12b98~12bb0: 짝수 105 · 홀수 109). 장면 0x106 은
   *     모드 3·4 공용이라 투수편도 타자편과 똑같다. 홀수 경기 뒤 109 진입 0x10d8c 가 S+0x50 = 4 · 저장(이전 상태가 105 가 아니라
   *     취소가 안 먹는다). ⚠️ **부상 엔딩 판정보다 앞에 둔다** — 부상 엔딩은 105 **진입**(0x11910 → 0x11b32)의 첫 줄이라 홀수
   *     경기 뒤에는 굴러가지 않는다. 그 검사는 105 도착 고리(`useManagementArrival`)가 한다
   */
  const confirmGameResult = useCallback(() => {
    if (career === null) return
    const held = atoms.get(evaluationRewardsAtom)
    atoms.set(evaluationRewardsAtom, null)
    const counted: PitcherCareer = { ...evaluationRewardedOf(career, held), seasonEndState: null }
    if (reentersYearEndChain(counted)) return continueYearEnd(counted, [])
    if (counted.postseason !== null) {
      commit({ ...counted, seasonEndState: 128 })
      atoms.set(postseasonPopupAtom, regularSeasonPopupOnEnter(counted))
      return atoms.set(sceneAtom, '포스트시즌')
    }
    if (isPitcherSeasonFinished(counted)) return continueYearEnd(counted, [])
    if (!isPitcherManagementCycleOpen(counted)) {
      commit({ ...counted, seasonEndState: 109 })
      atoms.set(nextGameFromManagementAtom, false)
      return atoms.set(sceneAtom, '다음경기순위')
    }
    commit(counted)
    atoms.set(sceneAtom, '관리')
  }, [atoms, career, commit, continueYearEnd])
  return { giveEvaluationRewards, confirmGameResult }
}
