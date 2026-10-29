import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { finishPitcherYearEndEvent } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { applyPitcherEventRewards, finishPitcherEvent } from '@/entities/pitcher-career/model/pitcherEventReward'
import { judgePitcherEnding } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { NO_ENDING_JUDGEMENT } from '@/entities/career/model/seasonFlow'
import { EVENT_REWARD_KIND, type EventReward } from '@/entities/story/model/eventReward'
import { PITCHER_LEAGUE_MODE, type AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import type { PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import { useContinueYearEnd } from '@/app/model/pitcherLeagueSession/seasonEnd/useContinueYearEnd'
import { useEnterEnding } from '@/app/model/pitcherLeagueSession/seasonEnd/useEnterEnding'
import { hiddenOpenRewardIdsOf } from '@/app/model/pitcherLeagueSession/events/eventRewards'
import { useStoryReturn } from '@/app/model/pitcherLeagueSession/events/useStoryReturn'

/** 이번 재생의 보상 — 연말 사슬은 `finishPitcherYearEndEvent`, 그 밖은 0x8c460 모드 3 갈래 */
function rewardedCareerOf(
  career: PitcherCareer,
  story: PitcherStory,
  rewards: readonly EventReward[],
  random: Parameters<typeof applyPitcherEventRewards>[2],
) {
  if (story.context === '연말') return finishPitcherYearEndEvent(career, story.eventId, rewards)
  return applyPitcherEventRewards(career, rewards, random, story.eventId)
}

/** 첫 종류 21 로 끝난 이벤트만 본 표시를 안 한다(0x8cf8c 를 안 지난다) */
function markedViewedIdsOf(viewedEventIds: readonly number[], endingEventId: number | null): readonly number[] {
  return endingEventId === null ? viewedEventIds : viewedEventIds.filter((id) => id !== endingEventId)
}

/** 114 끝 1c088 — 뒤 상태가 113(장소)이 아니면 141 로 (연초 115 내장 이벤트는 엔딩 명령이 없다 — 옛 차례대로 연초를 먼저 본다) */
function isEndingStory(story: PitcherStory, endingEventId: number | null): boolean {
  return endingEventId !== null && story.context !== '장소' && story.context !== '연초'
}

/** G 보상 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` · 보상 종류 7 의 공용 창 알림 0x62368 */
function announceStoryRewards(
  rewards: readonly EventReward[],
  recordStat: (event: AnnalsStatEvent) => void,
  announceHiddenOpen: ((ids: readonly number[]) => void) | undefined,
): void {
  rewards
    .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
    .forEach((reward) => recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: reward.value }))
  const hiddenIds = hiddenOpenRewardIdsOf(rewards)
  if (hiddenIds.length > 0) announceHiddenOpen?.(hiddenIds)
}

/**
 * 이벤트 재생(114)이 끝났다 — 틀 0x1c014.
 * 보상은 재생기가 지나온 보상 명령(0x8c460, 모드 3 갈래 `applyPitcherEventRewards`)이고, 본 이벤트는 모두
 * 본 표시를 남긴다. 그 뒤 갈 곳은 뒤 상태(`story.context`)로 갈린다(연말은 다음 사슬 `continueYearEnd`, 그 밖은 `useStoryReturn`).
 * G 보상(종류 10)은 한 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` 로 획득 GP 통계에 적는다. 보상 종류 7 — 0x62368(…, |v|, 1) 이 공용
 * 창에 띄운다(떠 있으면 대기 칸).
 *
 * `endingEventId` 는 첫 종류 21 로 끝난 이벤트(0x8d4ce — [0x1552adc] = 1)다: 그 이벤트만 본 표시를 안 하고(0x8cf8c 를 안 지난다)
 * 거친 다른 이벤트는 0x8b0e4 가 본 표시한다. 엔딩은 그 칸으로 간다(`nextPitcherYearEndStep`). 114 끝 1c088 — 뒤 상태가 113(장소)이
 * 아니면 [0x1552adc] 를 지우고 141(번호는 0x12300 이 판정). 부상 엔딩 500(105 진입 0x113e8)이 이 길이다. 장소에서 끝난 종류 21 은
 * 원본이 칸을 남겨 두고 105 · 112 틀 1d056 이 141 로 보내지만, 종류 21 이벤트(500 · 501 · 503 · 504)는 대상 0 이고 장소 이벤트의
 * 갈래도 그리로 안 이어져 닿지 않는다.
 */
export function useCompleteStory(scope: PitcherScope) {
  const { atoms, random, recordStat, announceHiddenOpen } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const continueYearEnd = useContinueYearEnd(scope)
  const enterEnding = useEnterEnding(scope)
  const returnFromStory = useStoryReturn(scope)
  return useCallback(
    (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
      if (career === null || story === null) return
      const rewarded = rewardedCareerOf(career, story, rewards, random)
      const viewed = finishPitcherEvent(rewarded, markedViewedIdsOf(viewedEventIds, endingEventId))
      announceStoryRewards(rewards, recordStat, announceHiddenOpen)
      atoms.set(storyAtom, null)
      if (story.context === '연말') return continueYearEnd(viewed, [...story.viewed, ...viewedEventIds], endingEventId !== null)
      if (isEndingStory(story, endingEventId)) return enterEnding(viewed, judgePitcherEnding(viewed) ?? NO_ENDING_JUDGEMENT)
      returnFromStory(story, rewarded, viewed)
    },
    [announceHiddenOpen, atoms, career, continueYearEnd, enterEnding, random, recordStat, returnFromStory, story],
  )
}
