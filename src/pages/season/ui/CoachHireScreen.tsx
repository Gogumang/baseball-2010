import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  COACH_COUNT, checkCoachHire, coachAceOf, coachEffectTextOf, coachFeeOf, coachNameOf,
  coachRequiredPopularityOf, hireCoach,
} from '@/entities/season-mode/model/seasonCoach'
import type { CoachHireRefusal } from '@/entities/season-mode/model/seasonCoach'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/** StrMODE — 코치채용 문구 (J 4-3 가드 순서와 같은 번호) */
const ALREADY_HIRED = ORIGINAL_MODE_TEXT[147] // "현재 채용중인 마선수입니다"
const NO_MONEY = ORIGINAL_MODE_TEXT[77] // "소지금이 부족합니다"
const NO_POPULARITY = ORIGINAL_MODE_TEXT[62] // "인기도가 부족합니다 / 필요한 인기도 : %d"
const HIRE_QUESTION = ORIGINAL_MODE_TEXT[146] // "[%s]선수를 코치로 채용하시겠습니까? 소지금 %s…"
const HIRE_DONE = ORIGINAL_MODE_TEXT[148] // "[%s]선수를 코치로 채용하였습니다"
const CONTRACT_LABEL = ORIGINAL_MODE_TEXT[159] // "계약금 : %s"
const REQUIRED_LABEL = ORIGINAL_MODE_TEXT[160] // "필요 인기도 : %d"

export interface CoachHireScreenProps {
  readonly state: SeasonState
  /** 머리띠 G포인트 — 코치채용은 G 를 쓰지 않는다(보여 주기만) */
  readonly gamePoints?: number
  /** 채용이 끝났다 — 소지금이 빠지고 SR+0x185 가 채워진 레코드. 저장은 부르는 쪽이 한다 */
  readonly onHire: (record: SeasonRecord) => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 코치채용 — 구단관리 하위 칸 3. 원본은 **선수단 화면 `0xd7`(그리기 0xaa24)** 을
 * `this+0x11c = 2` 로 띄운다 (P4 1b·1a 표 · R13 표). 채용은 `0xa248` 이다.
 *
 * 계약금 1억~3.5억 · 필요 인기도 0~1000 · 가드 순서는 `entities/season-mode/model/seasonCoach.ts`
 * 가 J 4-3 그대로 들고 있다. **코치는 한 명뿐이고 바꾸면 계약금을 새로 낸다(환불 없음).**
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xaa24(선수단 화면)의 좌표·엔트리 목록 창 모양을 확인하지
 * 못해 다른 시즌 화면들과 같은 공용 판 목록으로 그린다. 머리띠 제목도 코치·선수단 그림이
 * 따로 없어(`TITLE_IMAGES` 17칸) **시즌모드** 제목을 쓴다.
 */
export function CoachHireScreen({ state, gamePoints = 0, onHire, onBack }: CoachHireScreenProps) {
  const { record } = state
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly slot: number; readonly text: string } | null>(null)

  const rows: readonly SeasonListRow[] = Array.from({ length: COACH_COUNT }, (_unused, slot) => ({
    id: `코치${slot}`,
    label: `${coachNameOf(slot)}${record.coach === slot ? ' (채용중)' : ''}`,
    value: seasonMoneyTextOf(coachFeeOf(slot) ?? 0),
  }))

  const refusalTextOf = (reason: CoachHireRefusal, required: number): string => {
    if (reason === '이미채용') return ALREADY_HIRED
    if (reason === '소지금부족') return NO_MONEY
    if (reason === '인기도부족') return fillModeText(NO_POPULARITY, required)
    return ''
  }

  const select = (slot: number) => {
    // 가드 순서 ① 이미 이 코치 ② 소지금 ③ 인기도 — 원본 0xa79c 그대로
    const checked = checkCoachHire(record, record.popularity, slot)
    if (!checked.ok) {
      const text = refusalTextOf(checked.reason, checked.required ?? 0)
      if (text !== '') setNotice(text)
      return
    }
    setQuestion({
      slot,
      text: fillModeText(HIRE_QUESTION, coachNameOf(slot), seasonMoneyTextOf(checked.fee)),
    })
  }

  const hire = () => {
    if (question === null) return
    const { slot } = question
    setQuestion(null)
    onHire(hireCoach(record, slot))
    setNotice(fillModeText(HIRE_DONE, coachNameOf(slot)))
  }

  const { cursor, moveTo } = useSeasonCursor({
    count: rows.length,
    onSelect: select,
    onCancel: onBack,
    isEnabled: notice === null && question === null,
  })

  const ace = coachAceOf(cursor)

  return (
    <RawScreen>
      {ace !== null && (
        // 마선수 얼굴 — ace_icon 33×33 (공용 판 오른쪽 위 모서리, **근사**)
        <img
          alt={ace.name}
          src={ace.iconUrl}
          style={{ position: 'absolute', left: 180, top: 62 }}
        />
      )}
      <SeasonListWindow
        title="코치채용"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        // 두 줄까지만 쓴다 — 판 아래 띠가 두 줄치라 세 줄이면 상태바에 닿는다.
        // 계약금은 목록 각 줄에 이미 있으므로 효과와 필요 인기도만 아래에 적는다
        footer={[
          coachEffectTextOf(cursor),
          `${fillModeText(CONTRACT_LABEL, seasonMoneyTextOf(coachFeeOf(cursor) ?? 0))}   ${fillModeText(REQUIRED_LABEL, coachRequiredPopularityOf(cursor) ?? 0)}`,
        ].join('\n')}
      />
      <SeasonStatusBar record={record} teamMorale={state.teamMorale} />

      {question !== null && (
        <MessageBox
          text={question.text}
          buttons={['예', '아니오']}
          onAnswer={(answer) => (answer === 0 ? hire() : setQuestion(null))}
        />
      )}
      {notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}

      {/* 머리띠·바닥띠 — 같은 계열 화면이 다 달고 있다 (P6 1-1). 되돌아가기는 바닥띠 쪽 하나만 둔다 */}
      <ScreenFrame title="시즌모드" gamePoint={gamePoints} onBack={onBack} />
    </RawScreen>
  )
}
