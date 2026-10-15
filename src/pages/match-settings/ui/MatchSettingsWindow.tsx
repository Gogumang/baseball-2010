import { useEffect, useId, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CommonPanel, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { wrapHelpText } from '@/pages/help/lib/helpPages'
import { MATCH_SETTING_KIND, confirmedMatchSettings } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  CHANCE_VALUE_COUNT, DETAIL_ROW, INNING_VALUE_COUNT, KIND_COUNT,
  SETTINGS_STAGE, answerMatchSettingsPopup, detailBitsOf, detailCellCountOf,
  openMatchSettings, pressMatchSettingsKey,
} from '@/pages/match-settings/lib/matchSettingsMenu'
import type {
  MatchSettingsAction, MatchSettingsKey, MatchSettingsWindowState,
} from '@/pages/match-settings/lib/matchSettingsMenu'
import {
  BASE_LABEL_FRAME, CHANCE_SLOTS, CHANCE_SLOT_SIZE, DESCRIPTION_LINE_HEIGHT, DETAIL_ARROWS, DETAIL_CELL_SHAPES,
  DETAIL_DESCRIPTION, DETAIL_LABEL, DETAIL_LABEL_FRAMES, DETAIL_MARK, DETAIL_NUMBER, DETAIL_NUMBER_COLOR,
  DETAIL_OK, DETAIL_ROW_Y, DETAIL_WINDOW, IMG_TEXT_PALETTE, LIST_ROW, OUTLINE_COLOR, SMALL_DESCRIPTION,
  SMALL_WINDOW, TAB, TAB_LABEL_FRAMES, TITLE,
  backButtonOf, baseLabelPointOf, centeredLeftOf, detailCellBoxOf, detailCellOutlineOf, detailDigitWidthOf,
  detailDownArrowYOf, detailNumberCenterOf, detailUpArrowYOf, isSettingsBlinkOn, listCursorOf, listRowTopOf,
} from '@/pages/match-settings/lib/matchSettingsLayout'
import type { DescriptionLayout, RoundOutline, SettingsBox } from '@/pages/match-settings/lib/matchSettingsLayout'
import {
  CHANCE_DESCRIPTIONS, CHANCE_LABELS, CONFIRM_BUTTONS, CONFIRM_TEXT, DETAIL_CONFIRM_LABEL,
  DETAIL_ROW_DESCRIPTIONS, DETAIL_ROW_LABELS, IMG_TEXT, INNING_DESCRIPTIONS,
  INNING_LABELS, INNING_LABEL_FRAMES, KIND_DESCRIPTIONS, KIND_LABELS, KIND_LABEL_FRAMES,
  NOTICE_BUTTONS, NO_DETAIL_TEXT,
} from '@/pages/match-settings/lib/matchSettingsText'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'

const SLT_FRAMES = './sprites/slt_frame/frames'
const SLT_IMAGES = './sprites/slt_frame'
const POPUP_FRAMES = './sprites/popup/frames'
const NUM_IMAGES = './sprites/num'

const pngOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface MatchSettingsWindowProps {
  /** 저장 칸에서 읽어 온 지금 설정 (모드 칸 m 은 부르는 쪽이 고른다 — 일반 0 · 시즌 1 · 대전 2) */
  readonly settings: MatchProgressSettings
  /** 확인창에서 '예' — 저장 칸(+0x12c+m …)에 되쓰고 창을 닫는다 (0x60376) */
  readonly onConfirm: (settings: MatchProgressSettings) => void
  /** CLR — 아무것도 저장하지 않고 닫는다 (+0x2ba = 0) */
  readonly onClose: () => void
}

