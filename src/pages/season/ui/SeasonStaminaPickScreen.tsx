import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SHOP_TEXT, seasonShopTextOf } from '@/entities/season-mode/model/seasonItemShop'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

const STAMINA_PER_PERCENT = 100

export interface SeasonStaminaPitcher {
  readonly name: string
  /** +0x2c — 10000 = 100% */
  readonly stamina: number
}

export interface SeasonStaminaPickScreenProps {
  readonly state: SeasonState
  /** 0x1f9a9 — 내 팀 투수 (레코드 차례) */
  readonly pitchers: readonly SeasonStaminaPitcher[]
  /** 키 0x7c00 확인 — 글과 회복했는가(결과 0x1d) */
  readonly onPick: (recordIndex: number) => { readonly notice: string; readonly recovered: boolean }
  /** 0x7c00 취소(−16) → 0xdc · 결과 0x1d(0x6f8c) → 0xdc */
  readonly onBack: () => void
}

/**
 * **십전대보탕 투수 고르기 — 상태 0xe8** (들어옴 0x5870 · 키 0x7c00 · 팝업 결과 0x6f8c). GP 상점 칸 3 의 "예" 로 온다.
 *
 * ```
 * 0x5870  투수 목록 0x1f9a9(app, [this+0x15c], 내 팀) → 목록 창 · StrMODE[177] 1버튼 팝업
 * 0x7c00  확인(−5 · '5'): 고른 칸 +0x2c == 10000 → StrMODE[211] (결과 1)
 *                         아니면 G −= 0xcbbe3[3] × 100 (0..99999) · 0x22c29(3, 값) · 0x22e35(2, 3) ·
 *                         +0x2c = 10000 · 저장 · StrMODE[178] (결과 0x1d)
 *         취소(−16) → 0xdc
 * 0x6f8c  결과 0x1d → 0xdc (0x5f3c 가 이전 상태 0xe8 을 보고 GP 커서를 칸 3 으로)
 * ```
 * ⚠️ 근사: 목록 창(0x5cfec + 0x54d94)의 열·배치는 안 풀었다 — 공용 목록 창에 이름과 스태미나 %를 적는다.
 */
export function SeasonStaminaPickScreen({ state, pitchers, onPick, onBack }: SeasonStaminaPickScreenProps) {
  const [notice, setNotice] = useState<{ readonly text: string; readonly leave: boolean } | null>(
    { text: seasonShopTextOf(SEASON_SHOP_TEXT.스태미나선택), leave: false },
  )
  const rows: readonly SeasonListRow[] = pitchers.map((pitcher, index) => ({
    id: `${index}`,
    label: pitcher.name,
    value: `${Math.trunc(pitcher.stamina / STAMINA_PER_PERCENT)}%`,
  }))
  const select = (index: number) => {
    const result = onPick(index)
    if (result.notice !== '') setNotice({ text: result.notice, leave: result.recovered })
  }
  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: select, onCancel: onBack, isEnabled: notice === null })

  return (
    <RawScreen>
      <SeasonListWindow title="투수" rows={rows} cursor={cursor} onMoveCursor={moveTo} onSelect={select} onBack={onBack} />
      <SeasonStatusBar record={state.record} teamMorale={state.teamMorale} />
      {notice !== null && (
        <MessageBox text={notice.text} buttons={['OK']} onAnswer={() => {
          setNotice(null)
          if (notice.leave) onBack()
        }} />
      )}
    </RawScreen>
  )
}
