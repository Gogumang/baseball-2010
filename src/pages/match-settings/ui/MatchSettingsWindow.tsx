import { useEffect, useState } from 'react'
import { MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  CHANCE_VALUE_COUNT, DETAIL_ROW, DETAIL_ROW_COUNT, INNING_VALUE_COUNT, KIND_COUNT,
  SETTINGS_STAGE, answerMatchSettingsPopup, detailBitsOf, detailCellCountOf,
  openMatchSettings, pressMatchSettingsKey,
} from '@/pages/match-settings/lib/matchSettingsMenu'
import type {
  MatchSettingsAction, MatchSettingsKey, MatchSettingsWindowState,
} from '@/pages/match-settings/lib/matchSettingsMenu'
import {
  BACK_BUTTON, CHANCE_ROW, DESCRIPTION_BOX, DETAIL_CELL, DETAIL_LABEL, DETAIL_ROW_BOX, ROW,
  TITLE_BOX, WINDOW, chanceRowTopOf, detailCellLeftOf, detailRowTopOf, rowTopOf,
} from '@/pages/match-settings/lib/matchSettingsLayout'
import {
  CHANCE_DESCRIPTIONS, CONFIRM_BUTTONS, CONFIRM_TEXT, DETAIL_CONFIRM_LABEL,
  DETAIL_ROW_DESCRIPTIONS, DETAIL_ROW_LABELS, IMG_TEXT, INNING_DESCRIPTIONS,
  INNING_LABELS, INNING_LABEL_FRAMES, KIND_DESCRIPTIONS, KIND_LABELS, KIND_LABEL_FRAMES,
  NOTICE_BUTTONS, NO_DETAIL_TEXT,
} from '@/pages/match-settings/lib/matchSettingsText'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'

const imageSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

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
 * 경기정보 화면(메인 메뉴 상태 22 · 시즌 상태 0xdd)에서 '0' 으로 열고,
 * 시즌은 **한 번도 안 봤으면 경기 직전에 저절로 열린다**(R13 4절, 저장 +0x11e).
 *
 * 무엇을 고르면 경기에서 누가 치는지는 `features/play-team-game/model/matchSettings.ts` 가
 * 전부 가지고 있다. 이 창은 그 `MatchProgressSettings` 를 채워 `onConfirm` 으로 넘길 뿐이다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0x6042c 의 좌표가 문서에 없어 공용 판 (24, 54, 192, 212)에
 * 줄을 세웠다 (`matchSettingsLayout.ts`).
 *
 * 마우스: **칸을 누르면 그 칸으로 커서를 옮기고 OK 를 누른 것과 같다** (원본 키 두 번을 한 번에 —
 * 웹판 판단). 키보드는 원본 그대로 ↑↓←→ · Enter(OK) · Esc(CLR) 다.
 */