/**
 * **경기진행 설정 창** (원본 갱신 0x5fef4 · 키 **0x5ffcc** · 그리기 **0x6042c**).
 *
 * 일반모드 경기정보(메인 메뉴 상태 22)와 시즌 경기정보(상태 0xdd)가 **같은 함수**를 부른다 — 열기 0x5fef4(skin, 모드 칸)
 * 다음은 그리기·키가 모두 skin+0x2ba~ 칸만 본다. 그래서 웹도 이 창 하나를 둘이 같이 쓴다
 * (일반모드는 '0', 시즌은 '0' 과 처음 한 번 저절로 — R13 4절, 저장 +0x11e).
 *
 * 무엇을 고르면 경기에서 누가 치는지는 `features/play-team-game/model/matchSettings.ts` 가
 * 전부 가지고 있다. 이 창은 그 `MatchProgressSettings` 를 채워 `onConfirm` 으로 넘길 뿐이다.
 * 배치는 `matchSettingsLayout.ts` 머리말(0x6042c 를 떠서 옮긴 것) 그대로다.
 *
 * 마우스: **칸을 누르면 그 칸으로 커서를 옮기고 OK 를 누른 것과 같다** (원본 키 두 번을 한 번에 —
 * 웹판 판단). 키보드는 원본 그대로 ↑↓←→ · Enter(OK) · Esc(CLR) 다.
 */
