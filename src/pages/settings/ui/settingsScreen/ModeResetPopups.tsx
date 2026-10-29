import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { MessageBox } from '@/shared/ui'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import { MODE_RESET_TEXT } from '@/entities/settings/model/modeReset'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'
import {
  CAREER_CHOOSE_BUTTONS,
  CAREER_CHOOSE_CANCEL,
  CAREER_CHOOSE_FRAMES,
  CAREER_CHOOSE_GRID,
  CONFIRM_FIRST_CURSOR,
} from '@/pages/settings/ui/settingsScreen/modeResetChoices'
import type { ModeResetPopup } from '@/pages/settings/ui/settingsScreen/modeResetChoices'

interface ModeResetPopupsProps {
  readonly popup: ModeResetPopup | null
  readonly onResetCareer: (edition: CareerResetEdition) => void
  readonly onResetEditedNames: () => void
  readonly onResetSeason: (() => void) | undefined
  /** 하위 1 — 고르기 창 답 */
  readonly onCareerChoose: (answer: number) => void
  /** 확인 창 답 — 예(0)면 `reset` 뒤 완료 알림 */
  readonly answerConfirm: (reset: () => void) => (answer: number) => void
  readonly onClose: () => void
}

type PopupOf<K extends ModeResetPopup['kind']> = (popup: Extract<ModeResetPopup, { kind: K }>, props: ModeResetPopupsProps) => ReactNode

/** 확인 창 — 처음 커서는 "아니오" */
const confirmBox = (text: string, onAnswer: (answer: number) => void) => (
  <MessageBox text={text} buttons={['예', '아니오']} initialSelected={CONFIRM_FIRST_CURSOR} onAnswer={onAnswer} />
)

/** 창 종류 → 그림 (하위 상태 1~4 의 고르기 · 막힘 · 확인 · 완료) */
const POPUP_OF: { readonly [K in ModeResetPopup['kind']]: PopupOf<K> } = {
  나리고르기: (_popup, { onCareerChoose }) => (
    <MessageBox
      text={MODE_RESET_TEXT.careerChoose}
      buttons={CAREER_CHOOSE_BUTTONS}
      buttonFrames={CAREER_CHOOSE_FRAMES}
      grid={CAREER_CHOOSE_GRID}
      cancelAnswer={CAREER_CHOOSE_CANCEL}
      onAnswer={onCareerChoose}
    />
  ),
  나리막힘: (popup, { onClose }) => <MessageBox text={popup.text} buttons={['확인']} onAnswer={onClose} />,
  나리확인: (popup, { answerConfirm, onResetCareer }) =>
    confirmBox(
      popup.edition === '타자편' ? MODE_RESET_TEXT.careerBatterConfirm : MODE_RESET_TEXT.careerPitcherConfirm,
      answerConfirm(() => onResetCareer(popup.edition)),
    ),
  시즌확인: (_popup, { answerConfirm, onResetSeason }) =>
    onResetSeason === undefined ? null : confirmBox(SETTINGS_TEXT.seasonResetConfirm, answerConfirm(onResetSeason)),
  에디트확인: (_popup, { answerConfirm, onResetEditedNames }) => confirmBox(SETTINGS_TEXT.editResetConfirm, answerConfirm(onResetEditedNames)),
  완료: (_popup, { onClose }) => <MessageBox text={SETTINGS_TEXT.resetDone} buttons={['확인']} onAnswer={onClose} />,
}

/** 모드 초기화 창 — 없으면 아무것도 */
export function ModeResetPopups(props: ModeResetPopupsProps) {
  const { popup } = props
  if (popup === null) return null
  // 종류마다 따로 선 창이다 — 종류가 바뀌면 새 창(옛 그림의 갈래별 자리와 같다)
  return <Fragment key={popup.kind}>{(POPUP_OF[popup.kind] as PopupOf<typeof popup.kind>)(popup as never, props)}</Fragment>
}
