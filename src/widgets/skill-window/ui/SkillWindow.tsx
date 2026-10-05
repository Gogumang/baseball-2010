import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FrameSprite, MarkupText, MessageBox } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DIGIT_BASE_FRAME, SLASH_FRAME } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import {
  PLUS_SKILL_SLOT_LIMITS, equippedPlusSkillCountOf, isMinusSkill, isSkillEquipped, plusSkillSlotLimitOf,
} from '@/entities/career/model/playerCareer'
import { expandSkillSlots, skillConfirmKindOf, skillSlotExpansionCostOf } from '@/entities/career/model/skillEquip'
import { pitcherSkillTableIdOf } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  CELL_FRAME, DESCRIPTION_BOX, EMPTY_CELL_OFFSET, EQUIP_COUNT_LAYOUT, EQUIP_LABEL_FRAME, ITEM_CELL_BOXES, ITEM_COLUMNS,
  ITEM_ROWS, ITEM_TEXT_INSET, MODE_UI_FRAME, NAME_BOX, SIDE_LABEL_FRAME, SKILL_CELL_BOXES, SKILL_COLUMNS,
  SKILL_SIGN_ANIMATION, SKILL_SIGN_POSITION, SKILL_TEXT_OFFSET, SKILL_WINDOW_COLORS, TAB_BOXES,
  TAB_COUNT, TAB_LABEL_FRAMES, WINDOW_BOX, WINDOW_COLORS, gridIndexOf, isBlinkVisible, moveGridCursor,
  scrolledTopRowOf, skillCellFrameOf, skillGridRowsOf, skillListOf,
} from '@/widgets/skill-window/lib/skillWindowLayout'
import type { GridCursor, GridDirection, LayoutBox } from '@/widgets/skill-window/lib/skillWindowLayout'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/widgets/skill-window/ui/SkillWindow.css'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const NUM = './sprites/num'
const ITEM_ICON = './sprites/item_icon'

const pad = (frame: number) => String(frame).padStart(3, '0')

/** 이 창이 쓰는 StrMODE 번호 (`modeText.json` 과 번호가 같다) */
const TEXT = {
  G포인트부족: 65,
  해제불가: 129,
  사용확인: 130,
  해제확인: 131,
  최대: 132,
  확장앞: 133,
  확장뒤: 134,
  확장됨: 136,
} as const
const textOf = (index: number) => ORIGINAL_MODE_TEXT[index] ?? ''

/** 창이 보는 칸 — 투수편(모드 3)도 같은 창(0x13140·0x147b0·0x81dc0)을 쓰므로 칸 꼴만 받는다 */
export type SkillWindowCareer = Pick<PlayerCareer, 'skillIds' | 'equippedSkillIds' | 'skillSlotLevel' | 'gamePoint' | 'subItemIds'>

/** 0x7b970 — 모드 4(타자편)인가. 이름 딱지 149/150 · 스킬 이름표 · 서브아이템 능력치 이름이 갈린다 */
export type SkillWindowSide = '타자' | '투수'

interface SkillWindowProps {
  readonly career: SkillWindowCareer
  readonly side?: SkillWindowSide
  /** 대화 번호 4(장착)·3(해제) 의 "예" — 0x1483c `0xa4b04(P, s, on)` */
  readonly onEquip: (skillId: number, on: boolean) => void
  /** 대화 번호 6(확장) 의 "예" — 0x1484c. G 가 넉넉할 때만 부른다 */
  readonly onExpandSlots: () => void
  /** 탭에 있을 때의 취소(−16) — 원본은 상태 106(선수정보 하위 메뉴)으로 간다 (0x13168) */
  readonly onClose: () => void
}

type Prompt =
  | { readonly kind: '질문'; readonly text: string; readonly onYes: () => void; readonly onNo?: () => void }
  | { readonly kind: '알림'; readonly text: string }

/** 창의 키 자리 — 탭(`[win+0x1a8]` = 0) 또는 격자(= 1) */
type Focus = '탭' | '격자'

const START: GridCursor = { column: 0, row: 0 }

/**
 * 스킬 비트 → 표 번호 (0x8457c). 모드 4 거나 s ≤ 7 이면 그대로, 투수편 8~23 은 +16 (`pitcherSkillTableIdOf`).
 * 칸 이름은 StrCOMMON[0x37 + 표 번호] = `ORIGINAL_SKILLS[표].name`, 설명은 StrSKILL[표]·[40 + 표] (0x82eb2~0x82ebe).
 */