export function MatchSettingsWindow({ settings, onConfirm, onClose }: MatchSettingsWindowProps) {
  const [state, setState] = useState<MatchSettingsWindowState>(() => openMatchSettings(settings))
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sltOrigins = useFrameOrigins(SLT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  // 그릴 때마다 [skin+0x40c] += 1 뒤 `% 8 ≤ 4` — 웹은 창을 연 뒤 갱신 수 + 1 (⚠️ 시작 값 미확인)
  const isBlinkOn = isSettingsBlinkOn(useUpdateCounter() + 1)
  const filterId = `palette-${useId().replace(/:/g, '')}`

  const apply = (action: MatchSettingsAction) => {
    if (action.kind === '유지') return setState(action.state)
    if (action.kind === '닫기') return onClose()
    // 0x603b0: 상세 비트는 종류가 상세(2)일 때만 저장 칸에 되쓴다 — 나머지는 창을 열 때의 저장 값 그대로
    onConfirm(confirmedMatchSettings(settings, action.settings))
  }
  const press = (key: MatchSettingsKey) => apply(pressMatchSettingsKey(state, key))
  /** 커서를 그 자리로 옮기고 OK — 마우스 한 번이 원본 키 두 번을 대신한다 */
  const pressAt = (moved: MatchSettingsWindowState) => apply(pressMatchSettingsKey(moved, '확인'))

  useEffect(() => {
    // 확인창이 떠 있는 동안 키는 MessageBox 것이다 (그쪽이 잡는 단계에서 막는다)
    if (state.popup !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const key = keyOf(event.key)
      if (key === null) return
      event.preventDefault()
      press(key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const { kind, value } = state.settings
  const isKindStage = state.stage === SETTINGS_STAGE.종류
  const isDetail = !isKindStage && kind === MATCH_SETTING_KIND.상세
  const board = isDetail ? DETAIL_WINDOW : SMALL_WINDOW
  const back = backButtonOf(board)

  /** img_text 프레임 — 팔레트는 흰 그림에 색 행렬을 씌운다 */
  const text = (frame: number, x: number, y: number, palette: number = IMG_TEXT_PALETTE.흰, key?: string) => (
    <OriginSprite key={key ?? `t${frame}-${x}-${y}`} folder={IMG_TEXT} frame={frame} origins={textOrigins} x={x} y={y}
      style={palette === IMG_TEXT_PALETTE.흰 ? undefined : { filter: `url(#${filterId}-p${palette})` }} />
  )
  /** 가운데 x 에 놓는 img_text — 원본 `cx − (w >> 1)` */
  const centeredText = (frame: number, centerX: number, y: number, palette: number = IMG_TEXT_PALETTE.흰) =>
    text(frame, centeredLeftOf(centerX, widthOf(textOrigins, frame)), y, palette)

  const title = centeredText(TITLE.frame, TITLE.centerX, isDetail ? TITLE.detailY : TITLE.smallY, IMG_TEXT_PALETTE.파랑)

  /** 꼬리 탭 — 이미지 40 좌우 뒤집기 + 종류 이름(팔레트 1) */
  const tab = (
    <>
      <img className={`${styles.layer} ${styles.mirrored}`} alt="" src={pngOf(SLT_IMAGES, TAB.image)}
        style={{ left: TAB.x, top: isDetail ? TAB.detailY : TAB.smallY }} />
      {text(TAB_LABEL_FRAMES[kind] ?? 0, TAB.labelX, isDetail ? TAB.detailLabelY : TAB.smallLabelY, IMG_TEXT_PALETTE.노랑)}
    </>
  )

  /** 종류 줄 · 이닝 값 줄 — slt_frame 프레임 15 위에 이름 그림, 깜빡이면 노랑 커서 */
  const listRows = (frames: readonly number[], labels: readonly string[], selected: number,
    moved: (index: number) => MatchSettingsWindowState) => (
    <>
      {frames.map((frame, index) => (
        <span key={`row-${frame}`}>
          <OriginSprite folder={SLT_FRAMES} frame={LIST_ROW.frame} origins={sltOrigins} x={LIST_ROW.x} y={listRowTopOf(index)} />
          {centeredText(frame, LIST_ROW.x + (LIST_ROW.width >> 1), listRowTopOf(index) + LIST_ROW.labelDy)}
          <button type="button" className={styles.hitArea} aria-label={labels[index]} aria-current={index === selected}
            data-frame={frame}
            style={{ left: LIST_ROW.x, top: listRowTopOf(index), width: LIST_ROW.width, height: LIST_ROW.height }}
            onMouseEnter={() => setState(moved(index))}
            onClick={() => pressAt(moved(index))} />
        </span>
      ))}
      {isBlinkOn && <Outline outline={listCursorOf(selected)} />}
    </>
  )

  const withKind = (index: number): MatchSettingsWindowState => ({ ...state, settings: { ...state.settings, kind: index } })
  const withValue = (index: number): MatchSettingsWindowState => ({ ...state, settings: { ...state.settings, value: index } })

  let body: ReactNode
  if (isKindStage) {
    body = listRows(KIND_LABEL_FRAMES.slice(0, KIND_COUNT), KIND_LABELS, kind, withKind)
  } else if (kind === MATCH_SETTING_KIND.찬스) {
    const selectedSlot = CHANCE_SLOTS[value]
    body = (
      <>
        {tab}
        {CHANCE_SLOTS.slice(0, CHANCE_VALUE_COUNT).map((slot, index) => (
          <span key={slot.frame}>
            <OriginSprite folder={POPUP_FRAMES} frame={slot.frame} origins={popupOrigins} x={slot.x} y={slot.y} />
            {text(slot.label, slot.labelX, slot.labelY)}
            <button type="button" className={styles.hitArea} aria-label={CHANCE_LABELS[index]}
              aria-current={index === value} data-frame={slot.frame}
              style={{ left: slot.x, top: slot.y, width: CHANCE_SLOT_SIZE, height: CHANCE_SLOT_SIZE }}
              onMouseEnter={() => setState(withValue(index))}
              onClick={() => pressAt(withValue(index))} />
          </span>
        ))}
        {isBlinkOn && selectedSlot !== undefined && (
          <OriginSprite folder={POPUP_FRAMES} frame={selectedSlot.selectedFrame} origins={popupOrigins}
            x={selectedSlot.x} y={selectedSlot.y} />
        )}
      </>
    )
  } else if (kind === MATCH_SETTING_KIND.이닝) {
    body = (
      <>
        {tab}
        {listRows(INNING_LABEL_FRAMES.slice(0, INNING_VALUE_COUNT), INNING_LABELS, value, withValue)}
      </>
    )
  } else {
    const bob = isBlinkOn ? DETAIL_ARROWS.bob : 0
    body = (
      <>
        {tab}
        <img className={styles.layer} alt="" src={pngOf(SLT_IMAGES, DETAIL_ARROWS.up)}
          style={{ left: DETAIL_ARROWS.x, top: detailUpArrowYOf(bob) }} />
        <img className={styles.layer} alt="" src={pngOf(SLT_IMAGES, DETAIL_ARROWS.down)}
          style={{ left: DETAIL_ARROWS.x, top: detailDownArrowYOf(bob) }} />
        {DETAIL_ROW_LABELS.map((label, row) => (
          <DetailRow key={label} row={row} label={label} state={state} isBlinkOn={isBlinkOn}
            text={text} sltOrigins={sltOrigins}
            onHover={(cell) => setState({ ...state, detailRow: row, detailCell: cell })}
            onPress={(cell) => pressAt({ ...state, detailRow: row, detailCell: cell })} />
        ))}
        <OriginSprite folder={POPUP_FRAMES} origins={popupOrigins}
          frame={state.detailRow === DETAIL_ROW.확인 ? DETAIL_OK.selectedFrame : DETAIL_OK.frame}
          x={DETAIL_OK.x} y={DETAIL_OK.y} />
        <button type="button" className={styles.hitArea} aria-label={DETAIL_CONFIRM_LABEL}
          aria-current={state.detailRow === DETAIL_ROW.확인}
          style={{ left: DETAIL_OK.x, top: DETAIL_OK.y, width: DETAIL_OK.width, height: DETAIL_OK.height }}
          onMouseEnter={() => setState({ ...state, detailRow: DETAIL_ROW.확인 })}
          onClick={() => pressAt({ ...state, detailRow: DETAIL_ROW.확인 })} />
      </>
    )
  }

  return (
    <div role="group" aria-label="경기진행 설정" data-stage={state.stage} data-kind={kind}>
      <PaletteFilters id={filterId} />
      {/* 공용 판 0x55e60(skin, W/2, H/2, 0xc0, h, 0, 정렬 0x22, 0, 0, 제목 탭 1, 어둡게 1) — 네 부르는 자리
          6051e · 607fa · 60b30(h 0xa0) · 60e94(h 0xd4) 를 직접 떴다(알파 · 띠 자리는 [sp+0x88] = r7 = 0, 604c8) */}
      <CommonPanel x={board.x} y={board.y} width={board.width} height={board.height} titleTab dim testId="경기설정-판" />
      {title}
      {body}
      <Description layout={isDetail ? DETAIL_DESCRIPTION : SMALL_DESCRIPTION} raw={descriptionOf(state)} />

      <button type="button" className={styles.backButton}
        style={{ left: back.x, top: back.y, width: back.width, height: back.height }}
        onClick={() => press('취소')}>
        되돌아가기
      </button>

      {state.popup === '확인' && (
        <MessageBox
          text={CONFIRM_TEXT}
          buttons={CONFIRM_BUTTONS}
          onAnswer={(index) => apply(answerMatchSettingsPopup(state, index === 0))}
        />
      )}
      {state.popup === '상세없음' && (
        <MessageBox
          text={NO_DETAIL_TEXT}
          buttons={NOTICE_BUTTONS}
          onAnswer={() => apply(answerMatchSettingsPopup(state, false))}
        />
      )}
    </div>
  )
}

interface DetailRowProps {
  readonly row: number
  readonly label: string
  readonly state: MatchSettingsWindowState
  readonly isBlinkOn: boolean
  readonly text: (frame: number, x: number, y: number, palette?: number, key?: string) => ReactNode
  readonly sltOrigins: FrameOrigins | null
  readonly onHover: (cell: number) => void
  readonly onPress: (cell: number) => void
}

/** 상세 한 줄 — 네모 · 이름 두 장 · 칸들 · 켜진 칸 하늘 테 · 깜빡이는 노랑 커서 (0x60fee~0x61ae0) */
function DetailRow({ row, label, state, isBlinkOn, text, sltOrigins, onHover, onPress }: DetailRowProps) {
  const rowY = DETAIL_ROW_Y[row] ?? 0
  const shape = DETAIL_CELL_SHAPES[row]
  const isCurrentRow = state.detailRow === row
  const bits = detailBitsOf(state.settings, row)
  const frames = DETAIL_LABEL_FRAMES[row] ?? []
  if (shape === undefined) return null
  return (
    <>
      <img className={styles.layer} alt="" src={pngOf(SLT_IMAGES, isCurrentRow ? DETAIL_MARK.current : DETAIL_MARK.other)}
        style={{ left: DETAIL_MARK.x, top: rowY + DETAIL_MARK.dy }} />
      {frames.map((frame, index) => text(frame, DETAIL_LABEL.x[index] ?? 0, rowY + DETAIL_LABEL.dy, IMG_TEXT_PALETTE.흰, `l${row}-${index}`))}
      {Array.from({ length: detailCellCountOf(row) }, (_unused, cell) => {
        const isOn = ((bits >> cell) & 1) !== 0
        const box = detailCellBoxOf(row, cell)
        const center = detailNumberCenterOf(row, cell)
        const base = baseLabelPointOf(row, cell)
        const isCursor = isCurrentRow && cell === state.detailCell
        return (
          <span key={cell}>
            <OriginSprite folder={SLT_FRAMES} frame={isOn ? shape.onFrame : shape.offFrame} origins={sltOrigins}
              x={box.x} y={box.y} />
            <TintedDigit digit={cell + 1} centerX={center.x} centerY={center.y}
              color={isOn ? DETAIL_NUMBER_COLOR.on : DETAIL_NUMBER_COLOR.off} />
            {shape.hasBaseLabel
              && text(BASE_LABEL_FRAME, base.x, base.y, isOn ? IMG_TEXT_PALETTE.흰 : IMG_TEXT_PALETTE.회색, `b${row}-${cell}`)}
            {/* 61158: 켜진 칸은 하늘 테 — 지금 줄의 지금 칸만 건너뛴다(그 칸은 노랑 커서 자리) */}
            {isOn && !isCursor && <Outline outline={detailCellOutlineOf(row, cell, OUTLINE_COLOR.켜짐)} />}
            <button type="button" className={styles.hitArea} aria-label={`${label} ${cellLabelOf(row, cell)}`}
              aria-pressed={isOn} data-frame={isOn ? shape.onFrame : shape.offFrame}
              style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
              onMouseEnter={() => onHover(cell)}
              onClick={() => onPress(cell)} />
          </span>
        )
      })}
      {isCurrentRow && isBlinkOn && state.detailCell < detailCellCountOf(row) && (
        <Outline outline={detailCellOutlineOf(row, state.detailCell, OUTLINE_COLOR.커서)} />
      )}
    </>
  )
}

/** 합성 프레임 한 장 — 원점(origins)만큼 옮겨 놓는다. 원점을 아직 못 읽었으면 그리지 않는다 */
function OriginSprite({ folder, frame, origins, x, y, style }: {
  readonly folder: string
  readonly frame: number
  readonly origins: FrameOrigins | null
  readonly x: number
  readonly y: number
  readonly style?: CSSProperties
}) {
  const origin = origins?.[String(frame).padStart(3, '0')]
  if (origin === undefined) return null
  return (
    <img className={styles.layer} alt="" data-frame={frame} src={pngOf(folder, frame)}
      style={{ left: x + origin.x, top: y + origin.y, ...style }} />
  )
}

const widthOf = (origins: FrameOrigins | null, frame: number): number =>
  origins?.[String(frame).padStart(3, '0')]?.width ?? 0

/** 0x585ac 한 자리 — 정렬 0x22(가운데 · 가운데)이고 효과 0xb 로 한 색만 칠한다 */
function TintedDigit({ digit, centerX, centerY, color }: {
  readonly digit: number
  readonly centerX: number
  readonly centerY: number
  readonly color: string
}) {
  const width = detailDigitWidthOf(digit)
  const image = `url(${pngOf(NUM_IMAGES, DETAIL_NUMBER.base + digit)})`
  return (
    <span className={styles.tintedDigit} data-digit={digit} data-color={color} style={{
      left: centerX - (width >> 1),
      top: centerY - (DETAIL_NUMBER.height >> 1),
      width,
      height: DETAIL_NUMBER.height,
      background: solidColorCss(color),
      maskImage: image,
      WebkitMaskImage: image,
    }} />
  )
}

/** 둥근 테 0x6aa64(둥글기 1) — (x+1..R−1, y) · (x+1..R−1, B) · (x, y+1..B−1) · (R, y+1..B−1), R = x + w · B = y + h */
function Outline({ outline }: { readonly outline: RoundOutline }) {
  const { x, y, width, height, color } = outline
  const lines: readonly SettingsBox[] = [
    { x: x + 1, y, width: width - 1, height: 1 },
    { x: x + 1, y: y + height, width: width - 1, height: 1 },
    { x, y: y + 1, width: 1, height: height - 1 },
    { x: x + width, y: y + 1, width: 1, height: height - 1 },
  ]
  return (
    <span data-outline={color} data-x={x} data-y={y}>
      {lines.map((line, index) => (
        <span key={index} className={styles.outlineLine}
          style={{ left: line.x, top: line.y, width: line.width, height: line.height, background: color }} />
      ))}
    </span>
  )
}

/** 설명 칸 0xbb28c + 글 0xba268 — 글은 0x6ef4c 줄 나누기(`wrapHelpText`, 같은 앱 전역 글꼴)로 편다 */
function Description({ layout, raw }: { readonly layout: DescriptionLayout; readonly raw: string }) {
  const lines = raw === '' ? [] : wrapHelpText(raw, layout.text.width)
  return (
    <>
      <div className={styles.descriptionBox}
        style={{ left: layout.box.x, top: layout.box.y, width: layout.box.width, height: layout.box.height }} />
      {lines.map((line, index) => (
        <div key={index} className={styles.descriptionLine} style={{
          left: layout.text.x,
          top: layout.text.y + index * DESCRIPTION_LINE_HEIGHT,
          width: layout.text.width,
          textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
        }}>
          {line.segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
        </div>
      ))}
    </>
  )
}

/**
 * img_text 팔레트(img_text.mpl) — 흰 글자 그림(#FFFFFF · #EFEFEF)을 1차식으로 바꿔 칠한다
 * (`widgets/scoreboard-frame` 의 팔레트 4 와 같은 방법). 255 → 첫 색 · 239 → 둘째 색.
 */
function PaletteFilters({ id }: { readonly id: string }) {
  return (
    <svg className={styles.hiddenSvg} aria-hidden>
      {/* 팔레트 1 — #FFE352 · #FFB229 */}
      <filter id={`${id}-p1`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 3.0625 0 0 -2.172304  0 0 2.5625 0 -2.240931  0 0 0 1 0" />
      </filter>
      {/* 팔레트 3 — #2949A5 · #10246B */}
      <filter id={`${id}-p3`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1.5625 0 0 0 -1.401716  0 2.3125 0 0 -2.026225  0 0 3.625 0 -2.977941  0 0 0 1 0" />
      </filter>
      {/* 팔레트 4 — #7B797B · #525152 */}
      <filter id={`${id}-p4`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="2.5625 0 0 0 -2.08015  0 2.5 0 0 -2.02549  0 0 2.5625 0 -2.08015  0 0 0 1 0" />
      </filter>
    </svg>
  )
}

/**
 * 경기진행 설정 창을 화면 한 장으로 띄운다.
 * 원본은 경기정보 화면 위에 덮는 창이라, 경기정보를 함께 그릴 때는 `MatchSettingsWindow` 를 직접 쓴다.
 */
export function MatchSettingsScreen(props: MatchSettingsWindowProps) {
  return (
    <RawScreen>
      <MatchSettingsWindow {...props} />
    </RawScreen>
  )
}

/** 상세 칸 이름 — 타순 1~9번 · 1~8회와 9회 이후 전부 · 1·2·3루 (R4 4절) */
export function cellLabelOf(row: number, cell: number): string {
  if (row === DETAIL_ROW.타자조작) return `${cell + 1}번`
  // 칸 8 은 9회 하나가 아니라 **9회 이후 전부**(연장 포함)다
  if (row === DETAIL_ROW.투수조작) return cell < 8 ? `${cell + 1}회` : '9회~'
  return `${cell + 1}루`
}

/**
 * 설명 칸의 글 — 종류 0xd1c7c[종류] · 찬스 0xd1c88[값] · 이닝 0xd1c9c[값] · 상세 StrMAINMENU[121 + 줄].
 * 상세의 확인 줄(4)은 글을 안 그린다(61b18 `cmp 줄,#4 · beq`).
 */
export function descriptionOf(state: MatchSettingsWindowState): string {
  const { kind, value } = state.settings
  if (state.stage === SETTINGS_STAGE.종류) return KIND_DESCRIPTIONS[kind] ?? ''
  if (kind === MATCH_SETTING_KIND.찬스) return CHANCE_DESCRIPTIONS[value] ?? ''
  if (kind === MATCH_SETTING_KIND.이닝) return INNING_DESCRIPTIONS[value] ?? ''
  return DETAIL_ROW_DESCRIPTIONS[state.detailRow] ?? ''
}

/** 키보드 → 원본 키 */
function keyOf(key: string): MatchSettingsKey | null {
  if (key === 'ArrowUp') return '위'
  if (key === 'ArrowDown') return '아래'
  if (key === 'ArrowLeft') return '왼쪽'
  if (key === 'ArrowRight') return '오른쪽'
  if (key === 'Enter' || key === ' ') return '확인'
  if (key === 'Escape' || key === 'Backspace') return '취소'
  return null
}
