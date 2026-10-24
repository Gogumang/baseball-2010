import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import { skinNameBarsValue } from '@/shared/lib/skinNameBars/skinNameBars'
import { MarkupText, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { EDITED_NAME_BYTES } from '@/entities/player-name/model/editedNames'
import { pointEntryCursor } from '@/entities/season-mode/model/entryEditor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, NAME_BAR, TAG, abilityAxisMaximumLengthOf, cellPositionOf,
  teamGridOpenShapeOf,
} from '@/pages/create-player/lib/teamSelectLayout'
import {
  EDIT_GRID_SHAPE, EDIT_TEAM_COUNT, SPECIAL_EDIT_STEP, chooseEditTeam, closeEditName, createSpecialEditState,
  editEntryListsOf, editTargetOf, frameEditEntry, moveEditGrid, pointEditGrid, pressEditEntryKey,
} from '@/pages/special-edit/lib/specialEditFlow'
import type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/special-edit/ui/SpecialEditScreen.css'
import { ENTRY_TABLES_WIDE, EntryEditorScreen } from '@/widgets/entry-editor'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
import { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { GridCellBack } from '@/pages/create-player/ui/GridCellBack'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

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
 * 배경은 메뉴 바탕 0x58371(skin, main_title, 0) — 하위 0 · 1 · 2 모두 맨 먼저 깐다(0x2e1e0 의 첫 부름).
 * 엔트리 창(넓은 표 · 커서 이름 칸만 [skin+0x438] = 1 — `EntryEditorScreen` / `widgets/entry-editor/lib/entryListWindow`).
 *
 * 엔트리 창 아래에 깔린 팀 고르기 본문(딱지 · 큰 로고 · 이름 막대 · 격자 30~267)은 판(15, 55, 210, 220) = x 15~224 안이라 가려진다.
 * 다만 능력치 도형의 오른쪽 이름 상자 둘(축 끝 x = 178 + (48·cos45 >> 16) = 211 → 상자 x 210, 폭 26 — 0x5b412~0x5b532)은
 * x 225~235 가 판 밖으로 나와 원본에서도 보인다(r166 확정) — 그래서 그 도형(커서 팀, 다 자란 값)만 엔트리 창 밑에 깐다.
 * 도형 객체 [skin+0xd4] 는 웹도 앱에 하나(`useRadarGrowth`)라 하위가 바뀌어도 다시 만들지 않고(+0x1e3 그대로) 지금값(E+8)에서
 * 한 그림 한 걸음씩 잇는다 — 다 자라기 전에 골라도 원본처럼 이어 자란다(r181 — `continueRadarGrowth`).
 * 입력 창(판 높이 0x6e · 입력 방식 표시)은 아래 `EditNamePopup`.
 */
export function SpecialEditScreen({ gamePoint, onRename, onBack }: SpecialEditScreenProps) {
  const [state, setState] = useState(createSpecialEditState)
  // 머리띠 미끄러짐 [skin+0x84] 는 상태 29 진입 0x24804(24846) 와 그림 0x2e1e0 의 공용 목록 0x63b14(상태 틱 0 인 첫 그림)만 세운다.
  // 하위 0 ↔ 1 ↔ 2 는 [skin+0xe6] 만 바뀌고 상태 틱은 이어지므로 다시 미끄러지지 않는다 — 처음 선 하위 0 에서만 미끄러진다
  const [hasLeftTeamSelect, setLeftTeamSelect] = useState(false)
  useEffect(() => {
    if (state.step !== SPECIAL_EDIT_STEP.팀고르기) setLeftTeamSelect(true)
  }, [state.step])

  if (state.step === SPECIAL_EDIT_STEP.팀고르기) {
    return (
      <EditTeamSelect
        cursor={state.gridCursor}
        gamePoint={gamePoint}
        slides={!hasLeftTeamSelect}
        onMove={(direction) => setState((previous) => moveEditGrid(previous, direction))}
        onPoint={(index) => setState((previous) => pointEditGrid(previous, index))}
        onChoose={() => setState((previous) => chooseEditTeam(previous))}
        onBack={onBack}
      />
    )
  }

  const lists = editEntryListsOf(state.team)
  const onKey = (key: EntryKey) => setState((previous) => pressEditEntryKey(previous, key))
  const onFrame = () => setState(frameEditEntry)

  return (
    <EntryEditorScreen
      editor={state.editor}
      lists={lists}
      underlay={(
        <>
          <SkinBackdrop kind="메뉴바탕" />
          {/* 팀 고르기 본문 0x63dee 의 ABILITY 판 — 오른쪽 이름 상자가 엔트리 창 오른쪽 밖으로 나온다(머리말) */}
          <AbilityRadarPanel center={{ x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }}
            radius={ABILITY_CHART.radius} maximumLength={abilityAxisMaximumLengthOf(ABILITY_CHART.radius)}
            labelFrames={ABILITY_RADAR_LABELS.team} targets={(TEAMS[state.team] ?? TEAMS[0]).values.slice(2)}
            restartKey={state.team} fromZero={false} />
        </>
      )}
      teamName={TEAMS[state.team]?.name ?? ''}
      isAceLocked={false}
      gamePoint={gamePoint}
      title="팀선택"
      slides={false}
      tables={ENTRY_TABLES_WIDE}
      // 0x2b2e0 은 [skin+0x333] 을 세우지 않는다 — 앞 화면이 남긴 값이다. 부팅 뒤 처음이면 0 — skin 할당 0x1238 → 0x2ac4 가
      // 할당 뒤 memset(0) 한다(2ad4). 이 칸에 쓰는 곳은 모두 1 이다(시즌 엔트리 · 0x16af8 · 0x2648c · 교체 창 0x37904 · 0x37e5c —
      // `shared/lib/skinNameBars`, 확정 r166) — 그 화면을 한 번이라도 거쳤으면 이름 칸을 덧그린다
      showsNameBars={skinNameBarsValue() !== 0}
      isCursorNameOnly
      onFrame={onFrame}
      ticksEveryFrame
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
  readonly onMove: (direction: AnnalsDirection) => void
  readonly onPoint: (index: number) => void
  readonly onChoose: () => void
  readonly onBack: () => void
  /** 머리띠가 미끄러져 들어오는가 — 상태 29 에 처음 선 하위 0 만 (`ScreenFrame` 의 `slides`) */
  readonly slides: boolean
}

/** 에디트 10칸 격자의 열림 애니 꼴 — 2줄 · 세로틈 8 (k 9, 0x64032~0x6403c) */
const EDIT_GRID_OPEN = teamGridOpenShapeOf(EDIT_TEAM_COUNT)

/** 격자 키 — 방향키와 숫자 2·4·6·8 (격자 키 처리 0x6c299 의 표 0xd2e7c) */
const ARROW_DIRECTIONS: Readonly<Record<string, AnnalsDirection>> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', 4: 'left', 6: 'right', 2: 'up', 8: 'down',
}

/**
 * 하위 0 — 목록 k 9 = 팀 고르기 본문 0x63dee (P6 2a-2): A (58,110) 에 팀 로고·이름 막대, B (178,96) 에 능력치 도형,
 * 딱지 157 "PLAYER" · 159 "ABILITY", 격자 `0x79ed5(…, 9, 120, 182, …, 40, 5열, 행 = 10/5)`.
 * 팀 0~9 는 늘 열려 있어 잠김 그림이 없다.
 */
function EditTeamSelect({ cursor, gamePoint, onMove, onPoint, onChoose, onBack, slides }: EditTeamSelectProps) {
  const team = TEAMS[cursor] ?? TEAMS[0]
  // 갱신 0x2b2e0 은 하위 0([skin+0xe6] == 0, 0x2b30e~0x2b318)에서 맨 앞에 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다(0x2b31a~0x2b326)
  // — 머리띠가 미끄러지는 동안(본문 없음)과 격자 열림 애니(0x79fa8) 동안이다. 애니는 [skin+0xe8] = 넷째 인자 1 이라 미끄러질 때 돈다
  const entry = useListPageEntry({ slides, grid: { shape: EDIT_GRID_OPEN, isAnimated: slides } })
  const { keyLock } = entry
  const gridOpen = entry.grid
  // 격자 시작 0x7a005(격자, [skin+0xe8], 1, 1) — [격자+6] = 1 이라 칸이 바뀐 키에 커서 튕김 (0x6409c)
  const bounce = useGridCursorBounce()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyLock.current) return
      const direction = ARROW_DIRECTIONS[event.key]
      if (direction !== undefined) {
        event.preventDefault()
        if (moveGridCursor(EDIT_GRID_SHAPE, cursor, direction) !== cursor) bounce.start(direction)
        return onMove(direction)
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
  }, [onMove, onChoose, onBack, keyLock, cursor, bounce.start])

  const chartCenter = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  const radius = ABILITY_CHART.radius

  return (
    <RawScreen>
      {/* 0x2e1e0 첫 부름 — 메뉴 바탕 0x58371(skin, main_title, 0) */}
      <SkinBackdrop kind="메뉴바탕" />
      {gridOpen !== null && (<>
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

      {/* 능력치 도형 0x5aefd(…, 종류 0, 0, 칸(≤ 9 라 잠김 없음), 반지름 30) — 공용 목록 k 9 도 점프표 0xd1edc 로 팀 고르기와 같은
          본문 0x63dee 를 타고 0x63f38 에서 ABILITY 판 전체(바탕 · 축 · 이름 상자 46 · 45 · 204 · 205 · 숫자)를 그린다.
          값 도형은 레이더 [skin+0xd4] 의 자라는 애니 — 들어옴 0x24804 가 +0xad = 0 으로 두어 0 에서, 커서가 움직인 그림(커서 +0x25)엔
          0x63b14 가 +0x1e3 = 0 으로 두어 지난 값에서. 하위 1 · 2 에서 돌아오면 들어옴도 틱 0 도 안 거쳐 다 자란 그대로다 */}
      <AbilityRadarPanel center={chartCenter} radius={radius} maximumLength={abilityAxisMaximumLengthOf(radius)}
        labelFrames={ABILITY_RADAR_LABELS.team} targets={team.values.slice(2)} restartKey={cursor} fromZero={slides} />

      {/* 칸 바탕 — 시작 0x7a005(격자, [skin+0xe8], 1, 1) 의 [격자+8] = 1 (0x7a7da~0x7a89c) */}
      {TEAMS.slice(0, EDIT_TEAM_COUNT).map((entry, index) => {
        const shake = index === cursor ? bounce.offset : null
        return (
          <GridCellBack key={`back-${entry.id}`} className={styles.layer}
            x={cellPositionOf(index, EDIT_TEAM_COUNT).x + (shake?.dx ?? 0)}
            y={cellPositionOf(index, EDIT_TEAM_COUNT).y + gridOpenCellDy(EDIT_GRID_OPEN, gridOpen.state, index) + (shake?.dy ?? 0)}
            width={GRID.cell} height={GRID.cell} />
        )
      })}
      {TEAMS.slice(0, EDIT_TEAM_COUNT).map((entry, index) => {
        const shake = index === cursor ? bounce.offset : null
        const x = cellPositionOf(index, EDIT_TEAM_COUNT).x + (shake?.dx ?? 0)
        const y = cellPositionOf(index, EDIT_TEAM_COUNT).y + gridOpenCellDy(EDIT_GRID_OPEN, gridOpen.state, index) + (shake?.dy ?? 0)
        return (
          <button key={entry.id} type="button" aria-label={entry.name} aria-pressed={index === cursor}
            className={styles.cell} style={{ left: x, top: y, width: GRID.cell, height: GRID.cell }}
            onClick={() => (index === cursor ? onChoose() : onPoint(index))}>
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)} style={{ left: 0, top: 0 }} />
            <img className={styles.layer} alt="" src={entry.logoUrl}
              style={{
                left: (GRID.cell - CELL_LOGO_SIZE) / 2, top: (GRID.cell - CELL_LOGO_SIZE) / 2,
                width: CELL_LOGO_SIZE, height: CELL_LOGO_SIZE,
              }} />
            {index === cursor && gridOpen.state.isDone && (
              <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_CURSOR_IMAGE)}
                style={{ left: (GRID.cell - CELL_CURSOR_SIZE) / 2, top: (GRID.cell - CELL_CURSOR_SIZE) / 2 }} />
            )}
          </button>
        )
      })}
      </>)}

      {/* 머리띠 0x54d95(skin, 1 "팀선택", 5 되돌아가기) — 0x2e224 */}
      <ScreenFrame title="팀선택" gamePoint={gamePoint} onBack={onBack} footer={5} slides={slides} />
    </RawScreen>
  )
}

