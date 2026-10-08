import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTrainingPlayback } from '@/widgets/training-scene/model/useTrainingPlayback'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { ManagementCommand, MenuSlot, SubMenuKind } from '@/pages/management/lib/managementLayout'
import type { ManagementScreenProps } from '@/pages/management/ui/ManagementScreen'
import {
  abilityDetailScrollKeyOf, batterAbilityDetailViewOf, scrollAbilityDetail,
} from '@/pages/management/lib/abilityDetail'
import {
  createNariMainMenuCursor, leaveNariSubMenu, nariMainCursorOnEntry, nariReturnSubMenuOf,
} from '@/pages/management/model/nariMainMenuCursor'

/** 커서를 옮긴 뒤 두 번 갱신하는 동안 +1, −1 로 튄다 (카운터 +0x98) */
const BOUNCE_BY_UPDATE = [1, -1]
/** r_event_txt[176] 트레이닝·휴식·외출은 관리 주기마다 한 가지만 */
const CYCLE_COMMANDS = ['트레이닝', '휴식', '외출']
const SUB_MENU_KINDS: readonly string[] = ['선수정보', '트레이닝', '아이템']
/** 트레이닝 하위 메뉴 칸 4 — 능력 훈련(칸 0~3)과 흐름이 다르다 */
const SPECIAL_SWING_MENU_ID = '필살타법'
/** 칸 등장 0x7ff8c 가 다 내려온 뒤의 갱신 수 — 하위 메뉴로 돌아올 때는 펼침(0x7ff55)이 없어 칸이 제자리다 */
const SETTLED_UPDATES = 1_000

type MenuKind = 'main' | SubMenuKind

/**
 * 관리 화면을 덮는 창.
 * 필살타법 창은 그림(0x803d4)이 하나인데 상태가 둘이다 — 선수정보 칸 3 → 상태 0x7b(`'필살타법'`, 고르기) ·
 * 트레이닝 칸 4 → 상태 0x6c(`'필살타법훈련'`, 배우기) (R7 4절).
 */
export type ManagementOverlay = '기록실' | '필살타법' | '필살타법훈련' | '칭호' | '아이템/스킬'

