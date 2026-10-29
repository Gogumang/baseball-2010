import { useEffect } from 'react'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { PitcherScene, PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import {
  fileEventsAtom,
  managementArrivalAtom,
  managementReentryCountAtom,
  sceneAtom,
  shouldForgetRepeatableAtom,
  storyAtom,
} from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useOpenStory } from '@/app/model/pitcherLeagueSession/events/useOpenStory'
import { useScanAuto } from '@/app/model/pitcherLeagueSession/events/useScanAuto'
import { useEnterOutingMap } from '@/app/model/pitcherLeagueSession/outing/useEnterOutingMap'
import { advanceManagementArrival } from '@/app/model/pitcherLeagueSession/management/managementArrival'
import { runManagementArrival } from '@/app/model/pitcherLeagueSession/management/managementArrivalSteps'

/** 관리 화면에 이벤트 · 셋업 지우기 없이 섰나 (이벤트 본문이 온 뒤) */
function isIdleScene(scene: PitcherScene, story: PitcherStory | null, fileEvents: readonly OriginalEvent[] | null, shouldForgetRepeatable: boolean) {
  return scene === '관리' && story === null && fileEvents !== null && !shouldForgetRepeatable
}

/**
 * **관리 화면(105)의 이벤트** — 원본은 한 틀 안에서 두 자리가 차례로 돈다 (R9 2절 · A 3절):
 *
 * 1. **진입 0x11910 의 곁가지**(0x11b24~0x11c1c) — 부상 엔딩 → 미션 복귀 140 → **연초 115**(S+0x1b7 == 0) →
 *    **중간평가 117**(경기 수 22 · 그 해 비트 꺼짐) 중 하나를 다음 상태로 예약한다 (투수편엔 138 타순이 없다).
 * 2. **자동 발동 0x1cf9c** — 현재 상태가 105 면 — **상태가 바뀐 틀에만**(1ce02 `0xbc9c9` 가 거짓이면 0x1d06a):
 *    ```
 *      1cfa6: 장면+0x165(새 선수) ≠ 0 → 0x8bde0(모드 3 → 451) · [다음 114, 뒤 105] · 플래그 지움   ; 예약을 덮는다
 *      1cfdc: 다음 상태 ∈ {114, 115} 면 건너뜀                                                  ; 115 는 막고 117 은 안 막는다
 *      1cfe4: 전역 +0x11f · +0x176 이 서 있으면 건너뜀
 *      1d02c: 0x8be80(…, 화면코드 105) 찾으면 [다음 114, 뒤 105]                                ; 117 예약을 덮는다
 *    ```
 *    그래서 한 번 들어올 때의 차례는 **451 → 115 → (trigger 0 이벤트들) → 117** 이다(확정 — 상태 틀 0x1cdec 는 진입 점프표
 *    0xcc728 를 부른 뒤 **같은 틀에** 0x1cf9c 로 떨어지고, 0xbcb48 은 `+0xc = +8 ; +8 = s` 라 진입 0x11bd6 의 115 예약이 밀려
 *    사라진다. 타자편도 같다 — `useCareerSession`) — 덮인 예약은 이벤트에서
 *    105 로 돌아와 진입이 다시 돌 때 또 선다. 판정은 모드 3(대상 1·3, `isPitcherEventEligible`)이고, 히든 변화구 30~33
 *    (대상 3 · 능력치 조건)도 이 훑기 안에서 나온다.
 *
 * **훑기는 상태가 105 로 바뀐 틀에만 돈다** — 상태 틀 0x1cdec 는 0xbc9c9(이번 틀에 상태가 바뀌었나)가 거짓이면 곧장 0x1d06a 로
 * 가(0x1ce02~0x1ce0c) 진입과 0x1cf9c 를 건너뛴다. 105 에 머무는 틀에는 훑지 않고, 들어온 틀에는 어디서 왔든 훑으며 0x8be80 은
 * 늘 무작위 조건(22 질병 490 · 20 스킬 획득 확률)까지 굴린다. 그래서 경기 · 이벤트 · 외출 효과(126) · 지도 취소(112) ·
 * 순위표 취소(109)뿐 아니라 화면이 '관리' 인 채 105 에 다시 들어오는 길 — 하위 메뉴 106 · 107 · 110 취소, 훈련 결과 창
 * (125, 0x1b5b8) · 휴식(127, 0x1b466) · 마구 훈련(125) — 도 진입이다(`reenterManagement`). 상점에서 돌아오는 길(111 취소 → 110 ·
 * 121 취소 → 106)은 하위 메뉴로 서므로 105 진입이 아니다. 셋업의 반복 이벤트 지우기가 아직이면 그 뒤에 훑는다 — 원본은 셋업
 * 0xf684 가 105 진입보다 먼저다.
 */
export function useManagementArrival(scope: PitcherScope): void {
  const { atoms, isOnScreen, random } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const shouldForgetRepeatable = usePitcherValue(atoms, shouldForgetRepeatableAtom)
  const managementReentryCount = usePitcherValue(atoms, managementReentryCountAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  const openStory = useOpenStory(atoms)
  const scanAuto = useScanAuto(atoms)
  const enterOutingMap = useEnterOutingMap(atoms)
  useEffect(() => {
    const isIdle = isOnScreen && career !== null && isIdleScene(scene, story, fileEvents, shouldForgetRepeatable)
    const { next, isArrival } = advanceManagementArrival(atoms.get(managementArrivalAtom), { scene, isIdle, reentryCount: managementReentryCount })
    atoms.set(managementArrivalAtom, next)
    if (!isArrival || career === null || fileEvents === null) return
    runManagementArrival({ atoms, career, fileEvents, random, openStory, commitWith, scanAuto, enterOutingMap })
  }, [
    atoms,
    career,
    commitWith,
    enterOutingMap,
    fileEvents,
    isOnScreen,
    managementReentryCount,
    openStory,
    random,
    scanAuto,
    scene,
    shouldForgetRepeatable,
    story,
  ])
}