/**
 * 판 높이 — 0x741a1 이 팝업 +0x20e 에 넣는 0x6e = 110. 판은 세로 가운데 (320 − 110) / 2 = 105 다 — 확정(2026-10-14):
 * 그리기 0x744c4 가 x = (W − 폭) >> 1 · y = ((H − 그리는 높이) >> 1) + [창+0x244](0x741a0 이 0) 로 긋는다(0x744de~0x74520).
 * 글·칸 좌표는 그리기 콜백 0x32b7d 에서 떴다(확정).
 */
const POPUP_HEIGHT = 0x6e
/** 문구 `0xba269(글, W/2 − 100, 0x82, 0xc8, 흰색)` */
const PROMPT = { x: 120 - 100, y: 0x82, width: 0xc8 } as const
/** 입력 칸 폭 100 × 높이 15 를 (W/2 − 50, 0xaf) 에 RGB(30,45,160) 로 채운다 (0x6b7d5) */
const FIELD = { x: 120 - 50, y: 0xaf, width: 0x64, height: 0xf } as const
/**
 * 입력 칸 오른쪽 **입력 방식 표시** (U-91, 직접 뜸 — 0x32c96~0x32cf2 · 0x541ed · 0x676e9):
 * ```
 * 0x541ed(skin, x + w + 0xe = 184, y + 1 = 176, 흰색)   ; 글 = 표 0x1400148[입력기 +0x14] — 0 "A" · 1 "a" · 2 "1" · 3 "가"
 *                                                       ; 0x6b391 로 x = (방식 3 ? 184 : 186)
 * 0xba759([장면+0x9c] slt_frame, 이미지 20, 종류 0, x + w + 5 = 175, y + 2 = 177)          ; ◀ (5×8)
 * 0xba759([장면+0x9c] slt_frame, 이미지 20, 종류 0, x + w + 0x18 = 194, y + 2 = 177, 효과 0x11) ; ▶ (뒤집기)
 * ```
 * 칸 둘레에 흰 선은 없다 — 0x541a9 는 입력 글(0x677d5), 0x541ed 는 이 방식 글이다(앞선 노트의 "흰 선" · "프레임 20/17" 은 오독).
 * 입력기는 0x54145(skin, **3**, 8, 1, 1) 로 켜므로 처음 방식은 3 "가" 다. 웹은 방식을 바꾸는 키(←/→ 0x673ed · 0x673a9)가 없는
 * 일반 입력 칸이라 처음 표시 "가" 에 머문다.
 */
