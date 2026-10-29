import { useCallback } from 'react'
import { applyEventRewards, type EventReward } from '@/entities/story/model/eventReward'
import { markRewardedEvent, withOutingEventActed } from '@/entities/story/model/storyScene'
import { spendCycleAction } from '@/entities/career/model/playerCareer'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import type { useOutingSlots } from '@/app/model/careerSession/outing/useOutingSlots'
import { withRewardResumePatch } from '@/app/model/careerSession/events/rewardResumePatch'
import { recordEventGamePoints, withBattingOrderRewards } from '@/app/model/careerSession/events/eventRewardSteps'

/** 이벤트 재생 중 커리어를 고치는 자리 — 보상 명령 · 선택지 · system 창 · 마선수 대결 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useEventActions(scope: CareerScope, { storyEvents }: Pick<ReturnType<typeof useOutingSlots>, 'storyEvents'>) {
  const { atoms, random, recordStat, screen } = scope
  const career = useShownCareer(scope)
  /** 전역 기록의 히든 오픈 id 를 선수에게 옮긴다 — 더할 것이 없으면 그대로 둔다 */
  const syncOpenedHidden = useCallback(
    (ids: readonly number[]) => {
      atoms.set(rawCareerAtom, (previous) => {
        if (previous === null) return previous
        const missing = ids.filter((id) => !previous.openedHiddenIds.includes(id))
        return missing.length === 0 ? previous : { ...previous, openedHiddenIds: [...previous.openedHiddenIds, ...missing] }
      })
    },
    [atoms],
  )
  return {
    syncOpenedHidden,

    /**
     * **마선수 대결로 나가는 장소 이벤트의 끝 처리** — 이벤트 관리자 0x8cf64 의 match(SYS 8, 0x8d734~0x8d904)는 미션
     * 장면으로 가는 전환(0xbdae9)을 걸고 0x8a380 으로 관리자를 비운 뒤 **1(끝남)** 을 돌려준다 — 보통 이벤트 끝(0x8d506 →
     * 0x8d8ee)과 같은 꼬리다. 그래서 같은 틀의 114 끝 처리 0x1c014 가 그 자리에서 돌아, 뒤 상태가 113(장소)이고
     * +0x167 == 0 이면 S+4 = 1(행동함) · S+0x6a(외출 수)++ · 105 · 저장(0x1fded · 0x22755)을 한다.
     * 결과 이벤트(140 → `[다음 114, 뒤 105]`)의 끝에서는 장소 끝 처리를 다시 하지 않는다 (`대결결과`).
     * match 는 빈 장소 이벤트(440~444, +0x167 = 1)에 없다.
     */
    settlePlaceForAceMatch: () => {
      if (career === null) return
      atoms.set(rawCareerAtom, spendCycleAction({ ...career, outingsThisSeason: career.outingsThisSeason + 1 }))
    },

    /**
     * **SYS 8 타자편 갈래**(0x8d782~0x8d7ce) — g[0xf7] = team − 1 · g[0xec]/g[0xee] = 결과 이벤트 · g[0x11f] = 1 · g[0x144] = 0 ·
     * g[0xf6] = 모드 → 전역기록 저장(8d84a) · 지금 이벤트 본 표시(8d85c) · 커리어 저장(8d870). match 가 끝남을 돌려 114 끝
     * 0x1c014 의 0x8b0e4 가 떠나온 줄도 본 표시 · 저장한다. 대결을 나가도(0x40140) 이 칸들은 저장에 남는다.
     */
    holdAceMatch: (resultEvents: readonly number[], viewedEventIds: readonly number[]) => {
      // 8d84a 전역기록 저장 — 대기 칸
      atoms.get(portsMirrorAtom).current.aceMatchPending.hold(resultEvents)
      // 8d85c · 8d870 — 본 표시 · 커리어 저장
      atoms.set(rawCareerAtom, (current) => (current === null ? current : markRewardedEvent(current, null, viewedEventIds)))
    },

    /**
     * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: S+0x1b7 = 1 · 저장(0x22755).
     * 하위와 상관없이 모든 system 창이다. 웹 저장은 커리어가 바뀔 때마다라 이미 켜져 있으면 바뀌는 것이 없다.
     */
    confirmEventSystemWindow: () => {
      atoms.set(rawCareerAtom, (previous) =>
        previous === null || previous.hasSeenYearGoalWindow ? previous : { ...previous, hasSeenYearGoalWindow: true },
      )
    },

    /**
     * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 4 갈래). 이벤트 번호는 그
     * 명령이 든 이벤트다(연차 보정 0x8d508 이 지금 이벤트를 본다). 재생 화면이 `StoryScreen.onReward` 로 부르면 `completeScene` 에
     * 오는 보상은 비어 있다. 종류 7 의 히든 오픈 알림(0x62368 → 공용 창)은 재생 화면이 그 명령의 알림 창으로 띄우고 확인까지
     * 기다린다(`rewardNoticeOf` — 기다림 0x8daa0) — 여기서 따로 띄우지 않는다.
     *
     * **저장**: 원본 0x8c460 은 항목을 다 준 뒤 본 표시 · 장소 행동함을 하고 **곧바로 저장한다**(0x8b0e4 → 0x22755, 나리면 다시
     * 0x8cd44 → 0x22755 · 0x1f1b9 — `markRewardedEvent`). 그래서 웹이 커리어가 바뀔 때마다 저장하는 것이 이 자리에서는 원본보다
     * 잦지 않다 — 다만 그 저장에 본 표시 · 행동함이 들어야 이벤트 도중에 끄고 이어할 때 같은 이벤트가 다시 서지 않는다(원본 그대로).
     */
    giveEventReward: (items: readonly EventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      if (career === null || screen.kind !== '이벤트') return
      const given = withBattingOrderRewards(career, applyEventRewards(career, items, random, eventId), items)
      recordEventGamePoints(recordStat, items)
      const marked = markRewardedEvent(given, storyEvents?.find((event) => event.id === eventId) ?? null, viewedEventIds)
      // 8cc1a 0x8b0e4 의 0x8b12c — 112(외출 진입) · 113(장소)에서 연 이벤트면 440~444 를 빼고 행동함(S+4)을 켠 채 저장한다
      const acted = withOutingEventActed(marked, screen.context === '장소' || screen.context === '외출진입', eventId)
      // 8cc2e — 이벤트 번호로 이어하기 자리(S+0x50)를 고치고 8cd44 에서 다시 저장한다 (`withRewardResumePatch`)
      atoms.set(rawCareerAtom, withRewardResumePatch(acted, eventId, items))
    },

    /**
     * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 112/113 에서 연 이벤트면 S+4(0x8b12c — 지금
     * 이벤트가 440~444 가 아니면) · 저장. 웹 저장은 커리어가 바뀌면 고리가 한다 — 안 바뀌면 원본 저장도 같은 내용이다.
     */
    confirmEventChoice: (eventId: number, leftEventIds: readonly number[]) => {
      if (career === null || screen.kind !== '이벤트') return
      const marked = markRewardedEvent(career, null, leftEventIds)
      const acted = withOutingEventActed(marked, screen.context === '장소' || screen.context === '외출진입', eventId)
      if (acted !== career) atoms.set(rawCareerAtom, acted)
    },
  }
}
