import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { ManagementCommand, SubMenuKind } from '@/pages/management/lib/managementLayout'
import { leaveNariSubMenu, nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { NO_DISABLED_IDS, SPECIAL_SWING_MENU_ID, SUB_MENU_KINDS } from './menuTypes'
import type { MenuContext } from './menuContext'

const slotIndexOf = (m: MenuContext, id: string) => m.slots.findIndex((slot) => slot.id === id)

/** 105 메인 — 하위 메뉴 · 휴식 질문 · 그 밖(외출 · 다음경기 …)은 세션으로 */
function selectMain(m: MenuContext, id: string) {
  if (SUB_MENU_KINDS.includes(id)) return m.openSubMenu(id as SubMenuKind)
  if (id === '휴식' && !m.props.isRestBlocked()) {
    // 팝업 0x2a "예" → 127 진입 0x190e4(연출 0x85230). 굴림 · 결과 창 · 저장(0x18e3c)은 연출이 끝난 틀이다(`finishRest`)
    // StrMODE[90] — 0x1261c 12682~126bc 가 0x702b5([장면+0x144], 0x5a)로 꺼내는 글(투수편과 같다)
    return m.ask(ORIGINAL_MODE_TEXT[90] ?? '', () => m.setRestPhase('playing'))
  }
  return m.props.onSelect(id as ManagementCommand)
}

/**
 * 107 트레이닝 — 칸 4(필살타법)는 한계 검사(0x12e40~) 대신 0x12e02~0x12e2e 에서 **레벨 검사 없이** 곧장 창
 * (상태 0x6c)을 연다. 그 앞의 사기 0 가드(0x12d8a, StrMODE[193])만 먼저 돈다 (R7 4절).
 * 칸별 가드(이미 배움·인기도·선행·G 부족)는 창의 키 처리 0x17828 이 맡는다 → `SpecialSwingWindow`.
 * StrMODE[85] 질문도 안 쓴다 — 창의 StrMODE[66] "배우시겠습니까?" 가 그 자리다.
 */
function selectTraining(m: MenuContext, id: string) {
  if (id === SPECIAL_SWING_MENU_ID) {
    if (m.props.career.morale <= 0) return m.props.onTrainingBlocked(id)
    return m.setOverlay('필살타법훈련')
  }
  if (m.props.isTrainingBlocked(id)) return m.props.onTrainingBlocked(id)
  return m.ask(`!C[!cFFFF00${id}훈련!cFFFFFF]을 하시겠습니까?`, () => m.startTraining(id))
}

/** 110 확인 → 111 상점(키 0x11478) — 상점 취소는 110 으로 돌아온다(0x13460 의 13b1e), 커서는 고른 칸 그대로 */
function selectItem(m: MenuContext, id: string) {
  leaveNariSubMenu(m.mainCursor, '아이템', slotIndexOf(m, id))
  return m.props.onOpenShop(id)
}

/** 106 선수정보 — 기본정보 카드(119) · 기록실 · 필살타법 · 스킬 창, 그 밖은 화면을 바꾼다 */
function selectPlayerInfo(m: MenuContext, id: string) {
  if (id === '기본정보') return m.setIsShowingBasicInfo(true)
  // 106 칸 4 [기록실] → 팝업 0x80 · 124 (`pages/nari-record-room`) · 칸 3 [필살타법] → 0x7b
  if (id === '기록실' || id === '필살타법') return m.setOverlay(id)
  // 아이템/스킬(하위 상태 122) — 스킬 장착 창. 세션이 장착을 받지 않으면 예전처럼 바깥에 맡긴다
  if (id === '아이템/스킬' && m.props.onEquipSkill !== undefined) return m.setOverlay(id)
  // 106 칸 1 → 121 장비착용(키 0x13010) — 그 취소는 106 으로 돌아온다(0x17ad0 의 17aee → 0x6a). 106 진입 0x11530 은 이전이 105 가
  // 아니라 커서를 안 건드린다 — 장비착용 칸 그대로
  if (id === '장비착용') leaveNariSubMenu(m.mainCursor, '선수정보', slotIndexOf(m, id))
  m.props.onOpenPlayerInfo(id)
}

const SELECT_BY_KIND = { main: selectMain, 트레이닝: selectTraining, 아이템: selectItem, 선수정보: selectPlayerInfo } as const

/** 연출 · 질문 · 결과 창 · 하위 창이 떠 있으면 고르지 않는다 */
const isSelectBlocked = (m: MenuContext) =>
  m.isTrainingState || m.restPhase === 'playing' || m.question !== null || m.props.detail !== null || m.overlay !== null

/** 칸 고르기 — 105 키 0x1261c · 106 0x13010 · 107 0x12d48 · 110 0x11478 의 확인 */
export const menuSelectOf = (m: MenuContext) => (id: string) => {
  if (isSelectBlocked(m)) return
  // 105 키 0x1261c — 확인(−5 · '5')이면 칸(꺼짐 · 하위 메뉴)을 보기 전에 0x12654 mgr+0x304 = 0
  if (m.kind === 'main') m.props.onMainConfirm?.()
  if (NO_DISABLED_IDS.has(id)) return
  return SELECT_BY_KIND[m.kind](m, id)
}

/** 125 키 0x105a4 · 127 키 0x10650 은 확인만 본다 — 취소 없음(결과 창은 제 키로 닫힌다). 칸 펼침 중에도 버린다 */
const isBackLocked = (m: MenuContext) => m.isTrainingState || m.restPhase === 'playing' || m.isSliding()

/** 취소 — 120 → 119 · 하위 창 닫기 · 119 → 106 · 105 → 나가기 · 106 · 107 · 110 → 105 */
export const menuBackOf = (m: MenuContext) => () => {
  if (isBackLocked(m)) return
  // 120 의 취소 → 119 (0x1b654)
  if (m.abilityDetailOffset !== null) return m.setAbilityDetailOffset(null)
  if (m.overlay !== null) return m.setOverlay(null)
  // 기본정보(119) 의 취소 → 106(선수정보 하위 메뉴) — 0x1056c (R9 「119·129·120」)
  if (m.isShowingBasicInfo) return m.setIsShowingBasicInfo(false)
  if (m.kind === 'main') return m.props.onExit()
  // 106 · 107 · 110 취소 → 105 진입: 행동함이면 첫 칸, 단 110(아이템)에서 오면 남는다 (0x11910 1194a~11970)
  const index = COMMAND_SLOTS.findIndex((slot) => slot.id === m.kind)
  m.open('main', null)
  m.setMainCursor(nariMainCursorOnEntry(index, m.props.career.hasActedThisCycle, m.kind === '아이템'))
  m.props.onReenter?.()
}