const INPUT_MODE_MARK = { label: '가', x: 120 - 50 + 0x64 + 0xe, y: 0xaf + 1 } as const
const INPUT_MODE_ARROWS = { image: './sprites/slt_frame/020.png', leftX: 120 - 50 + 0x64 + 5, rightX: 120 - 50 + 0x64 + 0x18, y: 0xaf + 2 } as const

interface EditNamePopupProps {
  readonly onConfirm: (name: string) => void
  readonly onCancel: () => void
}

/** 이름 창 확정 — OK(Enter) · 지우기/취소 — CLR(Escape) */
const EDIT_NAME_CONFIRM_OFFER: TouchKeyOffer = { key: 'Enter', label: '확정' }
const EDIT_NAME_CLEAR_OFFER: TouchKeyOffer = { key: 'Escape', label: '지우기·취소' }

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
 * **CLR 이 마지막 한 글자를 지우면 같은 그림에 곧장 취소된다** (U-91 닫음, 직접 뜸): 메뉴 틀 0x32fa0 은 한 그림에
 *    0xbca05(키 → [장면+0x40], 그림마다 새로 적는다) → 갱신 0x32634(0x754f9 → 종류 8 이면 키 콜백 0x32b5d → 0x54279: CLR 이고
 *    버퍼가 있으면 0x66fd5 한 글자 지우기) → 그리기 0x32dd8(끝의 0x746cd → 그리기 콜백 0x32b7c) 차례다. 0x32b7c 는 키를 인자가
 *    아니라 [장면+0x40] 으로 읽으므로(32cf6) 같은 그림에서 CLR 과 방금 빈 버퍼를 보고 0x74361(창, −1) 로 닫는다.
 */
