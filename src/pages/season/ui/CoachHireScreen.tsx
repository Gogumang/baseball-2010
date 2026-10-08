import { useState } from 'react'
import { MessageBox } from '@/shared/ui'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { checkCoachHire, coachNameOf, hireCoach } from '@/entities/season-mode/model/seasonCoach'
import type { CoachHireRefusal } from '@/entities/season-mode/model/seasonCoach'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { AceSelectScreen } from '@/pages/general-mode'
import { ACE_PHASE } from '@/pages/general-mode/lib/generalModeSetup'

/** StrMODE — 코치채용 문구 (J 4-3 가드 순서와 같은 번호) */
const ALREADY_HIRED = ORIGINAL_MODE_TEXT[147] // "현재 채용중인 마선수입니다"
const NO_MONEY = ORIGINAL_MODE_TEXT[77] // "소지금이 부족합니다"
const NO_POPULARITY = ORIGINAL_MODE_TEXT[62] // "인기도가 부족합니다 / 필요한 인기도 : %d"
const HIRE_QUESTION = ORIGINAL_MODE_TEXT[146] // "[%s]선수를 코치로 채용하시겠습니까? 소지금 %s…"
const HIRE_DONE = ORIGINAL_MODE_TEXT[148] // "[%s]선수를 코치로 채용하였습니다"

export interface CoachHireScreenProps {
  readonly state: SeasonState
  /** 머리띠 G포인트 — 잠긴 칸 [43] 오픈은 이 G 로 산다 */
  readonly gamePoints?: number
  /** 전역 +0x30..0x34 — 열린 마투수 번호 0~4 (코치 칸 0~4) */
  readonly openedAcePitcherIds: readonly number[]
  /** 전역 +0x35..0x39 — 열린 마타자 번호 0~4 (코치 칸 5~9) */
  readonly openedAceBatterIds: readonly number[]
  /** 마선수 레벨 — 이름 막대 LV 표시 */
  readonly levels?: Readonly<Record<number, number>>
  /** [43] 팝업 0x1f 에 "예" 이고 G 가 넉넉할 때 — 받는 쪽이 G 를 빼고 오픈 플래그를 세워 저장한다 */
  readonly onOpenAce?: (cell: number) => void
  /** 채용이 끝났다 — 소지금이 빠지고 SR+0x185 가 채워진 레코드. 저장은 부르는 쪽이 한다 */
  readonly onHire: (record: SeasonRecord) => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 코치채용 — 구단관리 하위 칸 3. 원본은 **선수단 화면 `0xd7`(그리기 0xaa24)** 을
 * `this+0x11c = 2` 로 띄운다 (P4 1b·1a 표 · R13 표). 그림은 경기 전 마선수 고르기와 같은 공용 목록 k 2 라
 * `AceSelectScreen` 을 `mode="코치"` 로 쓴다. 칸 = 코치 칸(0~4 마투수 · 5~9 마타자).
 *
 * 키 0xa734~0xa8fe (직접 떴다):
 * ```
 * 전역 +0x30 + 칸 == 0 (안 열림)  칸 4·9 → StrCOMMON[42] 알림 · 그 밖 → [43] G 오픈 팝업 0x1f (`AceSelectScreen`)
 * 열린 칸                        ① SR+0x185 == 칸 → [147]  ② 소지금 < 값×10 → [77]  ③ 인기도 < 필요 → [62]
 *                                ④ [146] 예/아니오 팝업 0x15 → 예면 0xa248 채용 → [148]
 * ```
 * 계약금 1억~3.5억 · 필요 인기도 0~1000 · 가드 순서는 `entities/season-mode/model/seasonCoach.ts`.
 * **코치는 한 명뿐이고 바꾸면 계약금을 새로 낸다(환불 없음).**
 * 머리띠는 0xaa24 끝이 `[this+0x11c] == 2` 면 `0x54d95(skin, 4 "마선수선택", 5)` 다(0xad94~0xada0).
 */
export function CoachHireScreen({
  state, gamePoints = 0, openedAcePitcherIds, openedAceBatterIds, levels, onOpenAce, onHire, onBack,
}: CoachHireScreenProps) {
  const { record } = state
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly slot: number; readonly text: string } | null>(null)

  const refusalTextOf = (reason: CoachHireRefusal, required: number): string => {
    if (reason === '이미채용') return ALREADY_HIRED
    if (reason === '소지금부족') return NO_MONEY
    if (reason === '인기도부족') return fillModeText(NO_POPULARITY, required)
    return ''
  }

  /** 열린 칸에서 확인 — 가드 순서 ① 이미 이 코치 ② 소지금 ③ 인기도 (0xa79c 그대로) */
  const select = (slot: number) => {
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

  return (
    <AceSelectScreen
      mode="코치"
      phase={ACE_PHASE.마투수}
      openedAcePitcherIds={openedAcePitcherIds}
      openedAceBatterIds={openedAceBatterIds}
      {...(levels === undefined ? {} : { levels })}
      {...(onOpenAce === undefined ? {} : { onOpenAce })}
      gamePoint={gamePoints}
      onSelect={select}
      onCancel={onBack}
      // 공통 앞그림 0xb810 — 0xd7 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다
      underlay={<SkinBackdrop kind="공무늬" />}
      overlay={question !== null ? (
        <MessageBox
          text={question.text}
          buttons={['예', '아니오']}
          onAnswer={(answer) => (answer === 0 ? hire() : setQuestion(null))}
        />
      ) : notice !== null ? (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      ) : null}
    />
  )
}
