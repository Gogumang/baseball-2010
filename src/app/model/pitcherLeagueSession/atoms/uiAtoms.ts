import { atom } from 'jotai'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import type { OutingPresentation, OutingResult } from '@/entities/career/model/outing'

/** 화면 칸 atom — 상점 · 외출의 알림 · 결과 창 · 연출처럼 저장하지 않는 칸 */

/** 상점 장면의 창 — '장착' 111 장비 상점 · '착용' 121 장비착용 */
export const shopTabAtom = atom<PitcherShopTab>('장착')
export const shopNoticeAtom = atom('')
/** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
export const shopGpDetailAtom = atom<GpDetailOf<PitcherCareer> | null>(null)
export const outingNoticeAtom = atom('')
/** 126 효과 팝업(0x15234) 과 이어질 입원 회복 글(0x1575c) — 효과 팝업이 떠 있지 않으면 null */
export const outingResultAtom = atom<OutingResult | null>(null)
/** 126 연출(0x85074) 중인 외출 — 장소 p 와 고른 기능. 효과 팝업이 닫힐 때까지 남는다 */
export const outingPresentationAtom = atom<OutingPresentation | null>(null)
/** 126 에서 105 로 돌아온 뒤 관리 화면 위에 남는 입원 회복 팝업 글 (0x1575c). 없으면 '' */
export const outingRecoveryNoticeAtom = atom('')
/**
 * 112 진입(0x118e4) 횟수 — 늘 때마다 [!] 칸을 다시 찍는다(`outingSlots`). 105 → 112(`openOuting`) · 지도 자동 이벤트에서
 * 돌아옴(`뒤 112`) · 대결결과 140(105 진입 0x11910 의 0x11bb2 가 0x118e4 를 부른다)에서 는다. 장소(113)에서 돌아오는 길은 아니다.
 */
export const outingEntryCountAtom = atom(0)
/** 빈 장소 뒤 113 으로 돌아갈 장소 — 112 에 들어서면 지운다 */
export const outingReturnPlaceIdAtom = atom<string | null>(null)
/** 105 → 112 로 들어설 때의 행동함(S+4) — B-26 고친 길에서 지도 취소가 되돌릴 값. 지도 밖이면 null (그림에 안 쓰는 칸) */
export const outingEntryActedAtom = atom<boolean | null>(null)
/** 112 자동 훑기가 마지막으로 돈 진입 수 (그림에 안 쓰는 칸) */
export const scannedOutingEntryAtom = atom(0)
