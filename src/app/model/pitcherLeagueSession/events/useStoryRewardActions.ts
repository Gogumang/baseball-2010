import { useCallback } from 'react'
import { finishPitcherYearEndEvent } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { applyPitcherEventRewards } from '@/entities/pitcher-career/model/pitcherEventReward'
import { markRewardedEvent, withOutingEventActed } from '@/entities/story/model/storyScene'
import { EVENT_REWARD_KIND, type EventReward } from '@/entities/story/model/eventReward'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import type { PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useStoryEvents } from '@/app/model/pitcherLeagueSession/state/useStoryEvents'
import { withPitcherRewardResumePatch } from '@/app/model/pitcherLeagueSession/events/eventRewards'

/** 112(지도) · 113(장소)에서 연 이벤트인가 — 0x8b0e4 의 0x8b12c 가 행동함(S+4)을 켠다 */
const isOutingStory = (story: PitcherStory) => story.context === '지도' || story.context === '장소'

/** 재생 중 이벤트의 보상 명령 · 선택지 · system 창 — 0x8c460 · 0x8b0e4 · 0x7fe90 이 저장한다 */
export function useStoryRewardActions(scope: PitcherScope) {
  const { atoms, random, recordStat } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const storyEvents = useStoryEvents(atoms)
  const { commit } = usePitcherSaveWriters(scope)
  /**
   * 보상 명령 하나를 그 자리에서 준다 — 0x8c460 모드 3 갈래(`applyPitcherEventRewards`, 연말 사슬은 `finishPitcherYearEndEvent`).
   * 이벤트 번호는 그 명령이 든 이벤트다 — 연차 보정 0x8d508(393~396) · 중간평가 비트 0x8cbaa(452~454)가 [mgr] 의 지금 이벤트를 본다.
   * G 보상(종류 10)은 한 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` 로 적는다. 종류 7 의 히든 오픈 알림(0x62368 → 공용 창)은 재생
   * 화면이 그 명령의 알림 창으로 띄우고 확인까지 기다린다(`rewardNoticeOf` — 기다림 0x8daa0).
   *
   * **저장한다** — 0x8c460 은 모드 3 · 4 공용으로 항목을 다 준 뒤 본 표시(지금 이벤트 0xacf49 · 떠나온 줄 0x8b0e4) · 장소 행동함을
   * 하고 0x8b0e4 → 0x22755 로 저장한다(나리면 0x8cd44 에서 한 번 더 · 0x1f1b9, `markRewardedEvent`). 8cc2e — 이벤트 번호로 이어하기
   * 자리(S+0x50)를 고치고 8cd44 에서 다시 저장한다 (`withPitcherRewardResumePatch`).
   */
  const giveStoryReward = useCallback(
    (items: readonly EventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      if (career === null || story === null) return
      const rewarded =
        story.context === '연말' ? finishPitcherYearEndEvent(career, eventId, items) : applyPitcherEventRewards(career, items, random, eventId)
      items
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: reward.value }))
      const marked = markRewardedEvent(rewarded, storyEvents?.find((event) => event.id === eventId) ?? null, viewedEventIds)
      commit(withPitcherRewardResumePatch(withOutingEventActed(marked, isOutingStory(story), eventId), eventId, items))
    },
    [career, commit, random, recordStat, story, storyEvents],
  )
  /** 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 112/113 에서 연 이벤트면 S+4 · 저장(커리어가 안 바뀌어도 쓴다) */
  const confirmStoryChoice = useCallback(
    (eventId: number, leftEventIds: readonly number[]) => {
      if (career === null || story === null) return
      commit(withOutingEventActed(markRewardedEvent(career, null, leftEventIds), isOutingStory(story), eventId))
    },
    [career, commit, story],
  )
  /**
   * 이벤트 system 창 답 0 — 0x7fe90(상자): 모드 2 가 아니면 [[상자+0x150]+0x1b7] = 1, 그리고 0x22755([0x1400054], 1) 저장.
   * 이미 켜져 있어도 원본은 저장한다 — 그때까지 준 보상이 든 커리어가 저장된다.
   */
  const confirmEventSystemWindow = useCallback(() => {
    if (career === null) return
    commit(career.hasSeenYearGoalWindow ? career : { ...career, hasSeenYearGoalWindow: true })
  }, [career, commit])
  return { giveStoryReward, confirmStoryChoice, confirmEventSystemWindow }
}
