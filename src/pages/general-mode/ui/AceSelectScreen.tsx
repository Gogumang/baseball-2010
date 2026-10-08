import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { FrameSprite, Hint, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { aceOpenPopupTextOf, aceOpensWithGamePoint } from '@/shared/config/original/aceOpen'
import { ACE_OPEN_SHORTAGE_POPUP, aceOpenPriceOf } from '@/pages/general-mode/lib/aceOpenState'
import { ACE_LEVEL_UP_TEXT, aceLevelOf, isAceMaxLevel } from '@/entities/mission/model/aceLevel'
import { AceLevelUpWindow } from '@/widgets/ace-level-up/ui/AceLevelUpWindow'
import { ACE_LAYOUT, LOCKED_CIRCLES, NAME_BAR, TAG, aceCellPositionOf } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PER_ROLE, ACE_PHASE, aceIndexOfCell, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsDirection, AnnalsGridShape } from '@/pages/record/lib/annalsGrid'

const SLT_IMAGE = './sprites/slt_frame'
const IMG_TEXT_FRAME = './sprites/img_text/frames'

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 잠긴 칸 글 — slt_frame 이미지 114 "LOCK" 을 대신하는 읽기용 이름 */
const LOCK_LABEL = 'LOCK'

/**
 * 웹판 `ACE_PLAYERS` 는 **마타자 0~4 · 마투수 5~9** 순서다. 화면 격자는 **윗줄 마투수 · 아랫줄 마타자**라
 * 칸 번호를 이렇게 갈아 준다.
 */
export function acePlayerOfCell(cell: number) {
  const index = aceIndexOfCell(cell)
  return aceRoleOfCell(cell) === ACE_PHASE.마투수 ? ACE_PLAYERS[ACE_PER_ROLE + index] : ACE_PLAYERS[index]
}

export interface AceSelectScreenProps {
  /** 하위 단계 `[skin+0xd0]` — 마투수를 먼저 고른다 */
  readonly phase: AcePhase
  /** 저장 +0x30..0x34 — 열린 마투수 번호 0~4 */
  readonly openedAcePitcherIds?: readonly number[]
  /** 저장 +0x35..0x39 — 열린 마타자 번호 0~4 */
  readonly openedAceBatterIds?: readonly number[]
  /**
   * 마선수 레벨 — 전역 저장 `mgr[0x13a + 칸]` (0~4, `entities/mission/model/useAceLevels`).
   * 이름 막대 글은 `"!C!cFFFFFF%s !cFFFF00LV.%d"` (0xd2498) 이고 %d 는 **레벨 + 1** 이다
   * (0x64b34 `ldrsb r4,[mgr+0x13a+칸]` → 0x64b40 `adds r4,#1`). 칸이 비면 새 저장 값 0 = LV.1.
   */
  readonly levels?: Readonly<Record<number, number>>
  /**
   * 하위 상태 — `'고르기'` = 상태 21(일반모드 마선수, 갱신 0x29df8) · `'레벨업'` = 상태 28(스페셜 마선수
   * 선택, 갱신 0x2af20). 28 은 OK 도 레벨업 쪽으로 가고(고르기가 없다) 두 줄을 다 오간다.
   * `'코치'` = 시즌 선수단 0xd7 을 `this+0x11c = 2`(코치채용)로 띄운 것 — 키 0xa734~ (직접 떴다):
   * ```
   * r4 = 전역 +0x30 + 칸 (오픈)
   * r4 == 0 → 0xa880 오픈 힌트 (칸 4·9 [42] 알림 · 그 밖 [43] 팝업 0x1f — 예면 G 오픈) — 줄을 가리지 않는다
   * r4 ≠ 0 → 채용 가드 [147] · [77] · [62] → [146] (0xa79c~0xa87a) — 부르는 쪽 `onSelect`
   * ```
   * 바닥은 5(되돌아가기만, 0xad94~0xada0)이고 레벨업 창은 열지 않는다.
   */
  readonly mode?: '고르기' | '레벨업' | '코치'
  /**
   * 레벨업 확정 (0x5fbee · 0x5fc0a) — 받는 쪽이 레벨을 올리고 G `cost` 를 뺀다.
   * 안 넘기면 `0` 키 레벨업 창을 열지 않는다.
   */
  readonly onLevelUp?: (cell: number, cost: number) => void
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /**
   * **G포인트로 이 칸을 연다** — 확인 팝업에서 "예" 를 고르고 G가 모자라지 않을 때만 부른다
   * (0xa3a2 → 0xa3dc → 0xa3f6). 받는 쪽이 G를 빼고 오픈 플래그를 세운다.
   * 안 넘기면 팝업이 힌트만 보여 주고 닫힌다 (예전 그대로).
   */
  readonly onOpenAce?: (cell: number) => void
  readonly onSelect: (cell: number) => void
  readonly onCancel: () => void
  /**
   * 화면 맨 밑에 먼저 깔 것 — 시즌 장면 0x105 는 상태별 그리기 앞에 늘 공통 앞그림 0xb810 을 부르고, 0xd7 마선수 고르기는 0xdd · 0xe0 · 0xe1 밖이라
   * 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 깐다(0xe9ac 0xefaa). 이 화면을 쓰는 다른 모드는 넘기지 않는다.
   */
  readonly underlay?: ReactNode
  /** 화면 맨 위에 얹을 팝업 — 코치채용의 가드·확인 팝업 */
  readonly overlay?: ReactNode
}

