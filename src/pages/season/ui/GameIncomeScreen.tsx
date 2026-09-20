import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import {
  STORE_EXPIRED_USER_EVENT, STORE_INCOME_BONUS, settleGameIncome,
} from '@/entities/season-mode/model/seasonAttendance'
import type { AttendanceInput, IncomeSettlement } from '@/entities/season-mode/model/seasonAttendance'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { incomeTextOf, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'

export interface GameIncomeScreenProps {
  /** 경기가 끝난 직후의 레코드 (아직 수입을 더하기 전) */
  readonly record: SeasonRecord
  /** 팀 레코드 +2 — 아래 수치 줄에만 쓴다 */
  readonly teamMorale: number
  /** 내 순위·상대 순위 (0부터) — `0xb7aa1` */
  readonly input: AttendanceInput
  /**
   * 확인(−5) — 정산된 레코드를 넘긴다.
   * 원본은 그 뒤 포스트시즌이면 (경기수 0 ? 0xee : 0xef), 아니면 0xf1 로 간다 (그 사이에 이벤트 0xd3).
   */
  readonly onConfirm: (settlement: IncomeSettlement) => void
}

/**
 * 경기 뒤 관중·수입 정산 창 (장면 0x105 상태 **0xe9**, 갱신 `0xdea0`).
 * 계산은 `0xa34b8`, 표시 문구는 J 4-7 의 `"관중: N명"` · `"수입: X만"` · 구내매점 `"(+200)"` 이다.
 *
 * 규칙은 `entities/season-mode/model/seasonAttendance.ts` 가 전부 가진다 — 여기서는 부르고 보여 준다.
 * 같은 화면이 부르는 `0x8a6fc` 에서 **구내매점 카운터 SR+0x55 가 1 줄고**, 0 이 되는 경기의 끝에
 * StrUSER_EVT[113] 만료 안내가 붙는다 (R13 10절 확정).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xdea0 의 좌표가 안 풀려 공용 판 목록으로 그린다.
 */
export function GameIncomeScreen({ record, teamMorale, input, onConfirm }: GameIncomeScreenProps) {
  const settlement = settleGameIncome(record, input)
  const [isExpiredShown, setExpiredShown] = useState(false)

  const storeBonus = record.storeGames > 0 ? STORE_INCOME_BONUS : 0
  const rows: readonly SeasonListRow[] = [
    { id: '관중', label: '관중', value: `${settlement.attendance}명` },
    {
      id: '수입',
      label: '수입',
      // 구내매점(StrMODE[128] "1년간 경기 수입 +200만")이 붙으면 원본도 "(+200)" 을 덧붙인다
      value: `${incomeTextOf(settlement.income)}${storeBonus === 0 ? '' : ` (+${storeBonus * MILLION_TO_TEN_THOUSAND})`}`,
    },
    { id: '소지금', label: '소지금', value: seasonMoneyTextOf(settlement.record.money) },
  ]

  const confirm = () => {
    // 구내매점 기간이 이 경기로 끝났으면 만료 안내를 먼저 띄운다 (StrUSER_EVT[113])
    if (settlement.storeExpired && !isExpiredShown) {
      setExpiredShown(true)
      return
    }
    onConfirm(settlement)
  }

  const isNoticeOpen = settlement.storeExpired && isExpiredShown
  const { cursor, moveTo } = useSeasonCursor({
    count: rows.length,
    onSelect: confirm,
    onCancel: confirm,
    isEnabled: !isNoticeOpen,
  })

  return (
    <RawScreen>
      <SeasonListWindow
        title="경기 수입"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={confirm}
        onBack={confirm}
        backLabel="확인"
        footer={'관중이 많을수록 수입이 늘어난다'}
      />
      <SeasonStatusBar record={settlement.record} teamMorale={teamMorale} />

      {isNoticeOpen && (
        <MessageBox
          text={ORIGINAL_USER_EVENTS[STORE_EXPIRED_USER_EVENT] ?? ''}
          buttons={['확인']}
          onAnswer={() => onConfirm(settlement)}
        />
      )}
    </RawScreen>
  )
}