const tableIdOf = (side: SkillWindowSide, skillId: number) => (side === '타자' ? skillId : pitcherSkillTableIdOf(skillId))

/** 서브아이템 설명 (0x82a48~0x82b6e): "!cFFFFFF" + StrITEM[155+i] + "!N효과 : !cFFFF00" + 효과 */
function subItemDescriptionOf(side: SkillWindowSide, index: number): string {
  // 0~3 은 sprintf(StrITEM[148] "%s 훈련 시 +2", StrMODE[35+i] (모드 3 이면 40+i)) — 표 [win+0x164] 를 StrMODE 로 읽었다
  // (히트·파워·수비·주루 / 제구·구속·변화·체력 이 번호와 맞아 유력). 4~9 는 StrITEM[145+i].
  const effect = index <= 3
    ? (ORIGINAL_ITEMS[148] ?? '').replace('%s', textOf((side === '투수' ? 40 : 35) + index))
    : ORIGINAL_ITEMS[145 + index] ?? ''
  return `!cFFFFFF${ORIGINAL_ITEMS[155 + index] ?? ''}!N효과 : !cFFFF00${effect}`
}

/** 둥글기 1 판 0x6b7d4(x, y, w, h) — fillRect(x+1, y+1, w−1, h−1) + 네 변 선 → (w+1)×(h+1) 에서 네 모서리 점이 빠진 꼴 */
function RoundPlate({ x, y, width, height, color }: LayoutBox & { readonly color: string }) {
  return (
    <>
      <rect x={x + 1} y={y} width={width - 1} height={height + 1} fill={color} />
      <rect x={x} y={y + 1} width={width + 1} height={height - 1} fill={color} />
    </>
  )
}

/** 박스 3 이름 딱지 (0x8225e~0x82396) — 오른쪽이 아래로 비스듬히 늘어나는 띠 */
function NameTag() {
  const { x, y, width: w, height: h } = NAME_BOX
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={c.nameFill} />
      <rect x={x} y={y} width={w} height={1} fill={c.nameEdge} />
      <rect x={x} y={y + 1} width={1} height={h} fill={c.nameEdge} />
      {Array.from({ length: h - 1 }, (_unused, k) => (
        <g key={k}>
          <rect x={x + w - 1} y={y + k + 1} width={k + 1} height={1} fill={c.nameFill} />
          <rect x={x + w + k} y={y + k + 1} width={1} height={1} fill={c.nameHighlight} />
        </g>
      ))}
      <rect x={x + 1} y={y + h} width={w + h - 1} height={1} fill={c.nameHighlight} />
    </>
  )
}

/** 박스 4 설명 판 0x802dc */
function DescriptionPlate() {
  const { x, y, width: w, height: h } = DESCRIPTION_BOX
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={c.descriptionFill} />
      <rect x={x} y={y} width={w} height={1} fill={c.nameEdge} />
      <rect x={x} y={y} width={1} height={h + 1} fill={c.nameEdge} />
      <rect x={x + 1} y={y + h} width={w - 1} height={1} fill={c.nameHighlight} />
      <rect x={x + w - 1} y={y + 1} width={1} height={h} fill={c.nameHighlight} />
    </>
  )
}

/** 서브아이템 칸 바탕 0x7e764(칸, 0) */
function ItemCellPlate({ x, y, width: w, height: h }: LayoutBox) {
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <RoundPlate x={x} y={y} width={w} height={h} color={c.itemCellEdge} />
      <rect x={x + 1} y={y + 1} width={w - 1} height={h - 1} fill={c.itemCellFill} />
      <rect x={x + 2} y={y + 2} width={w - 3} height={Math.trunc((h - 1) / 2) - 2} fill={c.itemCellLight} />
    </>
  )
}

/** 서브아이템 커서 0x81824 — 두께 2, 윗반 노랑 · 아랫반 주황 */
function ItemCursor({ x, y, width: w, height: h }: LayoutBox) {
  const c = SKILL_WINDOW_COLORS
  const half = Math.trunc(h / 2)
  return (
    <>
      <rect x={x + 1} y={y} width={w - 1} height={2} fill={c.itemCursorUpper} />
      <rect x={x} y={y + 1} width={2} height={half} fill={c.itemCursorUpper} />
      <rect x={x + w - 1} y={y + 1} width={2} height={half} fill={c.itemCursorUpper} />
      <rect x={x} y={y + half + 1} width={2} height={half} fill={c.itemCursorLower} />
      <rect x={x + w - 1} y={y + half + 1} width={2} height={half} fill={c.itemCursorLower} />
      <rect x={x + 1} y={y + h - 1} width={w - 1} height={2} fill={c.itemCursorLower} />
    </>
  )
}