/**
 * 격자 [메뉴+0x74] 의 꼴 — 진입이 `vt+0x1c(격자, 5열, 2줄, 숫자키 꼴 1, 꼴)` 로 짓는다(직접 떴다):
 * - 상태 21 진입 0x263f4(0x26408~0x26418): 꼴 **0x10** — 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다.
 * - 상태 28 진입 0x262c8(0x262dc~0x262ea): 꼴 **0x20** — 세로는 감고 가로는 끝에서 멈춘다.
 * (진입 표 0xcf06c 는 상태 − 2 번째 칸: [19] 0x263f4 · [26] 0x262c8.)
 */
const ACE_GRID_SHAPES: Readonly<Record<'고르기' | '레벨업', AnnalsGridShape>> = {
  고르기: { columns: ACE_LAYOUT.grid.columns, rows: ACE_LAYOUT.grid.rows, wrapsColumns: true, wrapsRows: false },
  레벨업: { columns: ACE_LAYOUT.grid.columns, rows: ACE_LAYOUT.grid.rows, wrapsColumns: false, wrapsRows: true },
}

/**
 * **마선수 고르기** — 메인 메뉴 하위 상태 **21**, 공용 목록 `0x63b15` 의 **k = 2**
 * (진입 0x263f4 · 갱신 0x29df8 · 본문 0x647b4. P6 2a-5 좌표 확정).
 *
 * 격자는 10칸(윗줄 마투수 0~4 · 아랫줄 마타자 5~9)이고 **마투수를 먼저** 고른 뒤 커서가
 * 아랫줄로 내려간다. 마투수 OK 는 `rec+0xe`, 마타자 OK 는 `rec+0xd` 에 적힌다.
 *
 * **잠긴 칸을 누르면 오픈 힌트 팝업**이 뜬다 (0xa248 안 0xa68e~0xa6dc). 문자열표 `[0x1552cf8]` 은
 * StrCOMMON 이고 [0x2a]·[0x2b] = StrCOMMON[42]·[43] 이며, 힌트 글 자체는 `XlsACE_LEVEL_UP` 의
 * +0xc 칸이다 — `shared/config/original/aceOpen.ts` 에 다 있다.
 * (예전 주석은 "그 표가 웹판 데이터에 없다" 고 적고 있었다 — **틀렸다.** 표는 `base/extracted/` 에
 *  있었고 생성기가 안 뽑고 있던 것뿐이다.)
 *
 * **실제 오픈**도 이제 여기서 한다 (0xa390~0xa46e): [43] 에서 "예" 를 고르면 `onOpenAce(칸)` 로
 * 나가고, 들고 있는 G가 가격보다 **적으면** 대신 부족 팝업(0xcc214)이 뜬다 — 자세한 것은
 * `lib/aceOpenState.ts` 의 머리글을 볼 것.
 *
 * **레벨업**: 상태 21 은 `0` 키, 상태 28(`mode="레벨업"`, 스페셜 마선수 선택)은 OK·`0` 키로
 * 레벨업 창 `widgets/ace-level-up` 을 연다 (`requestLevelUp` 머리글). 바닥띠 517 = "0레벨업" + 되돌아가기.
 *
 * ⚠️ 여기 없는 것:
 *   - 바닥띠의 "0레벨업" 그림(프레임 9) — `ScreenFrame` 이 되돌아가기만 그린다.
 *   - 상태 28 의 위/아래 키(−1·−2·'2'·'8')가 뒤집는 `skin+0xd0` — A 딱지를 안 그리는 k 11 에선 보이는 것이 없다.
 *   - 열린 마선수 자리의 애니메이션 `[skin+0x138]` — 여기서는 정지 그림을 쓴다.
 */
