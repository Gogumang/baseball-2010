import { STATUS_LABELS } from '@/shared/config/original/modeMenus'
import { SEASON_WINDOW, STATUS_BAR_Y, TEXT } from '@/widgets/season/lib/seasonWindowLayout'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'

/**
 * 관리 메뉴에 함께 나오는 구단 수치 줄 — 인기도 · 평판 · 사기 · 소지금.
 *
 * 이름은 원본 StrMODE 목록(`modeMenus.STATUS_LABELS` 0~3)을 그대로 쓴다.
 * 값의 뜻은 StrHOWTO[19] "관리 메뉴 수치" 설명과 같다 (사기 = 팀 레코드 +2, 나머지는 SR).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 관리 메뉴 그리기(0x73b8)의 좌표가 안 풀려서
 * 공용 판 바로 아래 한 줄로 놓았다. 수치와 이름만 원본 것이다.
 */
export interface SeasonStatusBarProps {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 (0~100) — SR 이 아니다 (P4 1a) */
  readonly teamMorale: number
}

const [POPULARITY, REPUTATION, MORALE, MONEY] = STATUS_LABELS

/** 판 아래 한 줄 (**근사**) */
const BAR = { x: SEASON_WINDOW.x, y: STATUS_BAR_Y, width: SEASON_WINDOW.width } as const

export function SeasonStatusBar({ record, teamMorale }: SeasonStatusBarProps) {
  const entries: readonly (readonly [string, string])[] = [
    [POPULARITY, String(record.popularity)],
    [REPUTATION, String(record.reputation)],
    [MORALE, String(teamMorale)],
    [MONEY, seasonMoneyTextOf(record.money)],
  ]

  return (
    <div role="group" aria-label="구단 상태">
      {entries.map(([label, value], index) => (
        <div
          key={label}
          className={styles.notice}
          style={{
            left: BAR.x + Math.trunc((BAR.width / entries.length) * index),
            top: BAR.y,
            width: Math.trunc(BAR.width / entries.length),
            lineHeight: `${TEXT.smallLineHeight}px`,
          }}
        >
          {`${label}\n${value}`}
        </div>
      ))}
    </div>
  )
}