/**
 * 아이템/스킬 창 — 하위 상태 122. 창 종류 0 (0x81dc0 · 키 0x13140 → 0x819ad · 대화 0x147b0).
 *
 * **들어올 때** (진입 0x116a0): 종류 0, `[win+0x1a8]` = 0(탭에 커서), 채우기 0x81618 이 탭 커서를 "스킬" 에 두고
 * 목록 셋을 (0,0) 으로 되돌린다.
 *
 * **키**
 * - 탭: 좌우 = 탭 바꾸기(2칸 감기). 확인(−5·'5')·아래(−2·'8') = 격자로 들어가며 두 격자 커서를 (0,0) 으로 (0x81a28).
 *   취소 = 창을 닫고 106 으로.
 * - 격자: 방향키 = 그 탭의 격자 이동(0x6c298, 감기 + 굴림). 취소 = 탭으로 돌아가며 스킬 격자 커서·굴림을 (0,0) 으로 (0x8460c).
 *   확인은 스킬 탭에서만 0x13140 의 장착 갈래, 서브아이템 탭에서는 목록 키로 넘어가 아무 일도 없다.
 *
 * **확인 키 0x13140** — 문구는 버퍼 `"!C"`(0xcc210) 에 이어 붙인다 (H-modes 6절, 확정):
 *   마이너스      → `!C[` + 이름 + StrMODE[129]                       알림 (1,1)
 *   장착 중       → `!C[` + 이름 + StrMODE[131]                       예/아니오 (2,3) → 해제
 *   자리 있음     → `!C[` + 이름 + StrMODE[130]                       예/아니오 (2,4) → 장착
 *   가득 · L ≤ 1  → `!C` + 비용 + [133] + " " + 0xcc4f4[L+1] + " " + [134]  예/아니오 (2,6) → 확장
 *   가득 · L = 2  → `!C` + sprintf([132], 0xcc4f4[L])                 알림 (1,5)
 *   빈 칸(s = −1) → 아무 일도 없다 (0x1327e)
 *
 * **대화 뒤** (틀 0x147b0) — 상태는 122 그대로이고 창·탭·격자 커서도 그대로다(목록도 다시 채우지 않는다).
 *   확장 "예" 0x1484c: G 부족이면 StrMODE[65](2,2), 아니면 확장 뒤 sprintf([136], 새 상한) (1,1).
 *   **확장 "아니오"** 0x1497a: `!C` + sprintf([132], 지금 상한) 알림 (1,5) 을 띄운다.
 *   ⚠️ [65] 의 "예" 는 0xbcb49(장면, 0x8b) = 상태 139(G포인트 충전 페이지, 이식 대상 밖) — 웹은 창에 남는다
 *   (원본도 139 에서 돌아오면 0x116a0 이 `[장면+0x28] == 0x8b` 를 보고 창을 다시 채우지 않는다).
 */