export function AceSelectScreen({
  phase, openedAcePitcherIds = [], openedAceBatterIds = [], levels, mode = '고르기', gamePoint = 0,
  onOpenAce, onLevelUp, onSelect, onCancel, underlay, overlay,
}: AceSelectScreenProps) {
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const cellCount = ACE_LAYOUT.grid.columns * ACE_LAYOUT.grid.rows
  // 마투수 단계는 윗줄에서, 마타자 단계는 아랫줄에서 커서가 시작한다 (원본이 OK 뒤 커서를 내린다)
  const [cursor, setCursor] = useState(phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)
  /** 오픈 힌트 팝업이 뜬 칸 (0xa68e~0xa6dc). null 이면 안 뜬 것 */
  const [hintCell, setHintCell] = useState<number | null>(null)
  /** G가 모자라 뜬 부족 팝업 (0xa46e → 0xaa00, 팝업 id 0x20) */
  const [isShortageOpen, setIsShortageOpen] = useState(false)
  /** 레벨업 창이 열린 칸 — `skin+0x31c`(열림)·`+0x31d`(칸). null 이면 닫힘 */
  const [levelUpCell, setLevelUpCell] = useState<number | null>(null)
  /** StrCOMMON[40] "최고 레벨입니다" 알림 */
  const [isMaxLevelOpen, setIsMaxLevelOpen] = useState(false)
  const isLevelUpMode = mode === '레벨업'
  const isCoachMode = mode === '코치'

  useEffect(() => {
    setCursor(phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)
  }, [phase])

  const isCellOpen = (cell: number) =>
    aceRoleOfCell(cell) === ACE_PHASE.마투수
      ? openedAcePitcherIds.includes(aceIndexOfCell(cell))
      : openedAceBatterIds.includes(aceIndexOfCell(cell))

  /**
   * 지금 단계의 줄만 고를 수 있다 — 원본도 단계에 맞는 줄에서만 OK 를 받는다.
   * 상태 28 은 고르기가 없고 OK 가 레벨업 쪽이라 어느 칸이든 누를 수 있다.
   */
  const isCellSelectable = (cell: number) =>
    isLevelUpMode || (isCoachMode ? isCellOpen(cell) : aceRoleOfCell(cell) === phase && isCellOpen(cell))

  /**
   * **레벨업 요청** — 상태 21 의 `0` 키(0x29efc `cmp r5,#0x30`) · 상태 28 의 OK·`0` 키(0x2b00a·0x2affc).
   * 두 갱신 함수가 같은 순서로 판정한다 (0x29f02~0x29fbc · 0x2b02c~0x2b124):
   *   1. 잠긴 칸(`mgr[0x30+칸] == 0`) → 오픈 힌트 팝업 (칸 4·9 는 [42], 그 밖 [43]) — 오픈과 같은 길
   *   2. 레벨 > 3 → StrCOMMON[40] "최고 레벨입니다" 알림
   *   3. 그 밖 → 레벨업 창 열기 (+0x31c = 1, +0x31d = 칸)
   * 상태 21 의 잠긴 칸 팝업은 원본도 단계와 상관없이 뜬다 (0x29f34 가 줄을 안 본다).
   */
  const requestLevelUp = (cell: number) => {
    if (onLevelUp === undefined) return
    if (!isCellOpen(cell)) return setHintCell(cell)
    if (isAceMaxLevel(aceLevelOf(levels, cell))) return setIsMaxLevelOpen(true)
    setLevelUpCell(cell)
  }

  /**
   * OK 한 번 — 열린 칸이면 고르고, **잠긴 칸이면 오픈 힌트 팝업**을 띄운다 (0xa248 → 0xa68e).
   * 팝업은 단계에 맞는 줄에서만 띄운다 (OK 를 받는 줄이 거기뿐이다).
   */
  const pressCell = (cell: number) => {
    if (isLevelUpMode) return requestLevelUp(cell)
    if (isCellSelectable(cell)) return onSelect(cell)
    // 코치채용(0xa79c → 0xa880)은 두 줄 모두 잠긴 칸이면 힌트다
    if (isCoachMode || aceRoleOfCell(cell) === phase) setHintCell(cell)
  }

  /**
   * 오픈 힌트 팝업의 답 (0xa390~0xa46e). 첫 버튼(0)이 "예" 다.
   *
   * G가 모자라면(`G < 가격`, 0xa3dc `blt`) **사지 않고** 부족 팝업으로 넘어간다 — G도 안 깎인다.
   * 가격과 딱 같으면 산다. 못 여는 칸(4·9)은 버튼이 OK 하나라 여기로 와도 아무 일이 없다.
   */
  const answerOpenPopup = (cell: number, answer: number) => {
    setHintCell(null)
    if (answer !== 0 || !aceOpensWithGamePoint(cell) || onOpenAce === undefined) return
    if (gamePoint < aceOpenPriceOf(cell)) return setIsShortageOpen(true)
    onOpenAce(cell)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 팝업이 떠 있는 동안에는 격자 키를 받지 않는다 — MessageBox 가 답을 가져간다
      if (hintCell !== null || isShortageOpen || isMaxLevelOpen || levelUpCell !== null) return
      if (overlay !== undefined && overlay !== null && overlay !== false) return
      if (!isCoachMode) {
        // 상태 21 (0x29df8): ↑ ↓ '2' '8' 은 격자에 안 넘긴다(0x29e74~0x29e80) — 그 키를 받는 갈래도 없어 아무 일이 없다.
        // 그 밖의 키는 격자 vt+0x18(0x6c031, 숫자키 꼴 1)이 '4' '6' 을 ← →, '5' 를 OK 로 바꾼다.
        // 상태 28 (0x2af20): 모든 키를 격자에 넘긴다(0x2af68~0x2af72) — '2' '8' 도 ↑ ↓.
        const direction: AnnalsDirection | null =
          event.key === 'ArrowRight' || event.key === '6' ? 'right'
          : event.key === 'ArrowLeft' || event.key === '4' ? 'left'
          : event.key === 'ArrowDown' || event.key === '8' ? 'down'
          : event.key === 'ArrowUp' || event.key === '2' ? 'up'
          : null
        if (direction !== null) {
          event.preventDefault()
          if (!isLevelUpMode && (direction === 'up' || direction === 'down')) return
          return setCursor((previous) => moveGridCursor(ACE_GRID_SHAPES[mode === '레벨업' ? '레벨업' : '고르기'], previous, direction))
        }
      } else {
        // ⚠️ 코치채용(시즌 0xd7 키 0xa734~)의 격자 꼴은 아직 안 떴다 — 칸 번호대로 끝에서 멈추는 근사 그대로
        const step =
          event.key === 'ArrowRight' ? 1
          : event.key === 'ArrowLeft' ? -1
          : event.key === 'ArrowDown' ? ACE_LAYOUT.grid.columns
          : event.key === 'ArrowUp' ? -ACE_LAYOUT.grid.columns
          : 0
        if (step !== 0) {
          event.preventDefault()
          return setCursor((previous) => Math.min(cellCount - 1, Math.max(0, previous + step)))
        }
      }
      if (event.key === 'Enter' || (event.key === '5' && !isCoachMode)) {
        event.preventDefault()
        pressCell(cursor)
        return
      }
      if (event.key === '0' && !isCoachMode) {
        event.preventDefault()
        requestLevelUp(cursor)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // 커서·열린 목록·단계를 모두 보는 닫힘이라 **매 그림마다** 새로 건다 (의존 목록 없음)
  })

  const { anchorA, anchorB } = ACE_LAYOUT
  const cursorPlayer = acePlayerOfCell(cursor)
  const isCursorOpen = isCellOpen(cursor)
  const cursorLevel = aceLevelOf(levels, cursor)

  return (
    <RawScreen>
      {underlay}
      {/*
        ⚠️ **A 딱지는 그리지 않는다 — 원본도 마선수 고르기(k 2·11)에서는 안 그린다.**
        공용 목록 0x63b15 는 A 딱지 플래그 `[sp+0xb4]` 를 기본 1 로 두는데(0x63cea `movs r2,#1`
        → 0x63cfa), 마선수 갈래가 0x63d62~0x63d68 에서 0 으로 끈다. 그리는 쪽 0x65764~0x65768 이
        `ldr r2,[sp,#0xb4]; cmp r2,#0; beq 0x657e0` 로 통째로 건너뛴다.
        (플래그를 0 으로 쓰는 곳은 셋 — 0x63d68 마선수 · 0x63da6 k 6~9 · 0x63dbc k 10.
         즉 A 딱지가 그려지는 k 는 **0·1·3·4·5 뿐**이다. 직접 디스어셈해 전수 확인했다.)
        어느 단계인지는 아래 안내 줄이 알려 준다. B 딱지(ABILITY)는 원본도 그린다.
      */}
      {/* B 딱지 — 파란 막대(117) 에 ABILITY, k 2 는 기본값 43 위다 */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, TAG.blueBar)}
        style={{ left: anchorB.x + TAG.dx, top: anchorB.y + TAG.bDyDefault }} />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={ACE_LAYOUT.tagFrames.ability} origins={imgTextOrigins} centerX
        x={anchorB.x} y={anchorB.y + TAG.bDyDefault + TAG.textDdy} />

      {/* A — 커서가 짚은 마선수. 잠겼으면 원 두 개 + LOCK */}
      {isCursorOpen && cursorPlayer !== undefined ? (
        <img className={styles.layer} alt={cursorPlayer.name} src={cursorPlayer.stillUrl}
          style={{ left: anchorA.x - 20, top: anchorA.y - 20 }} />
      ) : (
        LOCKED_CIRCLES.map((circle) => (
          <span key={circle.diameter} className={styles.lockedCircle}
            style={{
              left: anchorA.x - circle.diameter / 2,
              top: anchorA.y - circle.diameter / 2,
              width: circle.diameter,
              height: circle.diameter,
              background: circle.color,
            }} />
        ))
      )}

      {/* 이름 막대 (slt_frame 이미지 9) + 이름 + 노란 LV */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: anchorA.x + NAME_BAR.dx, top: anchorA.y + NAME_BAR.dy }} />
      <span className={styles.centeredText} data-testid="마선수-이름"
        style={{ left: anchorA.x + NAME_BAR.dx, top: anchorA.y + NAME_BAR.textDy, width: NAME_BAR.width }}>
        {isCursorOpen && cursorPlayer !== undefined
          ? `${cursorPlayer.name} LV.${cursorLevel + 1}`
          : LOCK_LABEL}
      </span>

      {/* 줄 딱지 — PITCHER / BATTER */}
      {ACE_LAYOUT.rowTags.map((tag) => (
        <span key={tag.label}>
          <span className={styles.fillPanel}
            style={{
              left: tag.panel.x, top: tag.panel.y, width: tag.panel.width, height: tag.panel.height,
              background: ACE_LAYOUT.panelColor, borderRadius: 2,
            }} />
          <img className={styles.layer} alt={tag.label} src={imageSrc(SLT_IMAGE, tag.image)}
            style={{ left: tag.imageAt.x, top: tag.imageAt.y }} />
        </span>
      ))}

      {/* 10칸 격자 */}
      {Array.from({ length: cellCount }, (_unused, cell) => {
        const { x, y } = aceCellPositionOf(cell)
        const player = acePlayerOfCell(cell)
        const open = isCellOpen(cell)
        return (
          <button
            key={cell}
            type="button"
            aria-label={open && player !== undefined ? player.name : LOCK_LABEL}
            aria-pressed={cell === cursor}
            disabled={!isCoachMode && !isCellSelectable(cell)}
            className={`${styles.cell} ${cell === cursor ? styles.cellSelected : ''}`}
            style={{ left: x, top: y, width: ACE_LAYOUT.grid.cell, height: ACE_LAYOUT.grid.cell }}
            onClick={() => (isLevelUpMode ? requestLevelUp(cell) : isCoachMode ? pressCell(cell) : onSelect(cell))}
            onMouseEnter={() => setCursor(cell)}
          >
            {open && player !== undefined
              ? <img className={styles.layer} alt="" src={player.iconUrl} style={{ left: 3, top: 3 }} />
              : <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, ACE_LAYOUT.lock.iconImage)}
                  style={{ left: 12, top: 12 }} />}
          </button>
        )
      })}

      {/* 원본에 없는 웹 전용 안내 — 흐름 배치라 (0,0) 에 떨어져 머리띠를 가리던 것을 제자리로 옮겼다 */}
      <div className={styles.hintLine}>
        <Hint>
          {isCoachMode
            ? '코치로 채용할 마선수를 고르세요 — 방향키 이동 · Enter 결정'
            : isLevelUpMode
            ? '마선수 레벨업 — 방향키 이동 · Enter/0 레벨업'
            : `${phase === ACE_PHASE.마투수 ? '마투수를 고르세요' : '마타자를 고르세요'} — 방향키 이동 · Enter 결정${onLevelUp === undefined ? '' : ' · 0 레벨업'}`}
        </Hint>
      </div>

      {/* 머리띠(제목 8 "마선수선택")·바닥띠 — 원본 공용 목록 k 2 도 이 둘을 얹는다 (P6 1-1 · 2a-5) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      {/* 바닥 0x205 = 가운데 "0레벨업" + 되돌아가기 — 일반모드 0x2df78 · 0x2dfe0, 시즌 0xaa24(선수단 [+0x11c] ≠ 2) 모두 */}
      {/* 코치채용(this+0x11c == 2)은 0x54d95(skin, 4, 5) — 되돌아가기만 (0xad94~0xada0) */}
      <ScreenFrame title="마선수선택" gamePoint={gamePoint} onBack={onCancel} footer={isCoachMode ? 5 : 0x205} />

      {/*
        **오픈 힌트 팝업** (0xa68e~0xa6dc) — 칸 4·9(드래고나·킹타이거)는 StrCOMMON[42] 알림 하나,
        나머지는 StrCOMMON[43] 예/아니오다. 버튼 짝은 원본대로 두었지만 **"예" 가 아무 일도 하지 않는다** —
        G포인트를 빼고 오픈 플래그를 세울 저장 칸이 웹판에 없다 (근사).
      */}
      {hintCell !== null && (
        <MessageBox
          text={aceOpenPopupTextOf(hintCell)}
          buttons={aceOpensWithGamePoint(hintCell) ? ['예', '아니오'] : ['OK']}
          onAnswer={(answer) => answerOpenPopup(hintCell, answer)}
        />
      )}

      {/*
        **G포인트 부족 팝업** (0xa46e → 0xaa00, id 0x20) — 글은 문자열표가 아니라 코드에 박힌
        0xcc214 다. ⚠️ 원본은 "예" 가 유료 구매 페이지로 나가지만 웹판에는 그 길이 없어 둘 다 닫는다.
      */}
      {isShortageOpen && (
        <MessageBox
          text={ACE_OPEN_SHORTAGE_POPUP}
          buttons={['예', '아니오']}
          onAnswer={() => setIsShortageOpen(false)}
        />
      )}

      {/* StrCOMMON[40] — 최고 레벨 알림 (0x2b0e4 · 0x29f8a, 버튼 하나) */}
      {isMaxLevelOpen && (
        <MessageBox text={ACE_LEVEL_UP_TEXT.maxLevel} buttons={['OK']} onAnswer={() => setIsMaxLevelOpen(false)} />
      )}

      {/* 레벨업 창 0x5f394 · 0x5fb24 — 머리띠 위에 겹친다 (갱신 함수가 목록보다 먼저 키를 넘긴다) */}
      {levelUpCell !== null && onLevelUp !== undefined && (
        <AceLevelUpWindow
          cell={levelUpCell}
          level={aceLevelOf(levels, levelUpCell)}
          gamePoint={gamePoint}
          onLevelUp={onLevelUp}
          onClose={() => setLevelUpCell(null)}
        />
      )}
      {overlay}
    </RawScreen>
  )
}
