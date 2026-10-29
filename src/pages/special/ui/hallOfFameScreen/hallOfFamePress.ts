import type { Collection, HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { firstEmptyHallOfFameSlot } from '@/entities/collection/model/collection'
import {
  HALL_OF_FAME_PITCHER_SLOTS,
  NARI_BATTER_SLOT,
  NARI_PITCHER_SLOT,
  hallOfFameEntryOfSlot,
  hallOfFameKeyCodeOf,
} from '@/pages/special/lib/specialLayout'
import { HALL_OF_FAME_TEXT } from '@/pages/special/ui/hallOfFameScreen/hallOfFameText'
import type { HallOfFameMode, HallOfFamePopup, HallOfFameSlotView } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

type RegisterMode = Extract<HallOfFameMode, { kind: '등록' }>
type PickMode = Extract<HallOfFameMode, { kind: '선수고르기' }>

/** 칸 누름이 고치는 것 — 팝업 · 말풍선 */
export interface HallOfFamePressContext {
  readonly collection: Collection
  readonly slots: readonly HallOfFameSlotView[]
  readonly showPopup: (popup: HallOfFamePopup) => void
  /** 말풍선 열기 — 커서 0 */
  readonly openBubble: () => void
}

const alertOf = (text: string, buttons: readonly string[] = ['확인']): HallOfFamePopup => ({ kind: '알림', text, buttons })

/** 7 잠긴 칸 — 칸 ≤ 4 면 [45] 투수 슬롯, 아니면 [54] 타자 슬롯 (현금 구매 🌐, 웹은 목록으로) */
const slotPurchaseOf = (isPitcherSlot: boolean) =>
  alertOf(isPitcherSlot ? HALL_OF_FAME_TEXT.buyPitcherSlots : HALL_OF_FAME_TEXT.buyBatterSlots, ['예', '아니오'])

const codeOf = (context: HallOfFamePressContext, target: number) => hallOfFameKeyCodeOf(context.slots[target].state, target)

/** 1·2 나리 선수 칸이 이 편이다 */
const isOwnNariCode = (mode: RegisterMode, code: number) => (code === 1 && mode.edition === '투수') || (code === 2 && mode.edition === '타자')

/** 5 나리 선수 없음 — 이 편의 나리 칸 (모드 3 칸 0 · 모드 4 칸 5) */
const isOwnMissingNari = (mode: RegisterMode, target: number) =>
  (mode.edition === '투수' && target === NARI_PITCHER_SLOT) || (mode.edition === '타자' && target === NARI_BATTER_SLOT)

type SlotEntry = ReturnType<typeof hallOfFameEntryOfSlot>
type RegisterPress = (mode: RegisterMode, target: number, entry: SlotEntry, context: HallOfFamePressContext) => void

/** 1·2 나리 선수 칸 → 첫 빈 칸이 있으면 [50] 확인, 없으면 [51] (0x62630 · 0x626a0) */
const pressRegisterNari: RegisterPress = (mode, target, _entry, context) => {
  if (!isOwnNariCode(mode, codeOf(context, target))) return
  const empty = firstEmptyHallOfFameSlot(context.collection, mode.edition)
  context.showPopup(empty === null ? alertOf(HALL_OF_FAME_TEXT.full) : { kind: '확인', slot: null })
}

/** 5 나리 선수 없음 → StrCOMMON[38] (0x62710) */
const pressRegisterMissingNari: RegisterPress = (mode, target, _entry, context) => {
  if (isOwnMissingNari(mode, target)) context.showPopup(alertOf(HALL_OF_FAME_TEXT.nariFirst))
}

/** 6 열린 빈 칸 — 자기 편 칸이면 그 칸으로 [50] 확인 (0x62728) */
const pressRegisterOpenSlot: RegisterPress = (mode, _target, entry, context) => {
  if (entry !== null && mode.edition === entry.side) context.showPopup({ kind: '확인', slot: entry.index })
}

/** 7 잠긴 칸 — 자기 편이면 슬롯 현금 구매 [45]/[54] (0x62772, 🌐) */
const pressRegisterLockedSlot: RegisterPress = (mode, _target, entry, context) => {
  if (entry !== null && mode.edition === entry.side) context.showPopup(slotPurchaseOf(entry.side === '투수'))
}

/**
 * 등록 목록의 키 확인 (0x62604~0x627d0) — 결과 코드와 지금 모드(3 투수 · 4 타자)로 가른다.
 * 3·4 명예 선수 칸은 결과 3·4 를 남길 뿐 상태 145 가 그 결과로 하는 일이 없다 (⚠️ 0x1ca4c 가 0·7·팝업만 본다 — 유력)
 */
const REGISTER_PRESS_BY_CODE: ReadonlyMap<number, RegisterPress> = new Map([
  [1, pressRegisterNari],
  [2, pressRegisterNari],
  [5, pressRegisterMissingNari],
  [6, pressRegisterOpenSlot],
  [7, pressRegisterLockedSlot],
])

/** 결과 1~4 — 글을 돌려받으면 목록 위에 알림으로 띄운다 */
function pickPlayer(mode: PickMode, chosen: HallOfFamePlayerPick, context: HallOfFamePressContext): void {
  const refusal = mode.onPick(chosen)
  if (typeof refusal === 'string') context.showPopup(alertOf(refusal))
}

/** 3·4 명전 선수 칸 — 결과는 그 편 명전 번호 */
const pickFamer = (mode: PickMode, _target: number, entry: SlotEntry, context: HallOfFamePressContext) => {
  if (entry !== null) pickPlayer(mode, { side: entry.side, hallOfFameIndex: entry.index }, context)
}

type PickPress = (mode: PickMode, target: number, entry: SlotEntry, context: HallOfFamePressContext) => void

/**
 * 선수 고르기의 키 확인 (0x627d4~0x6286c) — 칸 코드 표 0xd1da0: 1·2 나리 선수 · 3·4 명전 선수(결과) · 5 · 6 안내 ·
 * 7 잠긴 칸 0x6282c (팝업 종류 4 → 현금 구매 🌐, 웹은 목록으로)
 */
const PICK_PRESS_BY_CODE: ReadonlyMap<number, PickPress> = new Map<number, PickPress>([
  [1, (mode, _target, _entry, context) => pickPlayer(mode, { side: '투수', hallOfFameIndex: null }, context)],
  [2, (mode, _target, _entry, context) => pickPlayer(mode, { side: '타자', hallOfFameIndex: null }, context)],
  [3, pickFamer],
  [4, pickFamer],
  [5, (_mode, _target, _entry, context) => context.showPopup(alertOf(HALL_OF_FAME_TEXT.nariFirst))],
  [6, (_mode, _target, _entry, context) => context.showPopup(alertOf(HALL_OF_FAME_TEXT.hallOfFameFirst))],
  [7, (_mode, target, _entry, context) => context.showPopup(slotPurchaseOf(target < HALL_OF_FAME_PITCHER_SLOTS))],
])

/**
 * 스페셜 목록의 키 확인 — 하위 27 갱신 0x2ac00 도 `0x62569(목록, 키, 0)` 이고 목록 종류 2(≠ 3)라 선수 고르기와 같은
 * 0x627d4 갈래다: 6 → StrCOMMON[39] · 7 → [45]/[54](🌐) 는 0x62568 안에서 띄우고, 결과 3·4(명예 선수 칸)만 0x2ac00 이
 * 하위 1(말풍선, 커서 0)로 받는다. 나리 칸(상태 0)은 코드 0 이라 아무 일이 없다.
 */
function pressViewSlot(target: number, context: HallOfFamePressContext): void {
  const code = codeOf(context, target)
  if (code === 3 || code === 4) return context.openBubble()
  if (code === 6) return context.showPopup(alertOf(HALL_OF_FAME_TEXT.hallOfFameFirst))
  if (code === 7) context.showPopup(slotPurchaseOf(target < HALL_OF_FAME_PITCHER_SLOTS))
}

/** 칸 확인 — 목록 종류(등록 · 선수 고르기 · 보기)로 가른다 */
export function pressHallOfFameSlot(mode: HallOfFameMode, target: number, context: HallOfFamePressContext): void {
  if (mode.kind === '보기') return pressViewSlot(target, context)
  const code = codeOf(context, target)
  const entry = hallOfFameEntryOfSlot(target)
  if (mode.kind === '등록') return REGISTER_PRESS_BY_CODE.get(code)?.(mode, target, entry, context)
  PICK_PRESS_BY_CODE.get(code)?.(mode, target, entry, context)
}
