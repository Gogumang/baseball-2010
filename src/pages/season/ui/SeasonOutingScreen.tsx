import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_OUTING_ACTIVITIES, SEASON_OUTING_DESCRIPTIONS, SEASON_OUTING_PLACES,
  SEASON_OUTING_REQUIRED_POPULARITY, SEASON_OUTING_SUB_ITEMS, checkSeasonOuting,
} from '@/widgets/season/lib/seasonOuting'
import type { SeasonOutingPlace, SeasonOutingRefusal } from '@/widgets/season/lib/seasonOuting'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

/** 가드 거절 글 — 옆 번호가 원본 StrMODE id 다. [196]·[91] 은 P4 3절이 옮겨 적은 원문이다 */
const REFUSAL_TEXT: Readonly<Record<SeasonOutingRefusal, (required: number) => string>> = {
  인기도부족: (required) => `인기도가 부족합니다!N필요한 인기도 : ${required}`, // StrMODE[62]
  소지금부족: () => '소지금이 부족합니다', // StrMODE[77]
  질병없음: () => '건강한 상태입니다!N입원할 필요가 없습니다', // StrMODE[196]
  사기최고: () => '사기 최고 상태입니다', // StrMODE[91]
}

/**
 * 확인 팝업 id **0x16** — StrMODE[161] `"[%s] 이벤트를 진행하시겠습니까?"` 에
 * 비용이 있으면 [162] `"소지금 %s이 소모됩니다"` 가 붙는다 (P4 3절 확정).
 */
const CONFIRM_TEXT = (activity: string, cost: number): string =>
  `!C[${activity}] 이벤트를 진행하시겠습니까?` +
  (cost > 0 ? `!N!cFFFF00소지금 ${seasonMoneyTextOf(cost)}!cFFFFFF이 소모됩니다` : '')

export interface SeasonOutingScreenProps {
  readonly state: SeasonState
  /**
   * 외출 서브 아이템 보유 `SR+0x5d+p` 5칸 (StrITEM[220]~[224]).
   *
   * 모델의 `SeasonRecord.outingSubItems` 를 그대로 넘기면 된다. 안 넘기면 전부 없는 것으로 본다.
   * 값은 **가드에 쓰이지 않고**(아래 원본 버그) 설명 줄에만 나온다.
   */
  readonly outingSubItems?: readonly boolean[]
  /**
   * 장소를 골라 확인까지 마쳤다.
   *
   * 원본은 `0x4a94` 가 장소를 UI 에 넘기고 **0xe3 연출**(0x85074) → **결과 0xc81c**(굴림·적용·결과 창)
   * → 창을 닫으면 **SR+4 = 1**(행동함) → 관리 메뉴 0xc9 로 간다. 굴림에는 난수가 필요해
   * 이 화면에서 하지 않는다 — 표(`widgets/season/lib/seasonOuting.ts`)를 부르는 쪽이 쓴다.
   */
  readonly onRun: (place: SeasonOutingPlace, index: number) => void
  /** 취소(−16) — 관리 메뉴(0xc9)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 시즌 외출 화면 (장면 0x105 상태 **0xd1**, 갱신 0xbd24 · 키 **0xbf50** · 그리기 0xa04c).
 *
 * 장소 5곳(경기장·번화가·병원·학교·방송국)과 가드 `0xbd38` 는 P4 **3 절 확정**이다.
 * ⚠️ 나만의리그 외출(`pages/outing-map`, `shared/config/outingPlaces.ts`)과는 **값도 가드도 다르다** —
 * 배치 관례만 같은 집안이고 규칙은 하나도 같지 않다.
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본 0xa04c 는 나리와 **같은 지도 그림** `0x7ea64(gfx, 장소, 0)`
 * 를 그린다. 그 지도 그리기는 지금 `pages/outing-map` 안에만 있어(페이지끼리는 서로 못 쓴다)
 * 시즌에서는 쓸 수 없다 — 그래서 다른 시즌 화면들과 같은 공용 판 (24, 54, 192, 212) 목록으로
 * 근사했다. 지도 그리기를 위젯으로 옮기면 이 화면도 그대로 지도로 바꿀 수 있다.
 *
 * 외출 지도에서도 이벤트 폴링은 돌지만 **s_event 는 하나도 뜨지 않는다**(화면코드 209 를 받는
 * trigger 가 없다 — 무해한 원본 이상, `seasonEventFlow.ts` 의 `acceptsSeasonEvents`).
 */
export function SeasonOutingScreen({ state, outingSubItems = [], onRun, onBack }: SeasonOutingScreenProps) {
  const { record, teamMorale } = state
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<number | null>(null)

  const rows: readonly SeasonListRow[] = SEASON_OUTING_PLACES.map((place, index) => {
    const checked = checkSeasonOuting(record, teamMorale, index)
    return {
      id: place,
      label: `${place} [${SEASON_OUTING_ACTIVITIES[index]}]`,
      // 비용은 100만 원 단위다 (p1 400만 · p2 500만 · p4 1000만). 공짜 칸은 비워 둔다
      value: checked.cost > 0 ? seasonMoneyTextOf(checked.cost) : '',
    }
  })

  const select = (index: number) => {
    const checked = checkSeasonOuting(record, teamMorale, index)
    if (!checked.ok) {
      setNotice(REFUSAL_TEXT[checked.reason ?? '소지금부족'](checked.required ?? 0))
      return
    }
    setQuestion(index)
  }

  const { cursor, moveTo } = useSeasonCursor({
    count: rows.length,
    onSelect: select,
    onCancel: onBack,
    isEnabled: notice === null && question === null,
  })

  const required = SEASON_OUTING_REQUIRED_POPULARITY[cursor] ?? 0
  const hasSubItem = outingSubItems[cursor] === true
  const footer =
    `${SEASON_OUTING_DESCRIPTIONS[cursor]}` +
    (required > 0 ? `\n필요 인기도 : ${required}` : '') +
    // StrMODE[195] "효과" 줄 — 결과 창이 서브 아이템을 가졌을 때 덧붙이는 것과 같은 값이다
    (hasSubItem ? `\n효과 : ${SEASON_OUTING_SUB_ITEMS[cursor].text}` : '')

  return (
    <RawScreen>
      <SeasonListWindow
        title="외출"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onBack}
        footer={footer}
      />
      <SeasonStatusBar record={record} teamMorale={teamMorale} />

      {notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
      {notice === null && question !== null && (
        <MessageBox
          text={CONFIRM_TEXT(
            SEASON_OUTING_ACTIVITIES[question],
            checkSeasonOuting(record, teamMorale, question).cost,
          )}
          buttons={['예', '아니오']}
          onAnswer={(answer) => {
            const place = question
            setQuestion(null)
            if (answer === 0) onRun(SEASON_OUTING_PLACES[place], place)
          }}
        />
      )}
    </RawScreen>
  )
}
