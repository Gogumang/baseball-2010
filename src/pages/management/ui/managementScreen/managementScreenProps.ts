import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { ManagementCommand } from '@/pages/management/lib/managementLayout'
import type { NariMainMenuCursor } from '@/pages/management/model/nariMainMenuCursor'
import type { DetailResult } from '@/pages/management/lib/detailPopup'

export interface ManagementScreenProps {
  readonly career: PlayerCareer
  readonly noticeText: string
  /** 휴식·외출·다음경기 */
  readonly onSelect: (command: ManagementCommand) => void
  /** 훈련 하위 메뉴 — 연출이 끝난 뒤 불린다 */
  readonly onTraining: (menuId: string) => void
  /** 훈련할 수 없는 칸을 골랐을 때 알림을 띄운다 */
  readonly onTrainingBlocked: (menuId: string) => void
  readonly isTrainingBlocked: (menuId: string) => boolean
  readonly isRestBlocked: () => boolean
  /** 상세정보 결과 창 — 닫을 때 onCloseDetail */
  readonly detail: DetailResult | null
  readonly onCloseDetail: () => void
  /**
   * 알림 상자에서 [확인] 을 눌렀다 — 알림을 가진 쪽이 비워야 한다.
   * 화면이 "이미 본 문구"를 기억하면 같은 문구가 다시 와도 안 뜨고 (막힌 칸을 두 번 고르는 경우),
   * 다른 화면을 다녀와 다시 마운트되면 지난 알림이 되살아난다.
   */
  readonly onDismissNotice: () => void
  readonly onOpenShop: (tab: string) => void
  readonly onOpenPlayerInfo: (itemId: string) => void
  /**
   * 칭호 목록(하위 상태 129)에서 하나를 골랐다 — 선수 +0x1c4 에 쓰고 저장한다 (0x11f78).
   * 안 넘기면 그 창이 열리지 않는다.
   */
  readonly onEquipTitle?: (title: string) => void
  /**
   * 필살타법 창(상태 0x7b)에서 기술을 골랐다 — 선수 +0x18 에 쓰고 저장한다 (틀 0x17bf4 의 0x17c64,
   * `selectSpecialSwingNumber`). 안 넘기면 창이 고른 번호를 스스로만 들고 있다(저장 안 됨).
   */
  readonly onSelectSpecialSwing?: (number: number) => void
  /**
   * 스킬 창(선수정보 "아이템/스킬", 하위 상태 122)의 장착·해제 — 대화 0x147b0 번호 4·3 → 0xa4b04(P, s, on).
   * 안 넘기면 그 칸은 `onOpenPlayerInfo` 로 간다.
   */
  readonly onEquipSkill?: (skillId: number, on: boolean) => void
  /** 같은 창의 슬롯 확장 — 대화 번호 6 (0x1484c) */
  readonly onExpandSkillSlots?: () => void
  /** 하위 메뉴 106 · 107 · 110 취소로 105 에 다시 들어온다 — 세션이 진입 0x11910 · 자동 훑기 0x1cf9c 를 돈다 */
  readonly onReenter?: () => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
  /** 메인 메뉴로 나간다. 진행 상황은 이미 저장되어 있다. */
  readonly onExit: () => void
  /**
   * 가운데 판 0x7f814 의 선수가 미끄러져 들어오는가 — 105 진입 0x11910 이 이전 상태 1 · 114(이벤트) · 100(경기 뒤)이면
   * 0x8a2d8 을 부른다(0x11c6e~0x11c80). 그 밖(상점 · 외출 취소 등)에서 돌아오면 제자리에 선다.
   */
  readonly centerSlidesIn?: boolean
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 장면이 서 있는 동안 남는 값이라 루트가 들고(105 진입 규칙 `nariMainCursorOnEntry` 도 루트가
   * 화면이 바뀔 때 친다), 이벤트 끝 틀(`NariMainCommandBar`)도 같은 값을 그린다. 안 넘기면 화면이 스스로 0 부터 든다.
   */
  readonly mainCursor?: NariMainMenuCursor
}
