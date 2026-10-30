import { useLayoutEffect, useState } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { PITCHER_COMMAND_BAR, pitcherLabelDxOf, pitcherParentSlotOf } from '@/pages/pitcher-league/lib/pitcherCommandBar'
import type { PitcherCommandKind } from '@/pages/pitcher-league/lib/pitcherCommandBar'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { CommandBar, moveNariMainCursor, moveNariSubCursor, nariMainCursorOnEntry } from './otherSlices'
import type { NariMainMenuCursor } from './otherSlices'
import { usePitcherBarKeys } from './usePitcherBarKeys'

const NO_DISABLED: ReadonlySet<string> = new Set()
/** 커서를 옮긴 뒤 두 번 그리는 동안 +1, −1 로 튄다 (카운터 [gfx+0x98]) */
const BOUNCE_BY_UPDATE = [1, -1]
/** 칸 등장 0x7ff8c 가 다 내려온 뒤의 갱신 수 — 하위 메뉴로 돌아올 때는 펼침(0x7ff55)이 없어 칸이 제자리다 */
const SETTLED_UPDATES = 1_000
/**
 * 칸이 펼쳐지는 동안 키(취소 포함) · 누름을 버린다 — 105 키 0x1261c 머리 [gfx+0x99] · 106 0x13010 · 107 0x12d48 · 110 0x11478 머리
 * [gfx+0x9a]. 0x7ff21(105 진입) · 0x7ff55(105 키가 하위 메뉴를 열 때)가 1, 틀의 0x7ff8d · 0x8003d 가 t ≥ 7 에 0 (타자편 `useManagementMenu`, A-50)
 */
const SLIDE_KEY_LOCK_UPDATES = 7

/** 커서 튐 — 옮긴 뒤 갱신 수로 `BOUNCE_BY_UPDATE`, 그 밖은 0 */
const bounceOf = (movedAt: number | null, update: number) => (movedAt === null ? 0 : (BOUNCE_BY_UPDATE[update - movedAt] ?? 0))

interface BarState {
  readonly kind: string
  readonly cursor: number
  readonly openedAt: number
  readonly movedAt: number | null
  readonly entryCount: number
}

/**
 * 하위 메뉴가 선 채로 마운트되면(하위 창 119 · 122~124 · 108 이나 상점 111 · 121 에서 돌아옴) 그 하위 메뉴 객체의 커서 그대로,
 * 칸은 다 펼쳐져 있다(106 진입 0x11530 은 이전 105 일 때만 · 107 · 110 진입은 커서를 안 건드리고 펼침 0x7ff55 도 없다)
 */
function initialBarStateOf(kind: string, mainCursor: NariMainMenuCursor, entryCount: number): BarState {
  const isMain = kind === '관리'
  return {
    kind,
    cursor: isMain ? mainCursor.current : (mainCursor.subCursor ?? 0),
    openedAt: isMain ? 0 : -SETTLED_UPDATES,
    movedAt: null,
    entryCount,
  }
}

/**
 * 줄 표가 바뀐 그림 — 관리 메뉴 커서를 옮긴다(그리는 중에 원본 메뉴 객체 칸을 고치던 자리). 105 로 돌아오면 그 하위 메뉴 칸
 * (행동함이면 첫 칸 — 0x11910 1194a~11970, 110 아이템에서 오면 남는다), 105 에서 하위 메뉴로 가면 106 은 진입이,
 * 107 · 110 은 앞선 105 진입이 커서를 0 으로 되감아 둔다.
 */
function applyBarKindChange(
  mainCursor: NariMainMenuCursor,
  slots: readonly { readonly id: string }[],
  from: string,
  kind: string,
  hasActed: boolean,
) {
  if (kind !== '관리') {
    moveNariSubCursor(mainCursor, 0)
    return
  }
  const returning = Math.max(
    0,
    slots.findIndex((slot) => slot.id === from),
  )
  moveNariMainCursor(mainCursor, nariMainCursorOnEntry(returning, hasActed, from === '아이템'))
}

interface PitcherCommandBarProps {
  readonly menu: PitcherManagementMenu
  readonly isKeyEnabled: boolean
  /** 칸이 펼쳐지는 중인가 — 머리띠 되돌아가기(취소)도 함께 막도록 화면에 알린다 */
  readonly slidingRef: { current: boolean }
  /** 관리 메뉴 [this+0x8c] 켬 표가 0 인 칸 — 105 진입 0x11910 (`nariMainMenuOffIdsOf`) */
  readonly mainOffIds: ReadonlySet<string>
  readonly mainCursor: NariMainMenuCursor
  /** S+4(행동함) */
  readonly hasActed: boolean
}

