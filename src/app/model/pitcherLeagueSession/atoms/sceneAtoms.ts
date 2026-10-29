import { atom } from 'jotai'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { PitcherScene, PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import { NOT_ARRIVED, type ManagementArrival } from '@/app/model/pitcherLeagueSession/management/managementArrival'

/** 나리 장면 칸 atom — 화면 · 이벤트 재생 · 장면 셋업 · 105 진입 · 칭호처럼 장면 객체가 든 칸 */

export const sceneAtom = atom<PitcherScene>('등록')
/** 지금 재생하는 이벤트 (장면 '이벤트'). 아니면 null */
export const storyAtom = atom<PitcherStory | null>(null)
/**
 * r_event 본문(events.ts, 535KB)은 첫 화면에 필요 없어 커리어가 생긴 뒤 따로 불러온다 — 타자편
 * `useStorySchedule` 과 같은 방식(번들러가 별도 청크로 자른다). 오기 전에는 장소 이벤트가 없는 것으로 본다.
 */
export const fileEventsAtom = atom<readonly OriginalEvent[] | null>(null)
/**
 * 이벤트 레코드 커서 (0xadc70 의 reader+0x28) — 105·112 자동 발동이 함께 쓴다. 원본 reader 는 장면이 들고 저장에 없다 —
 * 장면 셋업 0xf684 의 `0xacf60` 이 0 으로 둔다 (`setUpPitcherScene`). (그림에 안 쓰는 칸)
 */
export const cursorAtom = atom(0)
/**
 * mgr+0x304 — 장면 셋업(0xf684 fb7a)이 1, 105 관리 메뉴 확인 키(0x12654)가 0. 자동 훑기 0x8be80 이 reader+0x34 로 베껴
 * 판정 ②(490 쿨다운)를 건너뛰게 한다 (`isIllnessCooldownBlocked`). (그림에 안 쓰는 칸)
 */
export const freshSceneAtom = atom(true)
/** 반복 이벤트 본 표시 지우기 대기 — 장면 셋업의 `0xacf60`. 이 세션이 처음 화면에 설 때도 장면이 선다 */
export const shouldForgetRepeatableAtom = atom(true)
/** 셋업 0xf684 fb92~fba8 — 경기 수 == 2 면 외출 칸 +0x6a = 0. 경기 뒤 커리어 커밋 뒤 렌더에서 지운다 (`withNariSceneSetupOutings`) */
export const sceneSetUpCountAtom = atom(0)
/** 새 선수 플래그 (장면+0x165) — 등록(104)에서 100 으로 왔을 때 켜진다 (0x1c3be). 오프닝 451 을 부른다 (그림에 안 쓰는 칸) */
export const newPlayerAtom = atom(false)
/** 화면이 '관리' 인 채 105 에 다시 들어온 수 (`reenterManagement`) — 도착 고리가 마지막으로 본 값과 다르면 진입이다 */
export const managementReentryCountAtom = atom(0)
/** 화면이 '관리' 인 채 125 → 105 로 다시 들어와 배경음 4 를 다시 튼 수 (`PitcherLeagueSession.managementBgmRestart`) */
export const managementBgmRestartAtom = atom(0)
/** 105 도착 고리가 지난번에 본 것 (`managementArrival`) — 고리 안에서만 읽고 쓴다 */
export const managementArrivalAtom = atom<ManagementArrival>(NOT_ARRIVED)
/**
 * 관리 장면 +0x270 — 117 진입 0x11e84(11ee6~11f4a)가 칭호 1 · 9 를 주지 않고 넣어 두는 칸. 서 있으면 105 둘째 틀에 판정 0x1a1c0
 * 대신 그 칭호의 팝업이 선다(`pendingTitle`). 확인 0x1b1e4 가 비트 · 장착 · 저장 뒤 −1 로 둔다
 */
export const heldTitleAtom = atom<string | null>(null)
/**
 * 결과 상태 125(훈련) · 127(휴식)의 창이 떠 있다 — 관리 메뉴가 알린다(`onResultWindowChange`). 원본은 그동안 105 가 아니라
 * 105 갱신 0x1aec4 끝의 칭호 판정이 돌지 않는다. 창이 닫히면 0x18dd8 · 0x1b5b8 · 0x1b466 이 `0xbcb49(0x69)` 로 105 에 들어온다
 */
export const isResultWindowOpenAtom = atom(false)
/** 배경음 끊기 고리가 지난번에 본 화면 섬 — 처음 값은 첫 그림의 `isOnScreen` (그림에 안 쓰는 칸) */
export const wasOnScreenForBgmAtom = atom(false)
