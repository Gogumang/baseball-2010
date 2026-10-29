import { actedAfterOutingMapCancel, outingBlockReasonOf, outingBlockTextOf, performOuting } from '@/entities/career/model/outing'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'
import { emptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { OUTING_PLACES, type OutingPlace } from '@/shared/config/outingPlaces'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import { type CareerStoryScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { outingReentryCountAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import * as uiAtoms from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import type { useOutingSlots } from '@/app/model/careerSession/outing/useOutingSlots'

const outingFunctionOf = (functionId: string) => OUTING_PLACES.flatMap((place) => place.functions).find((candidate) => candidate.id === functionId)

/** 112 외출 지도 · 113 장소 · 126 외출 효과 (그림마다 새 함수 — 옛 꼴 그대로). `outingSlots` 는 112 진입에 찍은 [!] 칸 */
export function useOutingActions(scope: CareerStoryScope, { outingSlots }: Pick<ReturnType<typeof useOutingSlots>, 'outingSlots'>) {
  const { atoms, random, setScreen, story } = scope
  const career = useShownCareer(scope)
  const outingPresentation = useCareerValue(atoms, uiAtoms.outingPresentationAtom)
  const outingResult = useCareerValue(atoms, uiAtoms.outingResultAtom)
  return {
    runOutingFunction: (functionId: string) => {
      const outingFunction = outingFunctionOf(functionId)
      if (career === null || outingFunction === undefined) return
      // 113 가드 0x16cf0 — 막히면 원문 팝업(StrMODE[62]·[77]·[196]·[91])만 띄우고 113 에 남는다 (굴림 없음).
      // 앞서 웹은 판정 없이 runOuting 을 불러 막힌 기능을 고르면 예외가 났다.
      const reason = outingBlockReasonOf(career, outingFunction)
      if (reason !== null) return atoms.set(uiAtoms.outingNoticeAtom, outingBlockTextOf(reason, outingFunction))
      // 113 → 126: 연출(0x85074 — event_ani · event_char_1 · event_char_0 세 겹, `outingPresentation`)이 끝난 틀에 효과(0x15234)를
      // 굴려 효과 팝업을 지도 위에 띄우고(`finishOutingPresentation`), 그 팝업이 닫히면 입원 회복(0x1575c)을 굴린다
      const place = OUTING_PLACES.find((candidate) => candidate.functions.includes(outingFunction))
      atoms.set(uiAtoms.outingNoticeAtom, '')
      atoms.set(uiAtoms.outingPresentationAtom, { functionId, place: (place?.frame ?? 1) - 1 })
    },

    /** 126 연출 끝(0x84e58 이 참인 틀) — 효과 0x15234 를 굴려 효과 팝업을 띄운다. 연출 동안 굴림은 없다 */
    finishOutingPresentation: () => {
      if (career === null || outingPresentation === null || outingResult !== null) return
      const outingFunction = outingFunctionOf(outingPresentation.functionId)
      if (outingFunction === undefined) return
      const outcome = performOuting(career, outingFunction, random)
      atoms.set(uiAtoms.outingResultAtom, { effectText: outcome.effectText, recoveryText: outcome.recoveryText })
      atoms.set(rawCareerAtom, outcome.career)
    },

    /**
     * 113 취소 → 112 — 키 0x16c64 의 −16 이 `0xbcb49(0x70)`: 112 진입 0x118e4 가 [!] 를 다시 찍고(0x8cdc0 — 커서 0) 그 틀의 자동 발동
     * 0x1cf9c 가 화면 112 로 훑는다(0x8be80 — 무작위 조건까지 · 대결 대기 가드 B-124). 찾으면 [다음 114, 뒤 112] (Q-22)
     */
    reenterOutingMap: () => {
      if (career === null) return
      atoms.set(outingReentryCountAtom, (count) => count + 1)
      story.rewindCursor()
      const isHeld = isAutoScanHeldByAceMatch(atoms.get(portsMirrorAtom).current.aceMatchHold)
      const event = isHeld ? null : story.eventFor(career, EVENT_TRIGGER.외출, random)
      if (event !== null) setScreen({ kind: '이벤트', eventId: event.id, context: '외출진입' })
    },

    /** 113 막힘 팝업(0xbbef9(글, 1, 1, 1)) [확인] — 상태는 113(말풍선) 그대로다 */
    closeOutingNotice: () => atoms.set(uiAtoms.outingNoticeAtom, ''),

    /**
     * 112 외출 지도 취소(CLR) → 105 — 키 0x13ba4 13bc0~13bca 가 **S+4(행동함) = 0** 으로 내린 뒤 0xbcb49(0x69) · 0x7ff21.
     * 원본 버그(B-26): 행동함 뒤 흑백 외출 칸으로 들어갔다 취소하면 트레이닝 · 휴식 · 외출 칸이 다시 켜진다 — 고친 길(기본)은 들어설 때 값으로.
     * 저장은 이 키가 아니라 이어지는 105 진입 0x11910(119a2)이 한다 — 웹은 커리어가 바뀌면 저장한다
     */
    leaveOutingMap: () => {
      // B-26 고침이면 들어설 때의 값으로 되돌린다 (`actedAfterOutingMapCancel`)
      const acted = career === null ? false : actedAfterOutingMapCancel(career.hasActedThisCycle, atoms.get(uiAtoms.outingEntryActedAtom))
      atoms.set(uiAtoms.outingEntryActedAtom, null)
      if (career !== null && career.hasActedThisCycle !== acted) atoms.set(rawCareerAtom, { ...career, hasActedThisCycle: acted })
      setScreen({ kind: '관리' })
    },

    /**
     * 126 효과 팝업 [확인] — 틀 0x1575c: 입원이면 회복 글 팝업(코드 1)을 띄우고, 어느 쪽이든 **105(관리)** 로 간다.
     * 회복 팝업은 105 위에 남으므로 관리 화면 알림 상자로 띄운다.
     */
    closeOutingResult: () => {
      if (outingResult === null) return
      atoms.set(uiAtoms.outingResultAtom, null)
      atoms.set(uiAtoms.outingPresentationAtom, null)
      if (outingResult.recoveryText !== '') atoms.set(uiAtoms.managementNoticeAtom, outingResult.recoveryText)
      setScreen({ kind: '관리' })
    },

    /**
     * [!] 장소에서 [들어가기] — 0x8ce58: 112 진입에 찍어 둔 그 장소 칸의 이벤트를 본다(다시 훑지 않는다).
     * 113 칸 0 (키 0x16c64 의 0x16c8a~0x16cee, 직접 떴다)에는 행동(S+4) · 인기도 가드가 없다(가드 0x16cf0 은 칸 1
     * 장소 기능 쪽). 모드 갈림도 없어 투수편 `enterOutingPlace` 와 같다. 이벤트를 고르는 데 굴림은 없다.
     */
    enterPlace: (place: OutingPlace) => {
      if (career === null) return
      // 칸이 비었으면 "특별한 일이 없다" (0x16ccc — 440 + 장소)
      const eventId = outingSlots.get(place.id) ?? emptyPlaceEventId(place.frame)
      setScreen({ kind: '이벤트', eventId, context: '장소' })
    },
  }
}
