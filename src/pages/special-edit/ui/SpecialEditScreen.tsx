import { useEffect, useRef, useState } from 'react'
import { MarkupText, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { EDITED_NAME_BYTES } from '@/entities/player-name/model/editedNames'
import { pointEntryCursor } from '@/entities/season-mode/model/entryEditor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, NAME_BAR, TAG, abilityChartFrameOf, abilityChartVerticesOf, cellPositionOf,
} from '@/pages/create-player/lib/teamSelectLayout'
import {
  EDIT_GRID_COLUMNS, EDIT_TEAM_COUNT, SPECIAL_EDIT_STEP, chooseEditTeam, closeEditName, createSpecialEditState,
  editEntryListsOf, editTargetOf, moveEditGrid, pointEditGrid, pressEditEntryKey,
} from '@/pages/special-edit/lib/specialEditFlow'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

const SLT_IMAGE = './sprites/slt_frame'
const IMG_TEXT = './sprites/img_text/frames'
const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`
/** 격자 칸 바탕 slt_frame 이미지 0 · 고른 칸 테두리 이미지 1 (42×42) · 칸 로고 38 — 팀 고르기 화면과 같은 근사 */
const CELL_FRAME_IMAGE = 0
const CELL_CURSOR_IMAGE = 1
const CELL_CURSOR_SIZE = 42
const CELL_LOGO_SIZE = 38
const BIG_LOGO_HALF = 38

/**
 * StrMAINMENU[108] 원문 (`base/extracted/StrMAINMENU.json`). 팝업 그리기 0x32b7d 는 [109](아이디 입력)를 기본으로 잡고
 * this+0x181 == 1(에디트가 세운 깃발)이면 [108] 로 바꾼다 (0x32ba4~0x32bc8).
 */
const NAME_PROMPT = '!C!cFFFFFF이름을 입력해 주세요!N(!cFFFF00한글 4글자, 영문 8글자!cFFFFFF)'

interface SpecialEditScreenProps {
  /** 머리띠 0x54d95 는 제목이 있으면 전역 G(mgr+0x64)를 같이 그린다 */
  readonly gamePoint: number
  /** 이름 저장 0xaa4ad(이름표, id, 글, 투수?) + 파일 저장 0x1f1b9 */
  readonly onRename: (id: number, isPitcher: boolean, name: string) => void
  /** 하위 0 의 CLR → 스페셜 목록(상태 6, 0x2b432 `0xbcb49(this+0x18, 6)`) */
  readonly onBack: () => void
}

/**
 * **스페셜 에디트** (메인 메뉴 상태 29) — 선수 이름 바꾸기. 흐름·근거는 `specialEditFlow` 머리글.
 *
 * 그리기 0x2e1e0: 배경 0x58371 → 목록 k 9(팀 고르기 본문 0x63dee, 격자 10칸)을 **늘** 그리고,
 * - 하위 0: 머리띠 `0x54d95(skin, 1 "팀선택", 5 되돌아가기)`
 * - 하위 1·2: 그 위에 엔트리 창 `0x5d055 → 0x5cfec` + 머리띠 `0x54d95(skin, 1 "팀선택", 투수 탭 ? 0xf : 0x17)`
 *
 * ⚠️ 근사·미해결: 엔트리 창 아래에 깔린 팀 고르기 본문은 웹 엔트리 화면 판에 가려 따로 안 그린다 ·
 *    배경 0x58371 그림 · 엔트리 창 칸 배치(편집기 화면 머리글) · 입력 창 판 높이와 칸 둘레 그림(아래 `EditNamePopup`).
 */
export function SpecialEditScreen({ gamePoint, onRename, onBack }: SpecialEditScreenProps) {
  const [state, setState] = useState(createSpecialEditState)

  if (state.step === SPECIAL_EDIT_STEP.팀고르기) {
    return (
      <EditTeamSelect
        cursor={state.gridCursor}
        gamePoint={gamePoint}
        onMove={(step) => setState((previous) => moveEditGrid(previous, step))}
        onPoint={(index) => setState((previous) => pointEditGrid(previous, index))}
        onChoose={() => setState((previous) => chooseEditTeam(previous))}
        onBack={onBack}
      />
    )
  }

  const lists = editEntryListsOf(state.team)
  const onKey = (key: EntryKey) => setState((previous) => pressEditEntryKey(previous, key))

  return (
    <EntryEditorScreen
      editor={state.editor}
      lists={lists}
      teamName={TEAMS[state.team]?.name ?? ''}
      isAceLocked={false}
      gamePoint={gamePoint}
      title="팀선택"
      onKey={onKey}
      onMoveCursor={(index) => setState((previous) => ({ ...previous, editor: pointEntryCursor(previous.editor, lists, index) }))}
      onCloseAceLocked={() => undefined}
      overlay={state.step === SPECIAL_EDIT_STEP.이름입력 && (
        <EditNamePopup
          onConfirm={(name) => {
            const target = editTargetOf(state)
            if (target !== null) onRename(target.id, target.isPitcher, name)
            setState((previous) => closeEditName(previous))
          }}
          onCancel={() => setState((previous) => closeEditName(previous))}
        />
      )}
    />
  )
}

interface EditTeamSelectProps {
  readonly cursor: number
  readonly gamePoint: number
  readonly onMove: (step: number) => void
  readonly onPoint: (index: number) => void
  readonly onChoose: () => void
  readonly onBack: () => void
}

/**
 * 하위 0 — 목록 k 9 = 팀 고르기 본문 0x63dee (P6 2a-2): A (58,110) 에 팀 로고·이름 막대, B (178,96) 에 능력치 도형,
 * 딱지 157 "PLAYER" · 159 "ABILITY", 격자 `0x79ed5(…, 9, 120, 182, …, 40, 5열, 행 = 10/5)`.
 * 팀 0~9 는 늘 열려 있어 잠김 그림이 없다.
 */
function EditTeamSelect({ cursor, gamePoint, onMove, onPoint, onChoose, onBack }: EditTeamSelectProps) {
  const team = TEAMS[cursor] ?? TEAMS[0]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1
        : event.key === 'ArrowLeft' ? -1
          : event.key === 'ArrowDown' ? EDIT_GRID_COLUMNS
            : event.key === 'ArrowUp' ? -EDIT_GRID_COLUMNS
              : 0
      if (step !== 0) {
        event.preventDefault()
        return onMove(step)
      }
      if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        return onChoose()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onMove, onChoose, onBack])

  const chartCenter = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  const radius = ABILITY_CHART.radius
  const pointsOf = (points: readonly { readonly x: number; readonly y: number }[]) =>
    points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <RawScreen>
      {[
        { anchor: ANCHOR_A, bar: TAG.aBarImage, barDy: TAG.aDy, textDy: TAG.aTextDy, frame: TAG.aTextFrame },
        { anchor: ANCHOR_B, bar: TAG.bBarImage, barDy: TAG.bDy, textDy: TAG.bTextDy, frame: TAG.bTextFrame },
      ].map(({ anchor, bar, barDy, textDy, frame }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, bar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + barDy }} />
          <img className={styles.layer} alt="" src={imageSrc(IMG_TEXT, frame)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + textDy, width: TAG.barWidth, objectFit: 'none' }} />
        </span>
      ))}

      <img className={styles.layer} alt={team.name} src={team.logoUrl}
        style={{ left: ANCHOR_A.x - BIG_LOGO_HALF, top: ANCHOR_A.y - BIG_LOGO_HALF }} />
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + NAME_BAR.dy }} />
      <span className={styles.centeredText}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + 42, width: NAME_BAR.width }}>
        {team.name}
      </span>

      {/* 능력치 도형 0x5aefd(…, 종류 0, 팀, 반지름 30) — 팀 고르기 화면과 같은 식 */}
      <svg className={styles.layer} width={radius * 2} height={radius * 2} shapeRendering="crispEdges"
        viewBox={`${chartCenter.x - radius} ${chartCenter.y - radius} ${radius * 2} ${radius * 2}`}
        style={{ left: chartCenter.x - radius, top: chartCenter.y - radius }}>
        <polygon points={pointsOf(abilityChartFrameOf(chartCenter))}
          fill="none" stroke={ORIGINAL_COLORS.radarAxis} strokeWidth={1} />
        <polygon points={pointsOf(abilityChartVerticesOf(chartCenter, team.values.slice(2), radius))}
          fill={ORIGINAL_COLORS.radarFill} fillOpacity={0xb4 / 0xff}
          stroke={ORIGINAL_COLORS.radarEdge} strokeWidth={1} />
      </svg>

      {TEAMS.slice(0, EDIT_TEAM_COUNT).map((entry, index) => {
        const { x, y } = cellPositionOf(index, EDIT_TEAM_COUNT)
        return (
          <button key={entry.id} type="button" aria-label={entry.name} aria-pressed={index === cursor}
            className={styles.cell} style={{ left: x, top: y, width: GRID.cell, height: GRID.cell }}
            onClick={() => (index === cursor ? onChoose() : onPoint(index))}
            onMouseEnter={() => onPoint(index)}>
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)} style={{ left: 0, top: 0 }} />
            <img className={styles.layer} alt="" src={entry.logoUrl}
              style={{
                left: (GRID.cell - CELL_LOGO_SIZE) / 2, top: (GRID.cell - CELL_LOGO_SIZE) / 2,
                width: CELL_LOGO_SIZE, height: CELL_LOGO_SIZE,
              }} />
            {index === cursor && (
              <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_CURSOR_IMAGE)}
                style={{ left: (GRID.cell - CELL_CURSOR_SIZE) / 2, top: (GRID.cell - CELL_CURSOR_SIZE) / 2 }} />
            )}
          </button>
        )
      })}

      {/* 머리띠 0x54d95(skin, 1 "팀선택", 5 되돌아가기) — 0x2e224 */}
      <ScreenFrame title="팀선택" gamePoint={gamePoint} onBack={onBack} footer={5} />
    </RawScreen>
  )
}

/**
 * 판 높이 — 0x741a1 이 팝업 +0x20e 에 넣는 0x6e = 110. ⚠️ 유력: 판이 세로 가운데 (320 − 110) / 2 = 105 에 선다고 보았다
 * (메시지 상자 0x74ef4 와 같은 가운데 맞춤). 글·칸 좌표는 그리기 콜백 0x32b7d 에서 떴다(확정).
 */
const POPUP_HEIGHT = 0x6e
const POPUP_TOP = (320 - POPUP_HEIGHT) / 2
/** 문구 `0xba269(글, W/2 − 100, 0x82, 0xc8, 흰색)` */
const PROMPT = { x: 120 - 100, y: 0x82, width: 0xc8 } as const
/** 입력 칸 폭 100 × 높이 15 를 (W/2 − 50, 0xaf) 에 RGB(30,45,160) 로 채운다 (0x6b7d5) */
const FIELD = { x: 120 - 50, y: 0xaf, width: 0x64, height: 0xf } as const

interface EditNamePopupProps {
  readonly onConfirm: (name: string) => void
  readonly onCancel: () => void
}

/**
 * **이름 입력 창** — 팝업 0x741a1(popup, 0x6e, 그리기·확인 0x32b7d, 키 0x32b5d) · 입력기 켜기 0x54145(skin, 3 한글, 8 바이트, 1, 1).
 * 켜기가 버퍼를 비우므로(0x670d5) 늘 빈 칸으로 열린다.
 * ```
 * 32b5d  키 → 입력기 0x54279 (글자 · CLR 은 글자가 있으면 한 글자 지우기 0x66fd5)
 * 32cf6  CLR(−16) && strlen(버퍼) == 0 → 결과 −1 (취소)
 * 32d14  OK(−5)  && strlen(버퍼) != 0 → 결과 0  (확인) — 빈 이름은 확인이 안 된다
 * ```
 * 원본 입력기([0x1552d00], 모드 A·a·1·가 를 좌우로 바꾸고 한글 조합은 폰 플랫폼이 한다 — R11 2절)는
 * 웹 입력 칸으로 대신하고 CP949 8 바이트 검사만 원본대로 둔다. Escape = CLR, Enter = OK.
 *
 * ⚠️ 미해결: 같은 틱에 CLR 이 마지막 한 글자를 지운 뒤 0x32b7d 가 빈 버퍼를 보고 곧장 취소까지 하는지
 *    (두 콜백의 부르는 차례)를 확정 못 했다 — 웹은 글자가 있으면 지우기만 한다.
 *    칸 둘레의 흰 선(0x541a9·0x541ed)과 [this+0x9c] 프레임 20·17 두 조각은 인자 뜻을 다 못 읽어 안 그렸다.
 */
function EditNamePopup({ onConfirm, onCancel }: EditNamePopupProps) {
  const [name, setName] = useState('')
  const nameRef = useRef(name)
  nameRef.current = name
  const handlersRef = useRef({ onConfirm, onCancel })
  handlersRef.current = { onConfirm, onCancel }

  useEffect(() => {
    // 창이 떠 있는 동안 키는 창 것이다 — 뒤의 엔트리 화면(window 리스너)이 숫자·* 키를 가로채지 않게 잡는 단계에서 멈춘다
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        if (nameRef.current.length > 0) handlersRef.current.onConfirm(nameRef.current)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (nameRef.current.length === 0) return handlersRef.current.onCancel()
        setName((previous) => [...previous].slice(0, -1).join(''))
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <div className={styles.dim} role="dialog" aria-label="이름 입력">
      <div className={styles.band} style={{ top: POPUP_TOP, height: POPUP_HEIGHT }} />
      <div className={styles.prompt} style={{ left: PROMPT.x, top: PROMPT.y, width: PROMPT.width }}>
        <MarkupText raw={NAME_PROMPT} />
      </div>
      <input className={styles.field} aria-label="이름" value={name} autoFocus
        style={{ left: FIELD.x, top: FIELD.y, width: FIELD.width, height: FIELD.height }}
        onChange={(event) => {
          // CP949 8 바이트까지 (입력기 최대 I+8 = min(8, 64), R11 1b — 한글 2 · 그 밖 1, 섞어 써도 된다)
          if (nameByteLengthOf(event.target.value) <= EDITED_NAME_BYTES) setName(event.target.value)
        }} />
    </div>
  )
}
