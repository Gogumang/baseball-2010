import type { ReactNode } from 'react'
import type { Collection } from '@/entities/collection/model/collection'
import { SPECIAL_ITEMS } from '@/pages/special/lib/specialLayout'
import type { SecretCodeState } from '@/pages/special/ui/specialScreen/otherSlices'
import type { HallOfFameDeletion } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

export type SpecialView = '목록' | '기록연감' | '명예의 전당' | '마선수선택' | '에디트'

export interface SpecialScreenProps {
  readonly collection: Collection
  /**
   * **스페셜 마선수 선택** (하위 상태 28 — 그리기 0x2df78 · 갱신 0x2af20): 마선수 오픈·레벨업 격자.
   * 화면은 `pages/general-mode` 의 마선수 고르기(`mode="레벨업"`)라 앱이 꽂아 준다.
   * `onBack` 은 CLR — 원본도 상태 6(이 목록)으로 돌아간다 (0x2b126 → 0xbcb49(…, 6)).
   * 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderAceSelect?: (onBack: () => void) => ReactNode
  /**
   * **스페셜 에디트** (하위 상태 29 — 갱신 0x2b2e0 · 그리기 0x2e1e0): 선수 이름 바꾸기.
   * 화면은 `pages/special-edit` 이라 앱이 꽂아 준다. `onBack` 은 팀 고르기의 CLR — 원본도 상태 6(이 목록)으로
   * 돌아간다 (0x2b432 `0xbcb49(this+0x18, 6)`). 안 넘기면 칸을 눌러도 아무 일이 없다.
   */
  readonly renderEdit?: (onBack: () => void) => ReactNode
  /** 명예의 전당 말풍선 "슬롯에서 삭제" (0x2ac00 · 0x62994). 안 넘기면 안내만 띄운다 */
  readonly hallOfFameDeletion?: HallOfFameDeletion
  /**
   * 전역 G(`mgr+0x64`) — 머리띠 0x54d95 는 제목이 −1 이 아니면 오른쪽 위에 G포인트(0x54a60)를 그린다(0x550d8~0x550de).
   * 스페셜 목록(하위 6, 0x2860c → `0x54d95(skin, 0, 5)`)과 명예의 전당(하위 27, 0x2dcd8 → `0x54d95(skin, 16, 5)`)이 다 그렇다.
   * 넘기면 두 화면 머리띠를 G 까지 그리고, 안 넘기면 예전처럼 제목 0 띠만(G 없음) 그린다.
   */
  readonly gamePoint?: number
  /** 기록연감 비밀 번호 상태 — 메뉴 객체에 사는 값이라 들고 있는 쪽(메인 메뉴)이 넘긴다 (`RecordAnnals` 참고) */
  readonly annalsSecretCode?: SecretCodeState
  readonly onAnnalsSecretCodeChange?: (next: SecretCodeState) => void
  /**
   * 바탕 띠 `[메뉴+0xe4]` 가 이미 다 자랐는가 — 같은 장면에서 띠가 자란 뒤 다시 서는 경우(되돌리는 코드가 없다).
   * 안 넘기면 처음 메뉴 OK(0x294b8 — 칸이 무엇이든 [0xe2] · [0xe4] = 1)로 막 내려온 것이라 1 부터 자란다
   */
  readonly isBandGrown?: boolean
  readonly onBack: () => void
}

/** 고른 칸 열기가 고르는 하위 화면 — 꽂아 줄 화면이 없는 칸(마선수선택 · 에디트)은 null(아무 일 없음) */
export function specialViewOf(id: (typeof SPECIAL_ITEMS)[number]['id'], { renderAceSelect, renderEdit }: SpecialScreenProps): SpecialView | null {
  if (id === '마선수선택') return renderAceSelect === undefined ? null : '마선수선택'
  if (id === '에디트') return renderEdit === undefined ? null : '에디트'
  return id === '기록연감' ? '기록연감' : '명예의 전당'
}