/**
 * 커맨드 줄 0x7e418 (투수 표 `lib/pitcherCommandBar`). 칸 등장 0x7ff8c · 부모 칸 0x8003c 는 메뉴가 열린 뒤 갱신 수로,
 * 키는 위·아래·좌·우 칸 옮기기 · 확인(Enter · '5') · 취소(−16).
 * 하위 메뉴에서 돌아오면 커서가 그 하위 메뉴 칸에 선다(타자편 `useManagementMenu` 와 같다) — 단 그 105 진입이 행동함이면 첫 칸
 * (0x11910 1194a~11970, 110 아이템에서 오면 남는다). 관리 메뉴 커서는 루트의 `mainCursor` 에 산다.
 */
export function PitcherCommandBar({ menu, isKeyEnabled, mainOffIds, mainCursor, hasActed, slidingRef }: PitcherCommandBarProps) {
  const kind = menu.kind as PitcherCommandKind
  const isMain = kind === '관리'
  const slots = PITCHER_COMMAND_BAR[kind]
  const update = useUpdateCounter()
  const labelOrigins = useFrameOrigins(assetUrl('./sprites/img_text/frames'))
  const [state, setState] = useState(() => initialBarStateOf(kind, mainCursor, menu.entryCount))
  /*
   * 105 진입 0x11910 은 어디서 왔든 11c26 에서 0x7ff21 을 불러 여섯 칸을 처음 자리(표 0xd4740 x, y 0xaa)로 되돌리고 [gfx+0x99] = 1
   * — 틀 0x1aec4 1af8a → 0x7ff8d 가 다시 펼친다. 하위 메뉴 취소 · 125 훈련 결과는 줄 표가 바뀌는 길이라 아래 갈래가 치고,
   * 127 휴식 결과 창이 닫혀(0x1b308 1b466 · 틀 0x19080 190cc `0xbcb49(0x69)`) 다시 든 105 는 줄 표가 그대로라 진입 수로 친다
   */
  if (state.entryCount !== menu.entryCount && state.kind === kind) {
    setState({ ...state, entryCount: menu.entryCount, openedAt: update, movedAt: null })
  }
  if (state.kind !== kind) {
    applyBarKindChange(mainCursor, slots, state.kind, kind, hasActed)
    setState({ kind, cursor: isMain ? mainCursor.current : 0, openedAt: update, movedAt: null, entryCount: menu.entryCount })
  }
  const cursor = Math.min(isMain ? mainCursor.current : state.cursor, slots.length - 1)
  const moveTo = (index: number) => {
    if (index === cursor) return
    if (isMain) moveNariMainCursor(mainCursor, index)
    else moveNariSubCursor(mainCursor, index)
    setState((held) => ({ ...held, cursor: index, movedAt: update }))
  }
  /** 105 켬 표 0 칸 — 메뉴 객체 이동 vt+8 0x6c445 가 건너뛰어 커서가 서지 못한다(하위 메뉴 표는 늘 켜져 있다) */
  const isOffSlot = (index: number) => isMain && mainOffIds.has(slots[index]?.id ?? '')
  const isSliding = update - state.openedAt < SLIDE_KEY_LOCK_UPDATES
  // 화면의 머리띠 되돌아가기가 볼 값 — 커밋 때 적는다(누름은 늘 커밋 뒤에 온다)
  useLayoutEffect(() => {
    slidingRef.current = isKeyEnabled && isSliding
  })
  usePitcherBarKeys(isKeyEnabled, () => ({ cursor, slots, moveTo, menu, isOffSlot, isSliding }))

  const labelWidths = Object.fromEntries(slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]))
  return (
    <CommandBar
      slots={slots}
      cursor={cursor}
      bounce={bounceOf(state.movedAt, update)}
      slideUpdates={Math.max(0, update - state.openedAt)}
      // 메인 메뉴 켬 표(흑백 0xc37a8)는 105 진입 0x11910 이 타자편과 같은 코드로 끈다 — 0x7e418 은 하위 메뉴가 없을 때만
      // 그 표를 본다. 확인 키는 표를 안 보지만 커서가 흑백 칸에 서지 못한다(vt+8 0x6c445) — 눌러도(터치) 고르지 않는다
      disabledIds={NO_DISABLED}
      grayedIds={isMain ? mainOffIds : undefined}
      labelWidths={labelWidths}
      parent={pitcherParentSlotOf(kind)}
      labelDxOf={(slot) => pitcherLabelDxOf(kind, slot)}
      onHover={(index) => {
        if (isKeyEnabled && !isSliding && !isOffSlot(index)) moveTo(index)
      }}
      onSelect={(id) => {
        if (!isSliding && !isOffSlot(slots.findIndex((slot) => slot.id === id))) menu.select(id)
      }}
    />
  )
}
