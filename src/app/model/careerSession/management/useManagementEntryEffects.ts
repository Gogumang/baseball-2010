import { useEffect } from 'react'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { type CareerStoryScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { managementEntryMarkerAtom, managementReentryCountAtom, shouldForgetRepeatableAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import type { ManagementEntry } from '@/app/model/careerSession/management/useManagementEntry'
import { scanManagementEntry } from '@/app/model/careerSession/management/managementEntryScan'

/**
 * 장면 셋업의 반복 이벤트 지우기와 105 진입 검사 — 둘 다 커밋 뒤(이벤트 본문이 온 뒤)에 돈다. 셋업이 먼저다.
 */
export function useManagementEntryEffects(scope: CareerStoryScope, { isManagementEntry }: ManagementEntry): void {
  const { atoms, story, random, setScreen } = scope
  const career = useShownCareer(scope)
  const marker = useCareerValue(atoms, managementEntryMarkerAtom)
  const managementReentryCount = useCareerValue(atoms, managementReentryCountAtom)
  const shouldForgetRepeatable = useCareerValue(atoms, shouldForgetRepeatableAtom)
  const events = story.events
  // 장면이 새로 서면 반복 이벤트를 다시 볼 수 있게 한다 (0xacf60, `setUpNariScene`) — 이벤트 본문이 도착한 뒤 커밋에서 지운다.
  // 105 진입 훑기(굴림)가 이 고침 다음 커밋에 도는 옛 차례 그대로다.
  // ⚠️ 내보인 `career` 가 아니라 **지금 칸**(`current`)에서 지운다 (r245): 경기 끝(`finishGame`)은 셋업과 같은 그림에 기록 달성 G
  // (0x4ea0c)를 커리어 칸에 얹는데, 그 그림의 내보인 커리어는 아직 지갑 값(얹기 전 G)이라 그것으로 갈아 끼우면 지갑 다리가
  // "커리어 G 가 줄었다" 로 읽어 지갑까지 되돌렸다 — 경기마다 기록 달성 G 가 사라졌다
  useEffect(() => {
    if (!shouldForgetRepeatable || career === null || events === null) return
    atoms.set(shouldForgetRepeatableAtom, false)
    atoms.set(rawCareerAtom, (current) => (current === null ? current : forgetRepeatableEvents(current, events)))
  }, [atoms, shouldForgetRepeatable, career, events])
  // 105 진입 표지가 선 그림에 돈다 — 일정(`story`)은 그림마다 새 객체라 커밋마다 돌고 표지가 거른다
  useEffect(() => {
    if (!isManagementEntry || !marker.isPending() || career === null || story.events === null) return
    // 셋업의 반복 이벤트 지우기가 아직이면 그 뒤에 훑는다 — 원본은 셋업 0xf684 가 105 진입보다 먼저다
    if (shouldForgetRepeatable) return
    marker.consume()
    scanManagementEntry({ atoms, career, story, random, setScreen })
  }, [atoms, isManagementEntry, managementReentryCount, career, story, random, setScreen, shouldForgetRepeatable, marker])
}
