import { useEffect, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTrainingPlayback } from '@/widgets/training-scene/model/useTrainingPlayback'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { ManagementCommand, MenuSlot, SubMenuKind } from '@/pages/management/lib/managementLayout'
import type { ManagementScreenProps } from '@/pages/management/ui/ManagementScreen'

/** 커서를 옮긴 뒤 두 번 갱신하는 동안 +1, −1 로 튄다 (카운터 +0x98) */
const BOUNCE_BY_UPDATE = [1, -1]
/** r_event_txt[176] 트레이닝·휴식·외출은 관리 주기마다 한 가지만 */
const CYCLE_COMMANDS = ['트레이닝', '휴식', '외출']
const SUB_MENU_KINDS: readonly string[] = ['선수정보', '트레이닝', '아이템']
/** 트레이닝 하위 메뉴 칸 4 — 능력 훈련(칸 0~3)과 흐름이 다르다 */
const SPECIAL_SWING_MENU_ID = '필살타법'

type MenuKind = 'main' | SubMenuKind

/** 관리 화면을 덮는 창 */
export type ManagementOverlay = '기록실' | '필살타법' | '칭호'

/** 관리 화면 커서·하위 메뉴·훈련 연출 상태 */
export function useManagementMenu(props: ManagementScreenProps) {
  const [kind, setKind] = useState<MenuKind>('main')
  const [cursor, setCursor] = useState(0)
  const [parent, setParent] = useState<MenuSlot | null>(null)
  const [movedAt, setMovedAt] = useState<number | null>(null)
  const [openedAt, setOpenedAt] = useState(0)
  /** 선수정보 하위 메뉴에서 연 카드 — 상태판 자리에 그린다 (0x15e20) */
  const [isShowingBasicInfo, setIsShowingBasicInfo] = useState(false)
  /** 선수정보 하위 메뉴에서 관리 화면 위에 띄우는 창 — 기록실 0x7f070 · 필살타법 0x803d4 */
  const [overlay, setOverlay] = useState<ManagementOverlay | null>(null)
  /** 예/아니오 질문 (StrMODE[85] 훈련 · [90] 휴식) */
  const [question, setQuestion] = useState<{ text: string; onYes: () => void } | null>(null)
  const update = useUpdateCounter()
  // 훈련 연출이 끝나면 결과를 반영하고 메인 메뉴(상태 0x69)로 돌아간다
  const playback = useTrainingPlayback((menuId) => {
    props.onTraining(menuId)
    open('main', null)
    setCursor(COMMAND_SLOTS.findIndex((slot) => slot.id === '트레이닝'))
  })
  const slots = kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[kind]
  const disabledIds = new Set(kind === 'main' && props.career.hasActedThisCycle ? CYCLE_COMMANDS : [])

  const open = (next: MenuKind, nextParent: MenuSlot | null) => {
    setIsShowingBasicInfo(false)
    setOverlay(null)
    setKind(next)
    setParent(nextParent)
    setCursor(0)
    setOpenedAt(update)
  }
  const moveCursor = (index: number) => {
    if (index === cursor) return
    setCursor(index)
    setMovedAt(update)
  }
  const back = () => {
    if (playback.playingMenuId !== null) return
    if (overlay !== null) return setOverlay(null)
    if (kind === 'main') return props.onExit()
    const index = COMMAND_SLOTS.findIndex((slot) => slot.id === kind)
    open('main', null)
    setCursor(index)
  }

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
      if (props.isTrainingBlocked(id)) return props.onTrainingBlocked(id)
      // StrMODE[85] 질문은 능력 훈련 칸 0~3 에만 붙는다. 칸 4(필살타법)는 원본에서
      // 전용 화면(상태 0x6c, StrMODE[69]~[71])으로 가며 이 질문을 쓰지 않는다 —
      // 그 화면이 아직 없어 연출로 바로 넘긴다.
      if (id === SPECIAL_SWING_MENU_ID) return playback.start(id)
      return ask(`!C[!cFFFF00${id}훈련!cFFFFFF]을 하시겠습니까?`, () => playback.start(id))
    }
    if (kind === '아이템') return props.onOpenShop(id)
    if (id === '기본정보') return setIsShowingBasicInfo(true)
    if (id === '기록실' || id === '필살타법') return setOverlay(id)
    props.onOpenPlayerInfo(id)
  }

  // 질문 창이 떠 있을 때의 키는 MessageBox 가 잡는 단계에서 가져가므로 여기까지 오지 않는다
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (props.detail !== null) {
        if (event.key === 'Enter' || event.key === 'Escape') props.onCloseDetail()
        return
      }
      if (event.key === 'Escape' || event.key === 'Backspace') return back()
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
    overlay,
    closeOverlay: () => setOverlay(null),
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