/** 관리 화면 커서·하위 메뉴·훈련 연출 상태 */
export function useManagementMenu(props: ManagementScreenProps) {
  /** 관리 메뉴 [this+0x8c] 커서 — 루트가 들고 있으면 그것(다른 화면을 다녀와도 남는다), 아니면 이 화면 몫 */
  const ownMainCursor = useRef(createNariMainMenuCursor()).current
  const mainCursor = props.mainCursor ?? ownMainCursor
  /** 111 상점 · 121 장비착용에서 돌아왔으면 그 하위 메뉴(110 · 106) 그 칸, 다 펼쳐진 채 (`nariReturnSubMenuOf`) */
  const [returned] = useState(() => nariReturnSubMenuOf(mainCursor))
  const [kind, setKind] = useState<MenuKind>(returned?.kind ?? 'main')
  const [cursor, setCursor] = useState(() => returned?.cursor ?? mainCursor.current)
  const [parent, setParent] = useState<MenuSlot | null>(
    () => (returned === null ? null : COMMAND_SLOTS.find((slot) => slot.id === returned.kind) ?? null),
  )
  const [movedAt, setMovedAt] = useState<number | null>(null)
  const [openedAt, setOpenedAt] = useState(returned === null ? 0 : -SETTLED_UPDATES)
  useEffect(() => {
    mainCursor.returnSubMenu = null
  }, [mainCursor])
  /** 선수정보 하위 메뉴에서 연 카드 — 상태판 자리에 그린다 (0x15e20) */
  const [isShowingBasicInfo, setIsShowingBasicInfo] = useState(false)
  /**
   * 능력치 상세 창(상태 120) 글 상자 첫 줄 — 창 +0x380 (진입 0x1b624 가 0 으로). null 이면 창이 없다.
   * 119 에서 '0' 으로 열고, 취소·'0' 이면 119 로 (키 0x1b654).
   */
  const [abilityDetailOffset, setAbilityDetailOffset] = useState<number | null>(null)
  /** 선수정보 하위 메뉴에서 관리 화면 위에 띄우는 창 — 기록실 0x7f070 · 필살타법 0x803d4 */
  const [overlay, setOverlay] = useState<ManagementOverlay | null>(null)
  /** 예/아니오 질문 (StrMODE[85] 훈련 · [90] 휴식) */
  const [question, setQuestion] = useState<{ text: string; onYes: () => void } | null>(null)
  const update = useUpdateCounter()
  // 훈련 연출이 끝나면 결과를 반영하고 메인 메뉴(상태 0x69)로 돌아간다
  const playback = useTrainingPlayback((menuId) => {
    props.onTraining(menuId)
    open('main', null)
    // 125 → 105 — 커서는 메뉴 객체 그대로(트레이닝 칸). 행동함이면 105 진입이 첫 칸으로 (아래 `awaitingEntry`)
    setMainCursor(COMMAND_SLOTS.findIndex((slot) => slot.id === '트레이닝'))
  })
  const slots = kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[kind]
  const disabledIds = new Set(kind === 'main' && props.career.hasActedThisCycle ? CYCLE_COMMANDS : [])

  const setMainCursor = (index: number) => {
    mainCursor.current = index
    setCursor(index)
  }
  const open = (next: MenuKind, nextParent: MenuSlot | null) => {
    setIsShowingBasicInfo(false)
    setAbilityDetailOffset(null)
    setOverlay(null)
    setKind(next)
    setParent(nextParent)
    setCursor(0)
    setOpenedAt(update)
  }
  const moveCursor = (index: number) => {
    if (index === cursor) return
    if (kind === 'main') mainCursor.current = index
    setCursor(index)
    setMovedAt(update)
  }
  const back = () => {
    if (playback.playingMenuId !== null) return
    // 120 의 취소 → 119 (0x1b654)
    if (abilityDetailOffset !== null) return setAbilityDetailOffset(null)
    if (overlay !== null) return setOverlay(null)
    // 기본정보(119) 의 취소 → 106(선수정보 하위 메뉴) — 0x1056c (R9 「119·129·120」)
    if (isShowingBasicInfo) return setIsShowingBasicInfo(false)
    if (kind === 'main') return props.onExit()
    // 106 · 107 · 110 취소 → 105 진입: 행동함이면 첫 칸, 단 110(아이템)에서 오면 남는다 (0x11910 1194a~11970)
    const index = COMMAND_SLOTS.findIndex((slot) => slot.id === kind)
    open('main', null)
    setMainCursor(nariMainCursorOnEntry(index, props.career.hasActedThisCycle, kind === '아이템'))
  }

  /*
   * 화면 안에서 행동(훈련 125 · 휴식 127 — S+4 = 1)을 하면 원본은 그 상태를 거쳐 105 로 다시 들어온다. 그 105 진입이 행동함이라
   * 커서를 첫 칸으로 되돌린다(이전 상태 125 · 127). 웹은 행동함이 막 선 것을 보고, 결과 창 · 연출이 걷혀 메인 메뉴만 남는 때에
   * 그 진입을 친다.
   */
  const wasActed = useRef(props.career.hasActedThisCycle)
  const [awaitingEntry, setAwaitingEntry] = useState(false)
  const isIdleMain = kind === 'main' && playback.playingMenuId === null && props.detail === null && question === null
    && overlay === null && !isShowingBasicInfo
  useLayoutEffect(() => {
    if (props.career.hasActedThisCycle && !wasActed.current) setAwaitingEntry(true)
    wasActed.current = props.career.hasActedThisCycle
  })
  useLayoutEffect(() => {
    if (!awaitingEntry || !isIdleMain) return
    setAwaitingEntry(false)
    setMainCursor(nariMainCursorOnEntry(mainCursor.current, props.career.hasActedThisCycle, false))
  })

  const ask = (text: string, onYes: () => void) => setQuestion({ text, onYes })
  const answer = (isYes: boolean) => {
    const pending = question
    setQuestion(null)
    if (isYes) pending?.onYes()
  }

  const select = (id: string) => {
    if (playback.playingMenuId !== null || question !== null || props.detail !== null || disabledIds.has(id)) return
    if (overlay !== null) return
    if (kind === 'main') {
      if (SUB_MENU_KINDS.includes(id)) return open(id as SubMenuKind, COMMAND_SLOTS.find((slot) => slot.id === id) ?? null)
      if (id === '휴식' && !props.isRestBlocked()) {
        return ask('!C[!cFFFF00휴식!cFFFFFF]을 취하시겠습니까?', () => props.onSelect('휴식'))
      }
      return props.onSelect(id as ManagementCommand)
    }
    if (kind === '트레이닝') {
      // 칸 4(필살타법)는 한계 검사(0x12e40~) 대신 0x12e02~0x12e2e 에서 **레벨 검사 없이** 곧장 창
      // (상태 0x6c)을 연다. 그 앞의 사기 0 가드(0x12d8a, StrMODE[193])만 먼저 돈다 (R7 4절).
      // 칸별 가드(이미 배움·인기도·선행·G 부족)는 창의 키 처리 0x17828 이 맡는다 → `SpecialSwingWindow`.
      // StrMODE[85] 질문도 안 쓴다 — 창의 StrMODE[66] "배우시겠습니까?" 가 그 자리다.
      if (id === SPECIAL_SWING_MENU_ID) {
        if (props.career.morale <= 0) return props.onTrainingBlocked(id)
        return setOverlay('필살타법훈련')
      }
      if (props.isTrainingBlocked(id)) return props.onTrainingBlocked(id)
      return ask(`!C[!cFFFF00${id}훈련!cFFFFFF]을 하시겠습니까?`, () => playback.start(id))
    }
    // 110 확인 → 111 상점(키 0x11478) — 상점 취소는 110 으로 돌아온다(0x13460 의 13b1e), 커서는 고른 칸 그대로
    if (kind === '아이템') {
      leaveNariSubMenu(mainCursor, '아이템', slots.findIndex((slot) => slot.id === id))
      return props.onOpenShop(id)
    }
    if (id === '기본정보') return setIsShowingBasicInfo(true)
    if (id === '기록실' || id === '필살타법') return setOverlay(id)
    // 아이템/스킬(하위 상태 122) — 스킬 장착 창. 세션이 장착을 받지 않으면 예전처럼 바깥에 맡긴다
    if (id === '아이템/스킬' && props.onEquipSkill !== undefined) return setOverlay(id)
    props.onOpenPlayerInfo(id)
  }

  // 질문 창이 떠 있을 때의 키는 MessageBox 가 잡는 단계에서 가져가므로 여기까지 오지 않는다
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (props.detail !== null) {
        if (event.key === 'Enter' || event.key === 'Escape') props.onCloseDetail()
        return
      }
      // 120 키 0x1b654 — 취소·'0' → 119, 그 밖은 0x8a044 글 스크롤(↑·'2' / ↓·'8', 나머지 키는 아무 일도 없다)
      if (abilityDetailOffset !== null) {
        if (event.key === 'Escape' || event.key === 'Backspace' || event.key === '0') return setAbilityDetailOffset(null)
        const direction = abilityDetailScrollKeyOf(event.key)
        if (direction === null) return
        event.preventDefault()
        const lineCount = batterAbilityDetailViewOf(props.career).messages.length
        return setAbilityDetailOffset(scrollAbilityDetail(abilityDetailOffset, lineCount, direction))
      }
      if (event.key === 'Escape' || event.key === 'Backspace') return back()
      // 119 키 0x1056c — '0'(0x30) → 120 능력치 상세 (진입 0x1b624: 글을 새로 만들고 스크롤 0)
      if (event.key === '0' && isShowingBasicInfo && overlay === null) return setAbilityDetailOffset(0)
      /*
       * 기본정보 카드(상태 119) 에서 칭호 목록(상태 129) 을 여는 키.
       *
       * ⚠️ 원작 설명서 StrHOWTO[15] 는 "[선수정보] -> [기본정보]에서 **(#) 키**로 확인 및 변경" 이라 적었지만,
       * 119 의 키 처리 `0x1056c` 가 실제로 보는 값은 **'*'(0x2a)** 다 (R9 「119·129·120 … 확정」:
       * `취소(−16) → 106, '*'(0x2a) → 129, '0'(0x30) → 120`). 설명서와 코드가 어긋나는 자리라
       * **코드 쪽을 그대로 옮긴다**. 129 에서 '*' 는 다시 119 로 돌아가는 키다 (0x11f9a, P3 10-1).
       */
      if (event.key === '*') {
        if (overlay === '칭호') return setOverlay(null)
        if (isShowingBasicInfo && overlay === null) return setOverlay('칭호')
        return
      }
      // 창이 열려 있으면 뒤쪽 커맨드 줄은 방향키·확인에 반응하지 않는다
      if (overlay !== null) return
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) moveCursor((cursor + step + slots.length) % slots.length)
      if (event.key === 'Enter') select(slots[cursor].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return {
    kind,
    isShowingBasicInfo,
    abilityDetailOffset,
    closeAbilityDetail: () => setAbilityDetailOffset(null),
    overlay,
    closeOverlay: () => setOverlay(null),
    /** 필살타법 창(상태 0x6c)의 StrMODE[66] "예" — 원본은 상태 0x7d → 0x17f5c(연출 뒤 0xa3bac) */
    startSpecialSwingTraining: () => {
      setOverlay(null)
      playback.start(SPECIAL_SWING_MENU_ID)
    },
    cursor,
    parent,
    disabledIds,
    bounce: movedAt === null ? 0 : (BOUNCE_BY_UPDATE[update - movedAt] ?? 0),
    slideUpdates: Math.max(0, update - openedAt),
    playingMenuId: playback.playingMenuId,
    finishTraining: playback.finish,
    question,
    answer,
    moveCursor,
    select,
    back,
  }
}