export function SkillWindow({ career, side = '타자', onEquip, onExpandSlots, onClose }: SkillWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const animations = useAnimations(MODE_UI)
  const update = useUpdateCounter()
  const isBlinkOn = isBlinkVisible(update)

  const skills = skillListOf(career.skillIds)
  const skillRows = skillGridRowsOf(skills.length)
  const [tab, setTab] = useState(0)
  const [focus, setFocus] = useState<Focus>('탭')
  const [skillCursor, setSkillCursor] = useState<GridCursor>(START)
  const [topRow, setTopRow] = useState(0)
  const [itemCursor, setItemCursor] = useState<GridCursor>(START)
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  const ask = (text: string, onYes: () => void, onNo?: () => void) => setPrompt({ kind: '질문', text, onYes, onNo })
  const tell = (text: string) => setPrompt({ kind: '알림', text })
  const nameOf = (skillId: number) => ORIGINAL_SKILLS[tableIdOf(side, skillId)]?.name ?? ''
  const maximumText = () => `!C${textOf(TEXT.최대).replace('%d', String(plusSkillSlotLimitOf(career)))}`

  /** 대화 번호 6 의 "예" — 0x1484c */
  const expand = () => {
    const result = expandSkillSlots(career)
    if (result.kind === 'G포인트부족') return ask(textOf(TEXT.G포인트부족), () => {})
    onExpandSlots()
    tell(textOf(TEXT.확장됨).replace('%d', String(result.slots)))
  }

  /** 확인 키 — 0x13140. 고른 칸은 0x85ad0 `[win+0x1e4 + 4 × 칸번호]` */
  const confirm = (index: number) => {
    const skillId = skills[index]
    if (skillId === undefined) return
    const name = nameOf(skillId)
    switch (skillConfirmKindOf(career, skillId)) {
      case '해제불가':
        return tell(`!C[${name}${textOf(TEXT.해제불가)}`)
      case '해제확인':
        return ask(`!C[${name}${textOf(TEXT.해제확인)}`, () => onEquip(skillId, false))
      case '장착확인':
        return ask(`!C[${name}${textOf(TEXT.사용확인)}`, () => onEquip(skillId, true))
      case '확장확인': {
        const nextLimit = PLUS_SKILL_SLOT_LIMITS[career.skillSlotLevel + 1]
        return ask(`!C${skillSlotExpansionCostOf(career)}${textOf(TEXT.확장앞)} ${nextLimit} ${textOf(TEXT.확장뒤)}`,
          expand, () => tell(maximumText()))
      }
      case '최대':
        return tell(maximumText())
    }
  }

  const enterGrid = () => {
    setFocus('격자')
    setSkillCursor(START)
    setTopRow(0)
    setItemCursor(START)
  }
  const leaveGrid = () => {
    setFocus('탭')
    setSkillCursor(START)
    setTopRow(0)
  }
  const moveInGrid = (direction: GridDirection) => {
    if (tab === 0) {
      const next = moveGridCursor(skillCursor, direction, SKILL_COLUMNS, skillRows)
      setSkillCursor(next)
      setTopRow(scrolledTopRowOf(topRow, next.row))
      return
    }
    setItemCursor(moveGridCursor(itemCursor, direction, ITEM_COLUMNS, ITEM_ROWS))
  }

  useEffect(() => {
    // 대화가 떠 있으면 MessageBox 가 먼저 키를 가져간다
    if (prompt !== null) return undefined
    const onKey = (event: KeyboardEvent) => {
      const direction: GridDirection | null = event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down'
        : event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null
      const isCancel = event.key === 'Escape' || event.key === 'Backspace'
      if (direction === null && !isCancel && event.key !== 'Enter') return
      // 뒤쪽 관리 화면의 키 처리(취소 = 창 닫기)보다 먼저 받는다
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isCancel) return focus === '격자' ? leaveGrid() : onClose()
      if (focus === '탭') {
        if (event.key === 'Enter' || direction === 'down') return enterGrid()
        if (direction === 'left' || direction === 'right') {
          setTab((current) => (current + (direction === 'right' ? 1 : -1) + TAB_COUNT) % TAB_COUNT)
        }
        return
      }
      if (direction !== null) return moveInGrid(direction)
      if (tab === 0) confirm(gridIndexOf(skillCursor, SKILL_COLUMNS))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const textSizeOf = (frame: number) => textOrigins?.[pad(frame)] ?? null
  /** img_text 프레임을 0xb9e05 로 — 가로 가운데는 내림, 세로 가운데는 올림 (0xb9d74) */
  const centeredTextFrame = (frame: number, area: LayoutBox, dx = 0, dy = 0, tint: string | null = null): ReactNode => {
    const size = textSizeOf(frame)
    if (size === null) return null
    const left = area.x + dx + Math.floor((area.width - size.width) / 2)
    const top = area.y + dy + Math.ceil((area.height - size.height) / 2)
    const src = `${IMG_TEXT}/${pad(frame)}.png`
    if (tint === null) return <img key={`t${frame}`} className={styles.layer} src={src} alt="" style={{ left, top }} />
    return (
      <div key={`t${frame}`} className={styles.tinted}
        style={{ left, top, width: size.width, height: size.height, background: tint, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} />
    )
  }
  /** num 그림 한 장을 효과 11 흰색으로 — 0xb9d35 (`key` 는 같은 그림이 두 번 나올 수 있어 따로 받는다) */
  const whiteGlyph = (key: string, frame: number, left: number, top: number, width: number, height: number) => {
    const src = `${NUM}/${pad(frame)}.png`
    return (
      <div key={key} className={styles.tinted}
        style={{ left, top, width, height, background: SKILL_WINDOW_COLORS.text, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} />
    )
  }

  /** 장착 수 줄 (0x82c76~0x82e2c) — 박스 3 기준 */
  const equipCountRow = () => {
    const L = EQUIP_COUNT_LAYOUT
    const count = equippedPlusSkillCountOf(career)
    const limit = plusSkillSlotLimitOf(career)
    const digitWidth = (digit: number) => (digit === 1 ? 4 : 6)
    const digitTop = NAME_BOX.y + L.digitDy + Math.trunc((NAME_BOX.height - 10) / 2)
    const rightAligned = (dx: number, digit: number) => NAME_BOX.x + dx + NAME_BOX.width - digitWidth(digit)
    const parts: ReactNode[] = []
    if (count === 10) {
      parts.push(whiteGlyph('c1', DIGIT_BASE_FRAME + 1, rightAligned(L.countTenOneDx, 1), digitTop, 4, 10))
      parts.push(whiteGlyph('c0', DIGIT_BASE_FRAME, rightAligned(L.countRightDx, 0), digitTop, 6, 10))
    } else {
      parts.push(whiteGlyph('c', DIGIT_BASE_FRAME + count, rightAligned(L.countRightDx, count), digitTop, digitWidth(count), 10))
    }
    // "/" 는 5×8 — 가로 가운데는 올림, 세로는 내림 (0xb9c5c)
    parts.push(whiteGlyph('s', SLASH_FRAME, NAME_BOX.x + L.slashDx + Math.ceil((NAME_BOX.width - 5) / 2),
      NAME_BOX.y + L.digitDy + Math.trunc((NAME_BOX.height - 8) / 2), 5, 8))
    if (limit === 10) {
      parts.push(whiteGlyph('l1', DIGIT_BASE_FRAME + 1, NAME_BOX.x + L.limitDx, digitTop, 4, 10))
      parts.push(whiteGlyph('l0', DIGIT_BASE_FRAME, NAME_BOX.x + L.limitTenZeroDx, digitTop, 6, 10))
    } else {
      parts.push(whiteGlyph('l', DIGIT_BASE_FRAME + limit, NAME_BOX.x + L.limitDx, digitTop, digitWidth(limit), 10))
    }
    const shift = (count > 9 ? L.wideShift : 0) + (limit > 9 ? L.wideShift : 0)
    parts.push(centeredTextFrame(EQUIP_LABEL_FRAME, NAME_BOX, L.labelDx - shift, L.labelDy))
    return parts
  }

  /** 칸 안 이름 — 검정 그림자(+1,+1) 뒤 흰 글 */
  const cellLabel = (key: string, text: string, area: LayoutBox) => [
    <div key={`${key}-s`} className={styles.textShadow}
      style={{ left: area.x + 1, top: area.y + 1, width: area.width, height: area.height }}>{text}</div>,
    <div key={`${key}-f`} className={styles.textFace}
      style={{ left: area.x, top: area.y, width: area.width, height: area.height }}>{text}</div>,
  ]

  const skillCursorIndex = gridIndexOf(skillCursor, SKILL_COLUMNS)
  const cursorSkill = focus === '격자' && tab === 0 ? skills[skillCursorIndex] : undefined
  const itemCursorIndex = gridIndexOf(itemCursor, ITEM_COLUMNS)
  const cursorItemOwned = focus === '격자' && tab === 1 && career.subItemIds.includes(itemCursorIndex)
  const signStep = (() => {
    if (cursorSkill === undefined) return null
    const entries = animations?.[isMinusSkill(cursorSkill) ? SKILL_SIGN_ANIMATION.마이너스 : SKILL_SIGN_ANIMATION.플러스]
    return entries === undefined ? null : animationStepAt(entries, update)
  })()

  return (
    <div className={windowStyles.overlay} role="dialog" aria-label="아이템/스킬" onClick={onClose}>
      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        {/* 0x81d0c — 종류 0 의 판 */}
        <RoundPlate x={WINDOW_BOX.x} y={WINDOW_BOX.y} width={WINDOW_BOX.width - 1} height={WINDOW_BOX.height - 1} color={WINDOW_COLORS.outer} />
        <RoundPlate x={WINDOW_BOX.x + 1} y={WINDOW_BOX.y + 1} width={WINDOW_BOX.width - 3} height={WINDOW_BOX.height - 3} color={WINDOW_COLORS.inner} />
        <rect x={WINDOW_BOX.x + 2} y={WINDOW_BOX.y + 2} width={WINDOW_BOX.width - 4} height={WINDOW_BOX.height - 4} fill={WINDOW_COLORS.fill} />
      </svg>
      {/* 탭 띠 — 고른 탭이 흰 탭인 mode_ui 프레임 36/37 을 원점 (0,0) 에 */}
      <FrameSprite folder={MODE_UI} frame={tab === 0 ? MODE_UI_FRAME.스킬탭띠 : MODE_UI_FRAME.서브아이템탭띠}
        origins={modeUiOrigins} x={0} y={0} />
      {TAB_LABEL_FRAMES.map((frame, index) => centeredTextFrame(frame, TAB_BOXES[index], 0, 0,
        index === tab ? SKILL_WINDOW_COLORS.tabOn : SKILL_WINDOW_COLORS.tabOff))}
      {focus === '탭' && isBlinkOn && (
        <FrameSprite folder={MODE_UI} frame={MODE_UI_FRAME.탭커서} origins={modeUiOrigins} x={TAB_BOXES[tab].x} y={TAB_BOXES[tab].y} />
      )}
      {TAB_BOXES.map((area, index) => (
        <button key={index} type="button" className={styles.hitArea}
          aria-label={index === 0 ? '스킬' : '서브아이템'} aria-pressed={index === tab}
          style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
          onClick={(event) => { event.stopPropagation(); setTab(index); setFocus('탭') }} />
      ))}

      <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <NameTag />
        <DescriptionPlate />
        {tab === 1 && ITEM_CELL_BOXES.map((area, index) => <ItemCellPlate key={index} {...area} />)}
        {tab === 1 && focus === '격자' && isBlinkOn && <ItemCursor {...ITEM_CELL_BOXES[itemCursorIndex]} />}
      </svg>

      {tab === 0 && (
        <>
          {/* 이름 딱지 — 타자/투수 + 장착 수 / 상한 */}
          {centeredTextFrame(SIDE_LABEL_FRAME[side], NAME_BOX)}
          {equipCountRow()}

          {SKILL_CELL_BOXES.map((area, cell) => {
            const index = cell + topRow * SKILL_COLUMNS
            const skillId = skills[index]
            const isCursor = focus === '격자' && isBlinkOn && index === skillCursorIndex
            const cursor = isCursor && (
              <FrameSprite key={`c${cell}`} folder={MODE_UI} frame={CELL_FRAME.커서} origins={modeUiOrigins} x={area.x} y={area.y} />
            )
            if (skillId === undefined) {
              return [
                <FrameSprite key={`e${cell}`} folder={MODE_UI} frame={CELL_FRAME.회색} origins={modeUiOrigins}
                  x={area.x + EMPTY_CELL_OFFSET.x} y={area.y + EMPTY_CELL_OFFSET.y} />,
                cursor,
              ]
            }
            const name = nameOf(skillId)
            return [
              <FrameSprite key={`f${cell}`} folder={MODE_UI} frame={skillCellFrameOf(skillId, isSkillEquipped(career, skillId))}
                origins={modeUiOrigins} x={area.x} y={area.y} />,
              ...cellLabel(`n${cell}`, name, area),
              cursor,
              <button key={`b${cell}`} type="button" className={styles.hitArea}
                aria-label={name} aria-pressed={isSkillEquipped(career, skillId)}
                style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
                onMouseEnter={() => { if (focus === '격자') setSkillCursor({ column: cell % SKILL_COLUMNS, row: topRow + Math.trunc(cell / SKILL_COLUMNS) }) }}
                onClick={(event) => {
                  event.stopPropagation()
                  setFocus('격자')
                  setSkillCursor({ column: cell % SKILL_COLUMNS, row: topRow + Math.trunc(cell / SKILL_COLUMNS) })
                  confirm(index)
                }} />,
            ]
          })}

          {cursorSkill !== undefined && (
            <>
              {signStep !== null && (
                <FrameSprite folder={MODE_UI} frame={signStep.frame} origins={modeUiOrigins}
                  x={SKILL_SIGN_POSITION.x + signStep.dx} y={SKILL_SIGN_POSITION.y + signStep.dy} />
              )}
              <div className={styles.description} data-testid="skill-description"
                style={{ left: DESCRIPTION_BOX.x + SKILL_TEXT_OFFSET.x, top: DESCRIPTION_BOX.y + SKILL_TEXT_OFFSET.introY, width: DESCRIPTION_BOX.width }}>
                <MarkupText raw={ORIGINAL_SKILLS[tableIdOf(side, cursorSkill)]?.description ?? ''} />
              </div>
              <div className={styles.description}
                style={{ left: DESCRIPTION_BOX.x + SKILL_TEXT_OFFSET.x, top: DESCRIPTION_BOX.y + SKILL_TEXT_OFFSET.effectY, width: DESCRIPTION_BOX.width }}>
                <MarkupText raw={`효과 : !cFFFF00${ORIGINAL_SKILLS[tableIdOf(side, cursorSkill)]?.effect ?? ''}`} />
              </div>
            </>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {ITEM_CELL_BOXES.map((area, index) => {
            const isOwned = career.subItemIds.includes(index)
            return [
              // 아이콘 = [win+0x1a0] 그림 표 0xd463a[i] = i (item_icon), 0xb9d35 가운데 — 가진 칸만 (0x82514)
              isOwned && <ItemIcon key={`i${index}`} index={index} area={area} />,
              <button key={`b${index}`} type="button" className={styles.hitArea}
                aria-label={isOwned ? ORIGINAL_ITEMS[88 + index] : `빈 칸 ${index + 1}`}
                style={{ left: area.x, top: area.y, width: area.width, height: area.height }}
                onClick={(event) => {
                  event.stopPropagation()
                  setFocus('격자')
                  setItemCursor({ column: index % ITEM_COLUMNS, row: Math.trunc(index / ITEM_COLUMNS) })
                }} />,
            ]
          })}
          {cursorItemOwned && (
            <>
              {cellLabel('item', ORIGINAL_ITEMS[88 + itemCursorIndex] ?? '', NAME_BOX)}
              <div className={styles.description} data-testid="skill-description"
                style={{
                  left: DESCRIPTION_BOX.x + ITEM_TEXT_INSET, top: DESCRIPTION_BOX.y + ITEM_TEXT_INSET,
                  width: DESCRIPTION_BOX.width - ITEM_TEXT_INSET * 2, height: DESCRIPTION_BOX.height - ITEM_TEXT_INSET * 2,
                }}>
                <MarkupText raw={subItemDescriptionOf(side, itemCursorIndex)} />
              </div>
            </>
          )}
        </>
      )}

      {/* 대화의 단추 클릭이 창 바깥 클릭(닫기)으로 번지지 않게 막는다 — 대화 뒤에도 창은 남는다(0x147b0) */}
      <div onClick={(event) => event.stopPropagation()}>
        {prompt?.kind === '질문' && (
          <MessageBox text={prompt.text} buttons={['예', '아니오']}
            onAnswer={(answer) => {
              const pending = prompt
              setPrompt(null)
              if (answer === 0) pending.onYes()
              else pending.onNo?.()
            }} />
        )}
        {prompt?.kind === '알림' && (
          <MessageBox text={prompt.text} buttons={['확인']} onAnswer={() => setPrompt(null)} />
        )}
      </div>
    </div>
  )
}

/** item_icon 그림 0~9 의 크기 (PNG 를 읽어 적었다) — 0xb9d35 가 가운데 맞춤에 쓴다 */
const ITEM_ICON_SIZES: readonly (readonly [number, number])[] = [
  [24, 26], [26, 23], [23, 24], [25, 24], [29, 22], [29, 26], [27, 18], [24, 22], [27, 25], [29, 23],
]

/** 서브아이템 아이콘 — 0xb9d35(그림) 가운데: 가로 올림, 세로 내림 (0xb9c5c) */
function ItemIcon({ index, area }: { readonly index: number; readonly area: LayoutBox }) {
  const [width, height] = ITEM_ICON_SIZES[index]
  return (
    <img className={styles.layer} src={`${ITEM_ICON}/${pad(index)}.png`} alt=""
      style={{ left: area.x + Math.ceil((area.width - width) / 2), top: area.y + Math.trunc((area.height - height) / 2) }} />
  )
}
