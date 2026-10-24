import type { ReactNode } from 'react'
import { CommonPanel } from '@/shared/ui'
import {
  FOOTER_BOX, SEASON_WINDOW, TITLE_BOX, VISIBLE_ROWS, rowBoxOf,
} from '@/widgets/season/lib/seasonWindowLayout'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'

export interface SeasonListRow {
  readonly id: string
  readonly label: string
  /** 줄 오른쪽에 붙는 값 (가격·수치·상태) */
  readonly value?: string
  /** 고를 수 없는 줄 — 원본 관리 메뉴는 SR+4 가 서면 트레이닝·외출 칸을 끈다 (P4 3절) */
  readonly isDisabled?: boolean
}

export interface SeasonListWindowProps {
  /** 판 위 제목 줄 */
  readonly title: string
  readonly rows: readonly SeasonListRow[]
  readonly cursor: number
  readonly onMoveCursor: (index: number) => void
  readonly onSelect: (index: number) => void
  /** 판 아래 설명·알림 글 */
  readonly footer?: ReactNode
  /** 되돌아가기 — 원본 취소 키(−16) 와 같은 곳으로 간다 */
  readonly onBack?: () => void
  readonly backLabel?: string
  /**
   * 판 인자 — 안 주면 기본 판(24, 54, 192, 212). 주면 그 자리 · 위 띠 · 제목 탭으로 긋고, 판 위 제목 글은 밝은 띠 · 탭 위에서
   * 보이게 짙은 남색으로 둔다(웹 시험 전용 — 이 목록 창을 쓰는 원본 화면은 이제 없다. 아래 판 주석)
   */
  readonly panel?: SeasonListPanel
}

export interface SeasonListPanel {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly topBand?: number
  readonly titleTab?: boolean
}

/**
 * 시즌 화면들이 함께 쓰는 **공용 판 목록 창**.
 *
 * 판은 `0x55e61` 공용 판 (24, 54, 192, 212) 으로 **확정**이지만,
 * ⚠️ **줄 좌표·글 자리는 원본 배치 미해독 — 근사**다 (`seasonWindowLayout.ts` 머리 주석). 이 창은 이제 웹 시험 전용이라(아래 판 주석)
 * 앱 화면에는 안 나온다.
 * 줄 높이 18px 은 순위표(0x7f070)의 줄 간격을 그대로 따랐다.
 */
export function SeasonListWindow({
  title, rows, cursor, onMoveCursor, onSelect, footer, onBack, backLabel = '되돌아가기', panel,
}: SeasonListWindowProps) {
  // 판에 들어가는 줄 수를 넘으면 커서를 따라 굴린다 (원본 목록 객체도 ▲▼ 로 굴린다 — 근사)
  const rowCount = VISIBLE_ROWS
  const first = rows.length <= rowCount
    ? 0
    : Math.min(Math.max(0, cursor - rowCount + 1), rows.length - rowCount)
  const visible = rows.slice(first, first + rowCount)

  return (
    <div role="group" aria-label={title}>
      {/* 공용 판 0x55e61 — 웹 시험 전용: 이 목록 창은 이제 선수영입 0xe2 의 `renderCandidates` 없는 길(시험)만 쓰고 앱에는 안 나온다(r165).
          원본 화면마다의 그림은 각자 옮겼다(r89):
          · 0xe2 선수영입(0xa10c): 공용 목록 0x63b15 k 6 + 0x7f4ed — 앱은 명예의 전당 목록(`HallOfFameScreen`)을 꽂는다
          · 0xe4 트레이드 팀 고르기(0xa14c): 공용 목록 0x63b15 + 0x7f4ed — `TeamSelectScreen`
          · 0xe5 · 0xe6 트레이드 선수(0xb0f4 · 0xb0b4) · 0xe8 십전대보탕 투수 고르기(0xafd0): 엔트리 목록 창 0x5cfec — `EntryListWindow`
          · 0xe7 트레이드 확인(0xd4e8): mode_ui 프레임 70 · 71 판 — `TradeConfirmWindow`
          · 레벨업 창 0x5f394 의 0x55e60(…, 192, 212, 0, 0x22, 0, 0, 제목 탭 1, 어둡게 1) 은 `widgets/ace-level-up` 의 창이다 */}
      {panel === undefined
        ? <CommonPanel x={SEASON_WINDOW.x} y={SEASON_WINDOW.y} width={SEASON_WINDOW.width} height={SEASON_WINDOW.height} />
        : <CommonPanel x={panel.x} y={panel.y} width={panel.width} height={panel.height} topBand={panel.topBand ?? 0}
            titleTab={panel.titleTab === true} testId="시즌-목록-판" />}
      <div
        className={styles.title}
        style={{
          left: TITLE_BOX.x, top: TITLE_BOX.y, width: panel?.titleTab === true ? 80 : TITLE_BOX.width, height: TITLE_BOX.height,
          ...(panel === undefined ? {} : { color: '#10246B' }),
          ...(panel?.titleTab === true ? { textAlign: 'left' as const } : {}),
        }}
      >
        {title}
      </div>

      {visible.map((row, offset) => {
        const index = first + offset
        const box = rowBoxOf(offset)
        const isSelected = index === cursor
        return (
          <button
            key={row.id}
            type="button"
            className={`${styles.row}${isSelected ? ` ${styles.rowSelected}` : ''}`}
            aria-current={isSelected}
            disabled={row.isDisabled === true}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onClick={() => {
              onMoveCursor(index)
              onSelect(index)
            }}
          >
            <span className={styles.cursor} aria-hidden>{isSelected ? '▶' : ''}</span>
            <span className={styles.rowLabel}>{row.label}</span>
            {row.value !== undefined && <span className={styles.rowValue}>{row.value}</span>}
          </button>
        )
      })}

      {footer !== undefined && (
        <div
          className={styles.notice}
          style={{ left: FOOTER_BOX.x, top: FOOTER_BOX.y, width: FOOTER_BOX.width, height: FOOTER_BOX.height }}
        >
          {footer}
        </div>
      )}

      {onBack !== undefined && (
        <button
          type="button"
          className={styles.backButton}
          style={{ left: FOOTER_BOX.x + FOOTER_BOX.width - 62, top: SEASON_WINDOW.y + SEASON_WINDOW.height - 16 }}
          onClick={onBack}
        >
          {backLabel}
        </button>
      )}
    </div>
  )
}
