import type { Screen } from '@/app/model/screen'
import { applyEventRewards, type EventReward } from '@/entities/story/model/eventReward'
import { EVENT_TRIGGER, finishEvent, withOutingEventActed } from '@/entities/story/model/storyScene'
import { spendCycleAction, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { judgeEnding, NO_ENDING_JUDGEMENT } from '@/entities/career/model/seasonFlow'
import { emptyPlaceFrameOf, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import type { CareerStoryScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'
import { continueSeasonOf } from '@/app/model/careerSession/seasonEnd/continueSeason'
import { announcedHiddenIdsOf, recordEventGamePoints, withBattingOrderRewards } from '@/app/model/careerSession/events/eventRewardSteps'

type EventScreen = Extract<Screen, { kind: '이벤트' }>

/**
 * 재생 끝(114 끝 0x1c014). `endingEventId` 는 첫 종류 21 로 끝난 이벤트(0x8d4ce — [0x1552adc] = 1)다: 그 이벤트는 본 표시를
 * 안 하고(0x8cf8c 를 안 지난다) 거친 다른 이벤트는 0x8b0e4 가 본 표시한다. 엔딩은 그 칸으로 간다(`nextSeasonStep`).
 * 엔딩 이벤트(첫 종류 21 — 500 · 501 · 503 · 504, 모두 대상 0)를 트는 곳은 원본에서 둘이다: 시즌 끝 사슬(132 의 501 · 504 ·
 * 502 → 496 → 503)과 105 진입의 부상 엔딩 500(0x11b32 → 0x113e8). 1c088 은 뒤 상태가 113 이 아닌 114 끝마다 그 칸을 보고,
 * 틀 0x1cdec 의 1d056(105 · 112 에서 훑기가 비었을 때)은 113 끝이 남긴 칸을 보는데 장소에서는 종류 21 이벤트에 닿지 않는다.
 * (그림마다 새 함수 — 옛 꼴 그대로)
 */
export function useCompleteScene(scope: CareerStoryScope) {
  const { atoms, random, recordStat, announceHiddenOpen, screen, setScreen, story } = scope
  const career = useShownCareer(scope)
  const { enterEnding } = seasonFlowOf(scope)
  const continueSeason = continueSeasonOf(scope)

  /** 장소 이벤트 끝 — 빈 장소면 그 말풍선(113)으로, 아니면 행동을 쓰고 105 로 */
  const finishPlaceEvent = (viewed: PlayerCareer, eventId: number) => {
    // 빈 장소(440~444)는 **행동·외출 횟수를 쓰지 않고** 장소 화면으로 돌아간다 (0x1c014, G-4).
    // 앞서 웹은 빈 장소에서도 행동을 썼다 — 원본과 반대였다.
    if (isEmptyPlaceEventId(eventId)) {
      atoms.set(rawCareerAtom, viewed)
      // 1c07c — +0x167 을 지우고 113(그 장소 말풍선)으로. 112 진입이 아니라 [!] 다시 찍기 · 자동 발동이 없다(Q-22)
      const frame = emptyPlaceFrameOf(eventId)
      const place = OUTING_PLACES.find((candidate) => candidate.frame === frame)
      return setScreen(place === undefined ? { kind: '외출' } : { kind: '외출', openPlaceId: place.id })
    }
    // 장소 이벤트도 외출이다 — 행동을 쓰고 외출 횟수(칭호 "1년간 외출")에 센다
    atoms.set(rawCareerAtom, spendCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 }))
    setScreen({ kind: '관리' })
  }

  /**
   * 114 끝 0x1c014 → 0x8b0e4(1c02e)의 0x8b12c — 112 에서 연 이벤트도 행동함(S+4)을 켜고 저장한다. 뒤 112 라 장소 끝
   * 처리(외출 수)는 없다. 지금 이벤트 번호는 연 이벤트로 본다(외출 진입 이벤트는 440~444 가 아니다)
   */
  const finishOutingEntryEvent = (viewed: PlayerCareer, eventId: number) => {
    const acted = withOutingEventActed(viewed, true, eventId)
    atoms.set(rawCareerAtom, acted)
    // 114 → 112 — 상태가 바뀐 틀이라 112 진입 0x118e4(0x8cdc0 이 커서를 0 으로) 뒤 자동 발동 0x1cf9c 가 화면 112 로 다시
    // 훑는다(0x8be80 — 무작위 조건까지). 찾으면 또 [다음 114, 뒤 112]
    story.rewindCursor()
    const isHeld = isAutoScanHeldByAceMatch(atoms.get(portsMirrorAtom).current.aceMatchHold)
    const again = isHeld ? null : story.eventFor(acted, EVENT_TRIGGER.외출, random)
    setScreen(again === null ? { kind: '외출' } : { kind: '이벤트', eventId: again.id, context: '외출진입' })
  }

  /** 본 표시 · 보상 · 통계 · 히든 알림을 얹은 끝난 커리어 */
  const viewedCareerOf = (current: PlayerCareer, eventScreen: EventScreen, rewards: readonly EventReward[], seenIds: readonly number[]) => {
    const viewed = withBattingOrderRewards(current, applyEventRewards(finishEvent(current, seenIds), rewards, random, eventScreen.eventId), rewards)
    recordEventGamePoints(recordStat, rewards)
    const hiddenIds = announcedHiddenIdsOf(rewards)
    if (hiddenIds.length > 0) announceHiddenOpen?.(hiddenIds)
    return viewed
  }

  /** 본 이벤트를 얹은 뒤 갈 곳 — 장소 · 시즌 사슬 · 엔딩 · 외출 진입 · 105 */
  const leaveViewedEvent = (viewed: PlayerCareer, eventScreen: EventScreen, viewedEventIds: readonly number[], endingEventId: number | null) => {
    if (eventScreen.context === '장소') return finishPlaceEvent(viewed, eventScreen.eventId)
    if (eventScreen.context === '시즌') return continueSeason(viewed, viewedEventIds, endingEventId !== null)
    // 114 끝 1c088 — 뒤 상태가 113(장소)이 아니면 [0x1552adc](첫 종류 21 로 끝남)를 지우고 141. 부상 엔딩 500(105 진입
    // 0x113e8)이 이 길이다. 장소(위)에서 끝난 종류 21 은 원본도 칸을 남겨 두고 105 · 112 틀 1d056 이 141 로 보내는데, 종류 21
    // 이벤트(500 · 501 · 503 · 504)는 대상 0 이라 훑기로 안 나오고 장소 이벤트의 선택지 · 예아니오 · 경기 결과도 그리로 안
    // 이어져(가리키는 곳은 496 → 503 하나) 원본 데이터로는 닿지 않는다.
    if (endingEventId !== null) return enterEnding(viewed, judgeEnding(viewed) ?? NO_ENDING_JUDGEMENT)
    if (eventScreen.context === '외출진입') return finishOutingEntryEvent(viewed, eventScreen.eventId)
    atoms.set(rawCareerAtom, viewed)
    setScreen({ kind: '관리' })
  }

  return (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
    if (career === null || screen.kind !== '이벤트') return
    if (screen.context === '연초') {
      // 내장 이벤트라 본 표시·보상이 없다. 목표 창이 닫히면 0x7fe90 이 S+0x1b7 = 1 (해마다 한 번) → 뒤 105
      atoms.set(rawCareerAtom, { ...career, hasSeenYearGoalWindow: true })
      return setScreen({ kind: '관리' })
    }
    // 첫 종류 21 로 끝난 이벤트는 본 표시를 안 한다(0x8cf8c 를 안 지난다)
    const seenIds = endingEventId === null ? viewedEventIds : viewedEventIds.filter((id) => id !== endingEventId)
    leaveViewedEvent(viewedCareerOf(career, screen, rewards, seenIds), screen, viewedEventIds, endingEventId)
  }
}