export function MatchSettingsWindow({ settings, onConfirm, onClose }: MatchSettingsWindowProps) {
  const [state, setState] = useState<MatchSettingsWindowState>(() => openMatchSettings(settings))

  const apply = (action: MatchSettingsAction) => {
    if (action.kind === '유지') return setState(action.state)
    if (action.kind === '닫기') return onClose()
    onConfirm(action.settings)
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

  const { kind } = state.settings
  const isKindStage = state.stage === SETTINGS_STAGE.종류

  return (
    <div role="group" aria-label="경기진행 설정">
      <div
        className={styles.window}
        style={{ left: WINDOW.x, top: WINDOW.y, width: WINDOW.width, height: WINDOW.height }}
      />

      {/* 단계 1 에서는 고른 종류 이름 그림이 판 위에 남는다 (근사) */}
      {!isKindStage && (
        <div
          className={styles.title}
          style={{ left: TITLE_BOX.x, top: TITLE_BOX.y, width: TITLE_BOX.width, height: TITLE_BOX.height }}
        >
          <img className={styles.labelImage} alt={KIND_LABELS[kind]} src={imageSrc(KIND_LABEL_FRAMES[kind] ?? 0)} />
        </div>
      )}

      {isKindStage && Array.from({ length: KIND_COUNT }, (_unused, index) => (
        <button
          key={KIND_LABELS[index]}
          type="button"
          aria-label={KIND_LABELS[index]}
          aria-current={index === kind}
          className={`${styles.row}${index === kind ? ` ${styles.rowSelected}` : ''}`}
          style={{ left: WINDOW.x + (WINDOW.width - ROW.width) / 2, top: rowTopOf(index), width: ROW.width, height: ROW.height }}
          onMouseEnter={() => setState({ ...state, settings: { ...state.settings, kind: index } })}
          onClick={() => pressAt({ ...state, settings: { ...state.settings, kind: index } })}
        >
          <img className={styles.labelImage} alt="" src={imageSrc(KIND_LABEL_FRAMES[index] ?? 0)} />
        </button>
      ))}

      {/*
        찬스 두 칸 — ⚠️ 찬스 값에는 **이름 그림이 없어서**(R4 표의 그림 칸이 비어 있다)
        설명 문구 자체를 줄에 그린다. 지어낸 이름을 붙이지 않으려는 것이다.
      */}
      {!isKindStage && kind === MATCH_SETTING_KIND.찬스
        && Array.from({ length: CHANCE_VALUE_COUNT }, (_unused, index) => {
          const box = {
            left: WINDOW.x + (WINDOW.width - CHANCE_ROW.width) / 2,
            top: chanceRowTopOf(index),
            width: CHANCE_ROW.width,
            height: CHANCE_ROW.height,
          }
          const raw = CHANCE_DESCRIPTIONS[index] ?? ''
          return (
            <div key={raw}>
              <div className={styles.chanceText} style={box}>
                <MarkupText raw={raw} />
              </div>
              <button
                type="button"
                aria-label={oneLineOf(raw)}
                aria-current={index === state.settings.value}
                className={`${styles.row}${index === state.settings.value ? ` ${styles.rowSelected}` : ''}`}
                style={box}
                onMouseEnter={() => setState({ ...state, settings: { ...state.settings, value: index } })}
                onClick={() => pressAt({ ...state, settings: { ...state.settings, value: index } })}
              />
            </div>
          )
        })}

      {!isKindStage && kind === MATCH_SETTING_KIND.이닝
        && Array.from({ length: INNING_VALUE_COUNT }, (_unused, index) => (
          <button
            key={INNING_LABELS[index]}
            type="button"
            aria-label={INNING_LABELS[index]}
            aria-current={index === state.settings.value}
            className={`${styles.row}${index === state.settings.value ? ` ${styles.rowSelected}` : ''}`}
            style={{ left: WINDOW.x + (WINDOW.width - ROW.width) / 2, top: rowTopOf(index), width: ROW.width, height: ROW.height }}
            onMouseEnter={() => setState({ ...state, settings: { ...state.settings, value: index } })}
            onClick={() => pressAt({ ...state, settings: { ...state.settings, value: index } })}
          >
            <img className={styles.labelImage} alt="" src={imageSrc(INNING_LABEL_FRAMES[index] ?? 0)} />
          </button>
        ))}

      {!isKindStage && kind === MATCH_SETTING_KIND.상세 && (
        <>
          {DETAIL_ROW_LABELS.map((label, row) => (
            <div key={label}>
              <div
                className={`${styles.detailLabel}${row === state.detailRow ? ` ${styles.detailLabelSelected}` : ''}`}
                style={{ left: DETAIL_LABEL.x, top: detailRowTopOf(row) + 3, width: DETAIL_LABEL.width }}
              >
                {label}
              </div>
              {Array.from({ length: detailCellCountOf(row) }, (_unused, cell) => {
                const isOn = ((detailBitsOf(state.settings, row) >> cell) & 1) !== 0
                const isFocused = row === state.detailRow && cell === state.detailCell
                return (
                  <button
                    key={cell}
                    type="button"
                    aria-label={`${label} ${cellLabelOf(row, cell)}`}
                    aria-pressed={isOn}
                    className={`${styles.cell}${isOn ? ` ${styles.cellOn}` : ''}${isFocused ? ` ${styles.cellFocused}` : ''}`}
                    style={{
                      left: detailCellLeftOf(cell),
                      top: detailRowTopOf(row),
                      width: DETAIL_CELL.size,
                      height: DETAIL_CELL.size,
                    }}
                    onMouseEnter={() => setState({ ...state, detailRow: row, detailCell: cell })}
                    onClick={() => pressAt({ ...state, detailRow: row, detailCell: cell })}
                  />
                )
              })}
            </div>
          ))}
          <button
            type="button"
            aria-label={DETAIL_CONFIRM_LABEL}
            aria-current={state.detailRow === DETAIL_ROW.확인}
            className={`${styles.row}${state.detailRow === DETAIL_ROW.확인 ? ` ${styles.rowSelected}` : ''}`}
            style={{
              left: DETAIL_LABEL.x,
              top: detailRowTopOf(DETAIL_ROW_COUNT - 1),
              width: ROW.width,
              height: DETAIL_ROW_BOX.height,
            }}
            onMouseEnter={() => setState({ ...state, detailRow: DETAIL_ROW.확인 })}
            onClick={() => pressAt({ ...state, detailRow: DETAIL_ROW.확인 })}
          >
            {DETAIL_CONFIRM_LABEL}
          </button>
        </>
      )}

      <div
        className={styles.description}
        style={{
          left: DESCRIPTION_BOX.x, top: DESCRIPTION_BOX.y,
          width: DESCRIPTION_BOX.width, height: DESCRIPTION_BOX.height,
        }}
      >
        <MarkupText raw={descriptionOf(state)} />
      </div>

      <button
        type="button"
        className={styles.backButton}
        style={{ left: BACK_BUTTON.x, top: BACK_BUTTON.y, width: BACK_BUTTON.width, height: BACK_BUTTON.height }}
        onClick={() => press('취소')}
      >
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

/** 판 아래 설명 — 지금 커서가 선 칸의 문구 */
function descriptionOf(state: MatchSettingsWindowState): string {
  const { kind, value } = state.settings
  if (state.stage === SETTINGS_STAGE.종류) return KIND_DESCRIPTIONS[kind] ?? ''
  if (kind === MATCH_SETTING_KIND.이닝) return INNING_DESCRIPTIONS[value] ?? ''
  // 찬스는 설명을 줄에 그대로 그리므로 아래에는 다시 쓰지 않는다
  if (kind === MATCH_SETTING_KIND.찬스) return ''
  return DETAIL_ROW_DESCRIPTIONS[state.detailRow] ?? ''
}

/** 여러 줄 문구를 한 줄로 — 그림 없는 찬스 칸의 이름(읽기 보조)으로 쓴다 */
function oneLineOf(raw: string): string {
  return stripGameMarkup(raw).split('\n').join(' ')
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
