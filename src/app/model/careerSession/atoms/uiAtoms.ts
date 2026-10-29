import { atom } from 'jotai'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { OutingPresentation, OutingResult } from '@/entities/career/model/outing'
import type { ManagementDetail } from '@/app/model/managementDetail'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { NariMatchAces } from '@/pages/management/lib/nariMatchPrepare'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import type { EventReward } from '@/entities/story/model/eventReward'

/** 화면 칸 atom — 알림 · 결과 창 · 연출처럼 저장하지 않는 관리 장면 칸 */

export const shopNoticeAtom = atom('')
/** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
export const shopGpDetailAtom = atom<GpDetailOf<PlayerCareer> | null>(null)
export const outingNoticeAtom = atom('')
/** 상태 126 결과 팝업 두 장 — 효과 글(0x15234)과 입원 회복 글(0x1575c). 효과 팝업이 떠 있지 않으면 null */
export const outingResultAtom = atom<OutingResult | null>(null)
/**
 * 상태 126 연출 (진입 0x11da8 → 0x85074 · 그리기 0x16874) — 고른 기능과 장소 p([gfx+0x184] = 지도 프레임 − 1).
 * 연출이 끝난 틀(0x84e58)에 효과 0x15234 를 굴려 `outingResult` 를 띄우고, 효과 팝업이 닫힐 때까지 판(띠 · 검정)이 남는다.
 */
export const outingPresentationAtom = atom<OutingPresentation | null>(null)
export const managementNoticeAtom = atom('')
/** 상세정보 결과 창 (0x8a0a4) — 닫을 때 훈련은 부상, 휴식은 회복을 굴린다 */
export const managementDetailAtom = atom<ManagementDetail | null>(null)
/** 142 진입 0x1c46c 가 세운 무대로 0x5fd04 가 떠 둔 경기정보 바탕 (`rollNariMatchInfoStage`). 142 에 들어온 적이 없으면 null */
export const matchInfoStageAtom = atom<MatchInfoStadiumState | null>(null)
/** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 — 경기정보 마투수·마타자 줄이 읽는다 */
export const matchAcesAtom = atom<NariMatchAces | null>(null)
/** 143 경기 전 엔트리 보기 (진입 0x16af8 · 키 0x1457c) — 142 위에 선다. 없으면 null */
export const entryViewAtom = atom<NariEntryView | null>(null)
/**
 * 116 → 114 평가 이벤트의 보상 명령 — 이미 준 몫(`given`). 0x8c460 이 명령마다 주고 끝(0x8b0e4 · 0x8cd44)에서 저장하므로
 * 첫 몫을 줄 때 S+0x50 이 114 진입 값(3 · 0xb — 웹 null)으로 저장된다(Q-23). 116 에 들어설 때 비운다 (그림에 안 쓰는 칸)
 */
export const evaluationRewardsAtom = atom<{ readonly rewards: readonly EventReward[]; readonly given: number } | null>(null)
/** 105 → 112 로 들어설 때의 행동함(S+4) — B-26 고친 길에서 지도 취소가 되돌릴 값. 지도 밖이면 null (그림에 안 쓰는 칸) */
export const outingEntryActedAtom = atom<boolean | null>(null)
/** 필살타법 결과 알림(125 의 알림 창)이 떠 있다 — 닫히면 105 진입 (그림에 안 쓰는 칸) */
export const specialSwingNoticeAtom = atom(false)
/** 부상 첫 팝업 0x28 이 떠 있다 — 닫히면 105 틀 0x1aec4 가 둘째 팝업 0x29(`INJURY_FOLLOW_UP_NOTICE`)를 띄운다 (그림에 안 쓰는 칸) */
export const injuryNoticeAtom = atom(false)
