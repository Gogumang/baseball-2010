import { useEffect, useRef, useState } from 'react'
import { MessageBox } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCH_TRAINING_TEXT, pitchTrainingGateOf } from '@/entities/pitcher-career/model/pitchTraining'
import { PITCH_TRAINING_START, pitchTrainingKeyOf, pitchTrainingKeyOutcomeOf } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import type { PitchTrainingCursor } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { PitchWindowFigure } from '@/pages/pitcher-league/ui/PitchWindowFigure'

interface PitchTrainingScreenProps {
  readonly career: PitcherCareer
  /** [66] [예] — 125 로 가서 그 칸을 한 번 훈련한다 (`usePitcherManagementMenu.trainPitch`) */
  readonly onTrain: (row: number, column: number) => void
  /** 취소 → 107 (0x17828 17a76) */
  readonly onClose: () => void
}

/** 0x17a06~0x17a46 의 팝업 — [67] · [68] 은 알림(0x702b5 → 0x178cc), [65] (2,2) · [66] (2,3) 은 예/아니오 */
type Popup =
  | { readonly kind: '알림'; readonly text: string }
  | { readonly kind: 'G부족' }
  | { readonly kind: '확인'; readonly row: number; readonly column: number; readonly cost: number }

/**
 * **구질 훈련 창** — 나리 108 탭 2. 관리 화면(0x19da4) 위에 창 0x803d4 를 그린다 — 그림은 `PitchWindowFigure`(123 탭 2 와 같다),
 * 배치 · 키는 `lib/pitchTrainingWindow` 머리글(직접 떴다). 웹 단추 대신 탭 · 칸 자리에 투명 누름 칸(`PressArea`)을 둔다.
 */
export function PitchTrainingScreen({ career, onTrain, onClose }: PitchTrainingScreenProps) {
  const [cursor, setCursor] = useState<PitchTrainingCursor>(PITCH_TRAINING_START)
  const [popup, setPopup] = useState<Popup | null>(null)
  /** 0x17912~0x17a46 칸 가드 */
  const confirm = (row: number, column: number) => {
    const gate = pitchTrainingGateOf(career, row, column)
    if (gate.kind === '무시') return
    if (gate.kind === '막힘') {
      if (gate.textIndex === PITCH_TRAINING_TEXT.notEnoughPoints) return setPopup({ kind: 'G부족' })
      return setPopup({ kind: '알림', text: ORIGINAL_MODE_TEXT[gate.textIndex] ?? '' })
    }
    setPopup({ kind: '확인', row, column, cost: gate.cost })
  }

  const latest = useRef({ cursor, popup, confirm, onClose })
  latest.current = { cursor, popup, confirm, onClose }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const held = latest.current
      // 팝업이 떠 있으면 MessageBox 가 키를 가져간다
      if (held.popup !== null) return
      const key = pitchTrainingKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const outcome = pitchTrainingKeyOutcomeOf(held.cursor, key)
      if (outcome.kind === 'close') return held.onClose()
      if (outcome.kind === 'confirm') return held.confirm(outcome.row, outcome.column)
      setCursor(outcome.cursor)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div data-testid="구질훈련-창">
      <PitchWindowFigure
        career={career}
        cursor={cursor}
        state="훈련"
        onPressTab={(tab) => setCursor({ ...cursor, tab, isCellFocus: false })}
        onPressCell={(cellColumn) => {
          setCursor({ ...cursor, isCellFocus: true, cell: cellColumn })
          confirm(cursor.tab, cellColumn)
        }}
      />

      {popup?.kind === '알림' && <MessageBox text={popup.text} buttons={['확인']} onAnswer={() => setPopup(null)} />}
      {popup?.kind === 'G부족' && (
        <MessageBox
          text={ORIGINAL_MODE_TEXT[PITCH_TRAINING_TEXT.notEnoughPoints] ?? ''}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            setPopup(null)
            // 예 → 139 G 충전(틀 0x106bc) — 웹에 결제가 없어 충전 없이 떠난 길만 옮긴다: 108 진입 0x17730 이 다시 돌아 커서가 처음으로.
            // ⚠️ 139 화면은 옮기지 않았다
            if (index === 0) setCursor(PITCH_TRAINING_START)
          }}
        />
      )}
      {popup?.kind === '확인' && (
        <MessageBox
          text={(ORIGINAL_MODE_TEXT[PITCH_TRAINING_TEXT.confirm] ?? '').replace('%d', String(popup.cost))}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            const chosen = popup
            setPopup(null)
            if (index === 0) onTrain(chosen.row, chosen.column)
          }}
        />
      )}
    </div>
  )
}
