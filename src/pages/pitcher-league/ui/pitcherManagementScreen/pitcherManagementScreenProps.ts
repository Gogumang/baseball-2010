import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import type { NariMainMenuCursor } from './otherSlices'

export interface PitcherManagementScreenProps {
  readonly career: PitcherCareer
  /** 훈련·휴식 굴림에 쓴다 */
  readonly random: RandomPort
  /** 바뀐 커리어를 저장한다 — 세션의 `actions.save` */
  readonly onSave: (career: PitcherCareer) => void
  /** [다음경기] — 세션의 `actions.beginGame` (원본 109 → 142 → 144 → 경기 장면 0x104) */
  readonly onNextGame: () => void
  /** [외출] 상태 112 */
  readonly onOuting: () => void
  /**
   * 111 상점('장착'·'서브'·'GP', [아이템] → 110 하위 메뉴 칸 0·1·2) · 121 장비착용('착용', [선수정보] 칸 1).
   * ([아이템/스킬] 122 는 화면이 스킬 창을 띄운다)
   */
  readonly onOpenShop: (tab: PitcherShopTab) => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
  /** 화면이 '관리' 인 채 105 에 다시 들어온다 — 세션의 `actions.reenterManagement` (`usePitcherManagementMenu` 의 `onReenter`) */
  readonly onReenter?: (from?: number) => void
  /** 125 · 127 결과 창이 떠 있는가 — 세션의 `actions.setResultWindowOpen` (`usePitcherManagementMenu` 의 `onResultWindowChange`) */
  readonly onResultWindowChange?: (isOpen: boolean) => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
  /** 가운데 판의 선수가 미끄러져 들어오는가 — 105 진입 0x11910 의 이전 상태 1 · 114 · 100 (0x8a2d8) */
  readonly centerSlidesIn?: boolean
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 루트가 들고(105 진입 규칙도 루트가 장면이 바뀔 때 친다) 이벤트 끝 틀도 같은 값을 그린다
   * (타자편 `ManagementScreen` 과 같다). 안 넘기면 화면이 스스로 0 부터 든다.
   */
  readonly mainCursor?: NariMainMenuCursor
}
