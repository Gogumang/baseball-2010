import { useEffect, useState } from 'react'
import { FrameSprite, Hint, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { aceOpenPopupTextOf, aceOpensWithGamePoint } from '@/shared/config/original/aceOpen'
import { ACE_LAYOUT, LOCKED_CIRCLES, NAME_BAR, TAG, aceCellPositionOf } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PER_ROLE, ACE_PHASE, aceIndexOfCell, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

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
   * 마선수 레벨 — 이름 막대 글은 `"!C!cFFFFFF%s !cFFFF00LV.%d"` (0xd2498) 다.
   * ⚠️ **값이 없어 못 채운 자리**: 레벨은 스페셜 마선수 화면(상태 28)이 올리는 저장 값이고
   *    웹판에는 아직 그 저장이 없다. 없으면 이름만 그린다.
   */
  readonly levels?: Readonly<Record<number, number>>
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  readonly onSelect: (cell: number) => void
  readonly onCancel: () => void
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
 * ⚠️ 여기 없는 것:
 *   - **실제 오픈**. 원본은 [43] 에서 "예" 를 고르면 G포인트를 빼고 오픈 플래그(`mgr[0x30+idx]`)를
 *     세우는데, 웹판 저장에는 그 칸이 없다 (`App.tsx` 의 `DEFAULT_OPENED_ACE_*` 로 고정). 그래서
 *     팝업은 **힌트만 보여 주고 닫힌다** — 근사다.
 *   - `0` 키의 레벨업 하위 창 (하위 단계 1·2·10, K 3-3 쪽). 레벨업 비용 표는 이 표가 아니다.
 *   - 열린 마선수 자리의 애니메이션 `[skin+0x138]` — 여기서는 정지 그림을 쓴다.
 */
export function AceSelectScreen({
  phase, openedAcePitcherIds = [], openedAceBatterIds = [], levels, gamePoint = 0, onSelect, onCancel,
}: AceSelectScreenProps) {
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const cellCount = ACE_LAYOUT.grid.columns * ACE_LAYOUT.grid.rows
  // 마투수 단계는 윗줄에서, 마타자 단계는 아랫줄에서 커서가 시작한다 (원본이 OK 뒤 커서를 내린다)
  const [cursor, setCursor] = useState(phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)
  /** 오픈 힌트 팝업이 뜬 칸 (0xa68e~0xa6dc). null 이면 안 뜬 것 */
  const [hintCell, setHintCell] = useState<number | null>(null)

  useEffect(() => {
    setCursor(phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)
  }, [phase])

  const isCellOpen = (cell: number) =>
    aceRoleOfCell(cell) === ACE_PHASE.마투수
      ? openedAcePitcherIds.includes(aceIndexOfCell(cell))
      : openedAceBatterIds.includes(aceIndexOfCell(cell))

  /** 지금 단계의 줄만 고를 수 있다 — 원본도 단계에 맞는 줄에서만 OK 를 받는다 */
  const isCellSelectable = (cell: number) => aceRoleOfCell(cell) === phase && isCellOpen(cell)

  /**
   * OK 한 번 — 열린 칸이면 고르고, **잠긴 칸이면 오픈 힌트 팝업**을 띄운다 (0xa248 → 0xa68e).
   * 팝업은 단계에 맞는 줄에서만 띄운다 (OK 를 받는 줄이 거기뿐이다).
   */
  const pressCell = (cell: number) => {
    if (isCellSelectable(cell)) return onSelect(cell)
    if (aceRoleOfCell(cell) === phase) setHintCell(cell)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 팝업이 떠 있는 동안에는 격자 키를 받지 않는다 — MessageBox 가 답을 가져간다
      if (hintCell !== null) return
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
      if (event.key === 'Enter') {
        event.preventDefault()
        pressCell(cursor)
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
  const cursorLevel = levels?.[cursor]

  return (
    <RawScreen>
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
          ? `${cursorPlayer.name}${cursorLevel === undefined ? '' : ` LV.${cursorLevel}`}`
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
            disabled={!isCellSelectable(cell)}
            className={`${styles.cell} ${cell === cursor ? styles.cellSelected : ''}`}
            style={{ left: x, top: y, width: ACE_LAYOUT.grid.cell, height: ACE_LAYOUT.grid.cell }}
            onClick={() => onSelect(cell)}
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
          {phase === ACE_PHASE.마투수 ? '마투수를 고르세요' : '마타자를 고르세요'} — 방향키 이동 · Enter 결정
        </Hint>
      </div>

      {/* 머리띠(제목 8 "마선수선택")·바닥띠 — 원본 공용 목록 k 2 도 이 둘을 얹는다 (P6 1-1 · 2a-5) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame title="마선수선택" gamePoint={gamePoint} onBack={onCancel} />

      {/*
        **오픈 힌트 팝업** (0xa68e~0xa6dc) — 칸 4·9(드래고나·킹타이거)는 StrCOMMON[42] 알림 하나,
        나머지는 StrCOMMON[43] 예/아니오다. 버튼 짝은 원본대로 두었지만 **"예" 가 아무 일도 하지 않는다** —
        G포인트를 빼고 오픈 플래그를 세울 저장 칸이 웹판에 없다 (근사).
      */}
      {hintCell !== null && (
        <MessageBox
          text={aceOpenPopupTextOf(hintCell)}
          buttons={aceOpensWithGamePoint(hintCell) ? ['예', '아니오'] : ['OK']}
          onAnswer={() => setHintCell(null)}
        />
      )}
    </RawScreen>
  )
}
