import type { ReactNode } from 'react'
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
}

/**
 * 시즌 화면들이 함께 쓰는 **공용 판 목록 창**.
 *
 * 판은 `0x55e61` 공용 판 (24, 54, 192, 212) 으로 **확정**이지만,
 * ⚠️ **줄 좌표·글 자리는 원본 배치 미해독 — 근사**다 (`seasonWindowLayout.ts` 머리 주석).
 * 줄 높이 18px 은 순위표(0x7f070)의 줄 간격을 그대로 따랐다.
 */
export function SeasonListWindow({
  title, rows, cursor, onMoveCursor, onSelect, footer, onBack, backLabel = '되돌아가기',
}: SeasonListWindowProps) {
  // 판에 들어가는 줄 수를 넘으면 커서를 따라 굴린다 (원본 목록 객체도 ▲▼ 로 굴린다 — 근사)
  const rowCount = VISIBLE_ROWS
  const first = rows.length <= rowCount
    ? 0
    : Math.min(Math.max(0, cursor - rowCount + 1), rows.length - rowCount)
  const visible = rows.slice(first, first + rowCount)

  return (
    <div role="group" aria-label={title}>
      <div
        className={styles.window}
        style={{
          left: SEASON_WINDOW.x, top: SEASON_WINDOW.y,
          width: SEASON_WINDOW.width, height: SEASON_WINDOW.height,
        }}
      />
      <div
        className={styles.title}
        style={{ left: TITLE_BOX.x, top: TITLE_BOX.y, width: TITLE_BOX.width, height: TITLE_BOX.height }}
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
            onMouseEnter={() => onMoveCursor(index)}
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
