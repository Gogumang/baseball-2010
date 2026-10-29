import { atom } from 'jotai'
import { createManagementEntryMarker, type ManagementEntryMarker } from '@/app/model/careerSession/management/managementEntryMarker'

/** 나리 장면 칸 atom — 장면 셋업 · 105 진입 · 112 진입 · 칭호 · 연차 표지처럼 장면 객체가 든 칸 */

/**
 * 셋업 0xf684 를 부른 수 — fb92~fba8 의 외출 칸 지우기를 그 커밋 뒤에 한다(`useSceneSetUpOutings`).
 * 셋업은 경기 뒤 커리어가 들어오기 전에 불리므로(경기 정산이 경기 수를 올린 뒤의 장면이다) 그 커밋 뒤 렌더에서 지운다
 */
export const sceneSetUpCountAtom = atom(0)
/** 반복 이벤트 본 표시 지우기 대기 — 장면 셋업 0xf684 의 `0xacf60` (이벤트 본문이 도착한 뒤에 지운다) */
export const shouldForgetRepeatableAtom = atom(false)
/**
 * 장면+0x288 — 142 진입의 마선수 넣기를 **장면마다 한 번**만 하게 막는 칸 (1c566~1c572 · 1c668). 장면 셋업 0xfb7c 가
 * 0 으로 둔다 → 장면이 새로 서는 이어하기(`continueSaved`)와 경기 뒤(`finishGame`)에 내린다. (그림에 안 쓰는 칸)
 */
export const matchPreparedAtom = atom(false)
/**
 * 새 선수 플래그 장면+0x165 — 100 진입 끝 0x1c3be~0x1c3f8 이 이전 상태가 104(등록)일 때만 켜고, 105 · 112 틀의 0x1cfa6 이 오프닝
 * 451 을 번호로 부르며 지운다(1cfd6~1cfd8). 저장에 없는 칸이라 이어하기로는 안 선다(투수편 `newPlayerRef` 와 같다, A-54)
 */
export const newPlayerAtom = atom(false)
/** 화면이 '관리' 인 채 105 에 다시 들어온 수 (`reenterManagement`) */
export const managementReentryCountAtom = atom(0)
/** 105 진입 표지 — 그림이 세우고 진입 고리가 내린다 (`managementEntryMarker`). 처음 값은 store 를 만들 때 첫 화면으로 */
export const managementEntryMarkerAtom = atom<ManagementEntryMarker>(createManagementEntryMarker('메인메뉴'))
/** 113 취소로 112 에 다시 들어선 수 — 화면은 '외출' 그대로라 화면 바뀜 셈에 안 잡힌다(`reenterOutingMap`, Q-22) */
export const outingReentryCountAtom = atom(0)
/**
 * 117 진입 0x11e84(11ee6~11f4a)가 +0x270 에 **넣기만** 한 칭호 1 · 9 — 105 에 머무는 둘째 틀에 0x1a1c0 대신 그 팝업이 서고
 * (+0x270 ≥ 0 이라 판정을 건너뛴다) 확인이 비트 · 장착 · 저장을 한다 (`usePendingTitle`)
 */
export const heldTitleAtom = atom<string | null>(null)
/**
 * 새 시즌 0x1b768 을 부른 앞 상태(134 대진판 · 141 엔딩)가 아직 그리는 아홉 틀 — 화면은 그대로 두고 그 위에 효과기만 칠한다
 * (`startNewSeason` 의 `holdsPrevious` · `YearCoverHoldLayer`). 끝나면 `enterHeldYearCover` 가 137 로 넘긴다
 */
export const isYearCoverHeldAtom = atom(false)
/** 이벤트 일정 훅의 장면 셋업(커서 0 · mgr+0x304 = 1) — 일정 훅이 아래에서 서므로 상자로 잇는다. 세션마다 새 상자 */
export const storySetUpMirrorAtom = atom<{ current: () => void }>({ current: () => {} })