function EditNamePopup({ onConfirm, onCancel }: EditNamePopupProps) {
  const [name, setName] = useState('')
  const nameRef = useRef(name)
  nameRef.current = name
  const handlersRef = useRef({ onConfirm, onCancel })
  handlersRef.current = { onConfirm, onCancel }
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 펼침을 건너뛴다
  const bandRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((bandRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  /**
   * 0x741a0 펼침 6 → 12 → 24 → 48 → 96 → 110 — 그동안 키 콜백 0x32b5d 도, 확인 · 취소를 보는 그리기 콜백 0x32b7d 도 안 불린다
   * (0x75556 · 0x7479c). 확인 · 취소는 0x74361(창, 0 / −1) 이 [창+9] = 0 으로 그 자리에서 치운다(닫힘 애니 없음 — `popupWindow`).
   */
  const motion = usePopupWindowMotion({ targetHeight: POPUP_HEIGHT, skipsMotion: hasNoLayout })
  const motionRef = useRef(motion)
  motionRef.current = motion

  useEffect(() => {
    // 창이 떠 있는 동안 키는 창 것이다 — 뒤의 엔트리 화면(window 리스너)이 숫자·* 키를 가로채지 않게 잡는 단계에서 멈춘다
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (!motionRef.current.acceptsKeys()) {
        event.preventDefault()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (nameRef.current.length > 0) motionRef.current.close('바로', () => handlersRef.current.onConfirm(nameRef.current))
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (nameRef.current.length === 0) return void motionRef.current.close('바로', () => handlersRef.current.onCancel())
        // 갱신의 키 콜백 0x32b5d 가 한 글자를 지운 뒤 같은 그림의 0x32b7c 가 [장면+0x40] = CLR 과 빈 버퍼를 보면 곧장 취소한다 (U-91)
        const next = [...nameRef.current].slice(0, -1).join('')
        nameRef.current = next
        setName(next)
        if (next.length === 0) motionRef.current.close('바로', () => handlersRef.current.onCancel())
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const isOpening = motion.openingHeight !== null
  // 터치 기기 — 창 그림에 소프트키 글자가 없어 OK(확정) · CLR(지우기, 비면 취소)을 상황 버튼으로 낸다(r186 — 늘 있던 확인 · 뒤로 버튼을
  // 걷었다). 버튼은 누르는 동안 초점을 안 빼앗아 키 사건이 입력칸으로 가고, 위 잡기 단계 듣는 곳이 받는다
  useTouchKeyOffer(isOpening ? null : EDIT_NAME_CONFIRM_OFFER)
  useTouchKeyOffer(isOpening ? null : EDIT_NAME_CLEAR_OFFER)
  // 펼치는 동안 칸은 visibility: hidden 이라 autoFocus 가 초점을 못 잡는다 — 다 펼쳐진 그 그림에 초점을 준다
  // (안 그러면 키보드 · 화면 자판 글자가 칸에 안 들어간다)
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isOpening) fieldRef.current?.focus()
  }, [isOpening])

  if (motion.isClosed) return null
  const bandHeight = motion.openingHeight ?? POPUP_HEIGHT

  return (
    <div className={styles.dim} role="dialog" aria-label="이름 입력">
      {/* 판 0x744c4 — y = (H − 그리는 높이) / 2 */}
      <div className={styles.band} ref={bandRef} style={{ top: (320 - bandHeight) >> 1, height: bandHeight }} />
      <div className={styles.prompt} style={{ left: PROMPT.x, top: PROMPT.y, width: PROMPT.width, visibility: isOpening ? 'hidden' : undefined }}>
        <MarkupText raw={NAME_PROMPT} />
      </div>
      <img alt="" data-testid="입력방식-왼쪽" src={INPUT_MODE_ARROWS.image}
        style={{ position: 'absolute', left: INPUT_MODE_ARROWS.leftX, top: INPUT_MODE_ARROWS.y, visibility: isOpening ? 'hidden' : undefined }} />
      <img alt="" data-testid="입력방식-오른쪽" src={INPUT_MODE_ARROWS.image}
        style={{ position: 'absolute', left: INPUT_MODE_ARROWS.rightX, top: INPUT_MODE_ARROWS.y, transform: 'scaleX(-1)', visibility: isOpening ? 'hidden' : undefined }} />
      <div className={styles.prompt} data-testid="입력방식" style={{ left: INPUT_MODE_MARK.x, top: INPUT_MODE_MARK.y, visibility: isOpening ? 'hidden' : undefined }}>
        <MarkupText raw={`!cFFFFFF${INPUT_MODE_MARK.label}`} />
      </div>
      <input ref={fieldRef} className={styles.field} aria-label="이름" value={name} autoFocus readOnly={isOpening}
        style={{ left: FIELD.x, top: FIELD.y, width: FIELD.width, height: FIELD.height, visibility: isOpening ? 'hidden' : undefined }}
        onChange={(event) => {
          // CP949 8 바이트까지 (입력기 최대 I+8 = min(8, 64), R11 1b — 한글 2 · 그 밖 1, 섞어 써도 된다)
          if (nameByteLengthOf(event.target.value) <= EDITED_NAME_BYTES) setName(event.target.value)
        }} />
    </div>
  )
}
