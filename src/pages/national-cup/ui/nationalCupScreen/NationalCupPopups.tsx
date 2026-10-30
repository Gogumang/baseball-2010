import { TEAMS } from '@/shared/config/original/teams'
import { MessageBox } from '@/shared/ui'
import { nationalCupResultText, nationalCupRewardText } from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import type { EntryPopup } from '@/pages/national-cup/ui/nationalCupScreen/nationalCupEntry'

interface NationalCupPopupsProps {
  readonly entryPopup: EntryPopup | null
  readonly entryPopupIndex: number
  readonly onConfirmEntryTitle: (() => void) | undefined
  readonly onCloseEntryPopup: () => void
  readonly step: string
  /** 제 n 회 (`nationalCupEditionOf`) */
  readonly edition: number
  readonly finish: NationalCupFinish
  /** 우승국 팀 번호 */
  readonly champion: number
  readonly onCloseResult: () => void
  readonly onCloseReward: () => void
}

/** 진입 팝업(히든 팀 오픈 0x22 · 칭호 0x1274c) · 결과 팝업 · 보상 팝업 */
export function NationalCupPopups({
  entryPopup,
  entryPopupIndex,
  onConfirmEntryTitle,
  onCloseEntryPopup,
  step,
  edition,
  finish,
  champion,
  onCloseResult,
  onCloseReward,
}: NationalCupPopupsProps) {
  return (
    <>
      <EntryPopupView popup={entryPopup} index={entryPopupIndex} onConfirmTitle={onConfirmEntryTitle} onClose={onCloseEntryPopup} />

      {step === '결과' && (
        <MessageBox
          text={nationalCupResultText(edition, finish.isKoreaChampion, TEAMS[champion]?.name ?? '', finish.koreaInFinal)}
          buttons={['확인']}
          onAnswer={onCloseResult}
        />
      )}

      {step === '보상' && <MessageBox text={nationalCupRewardText(finish.reward)} buttons={['확인']} onAnswer={onCloseReward} />}
    </>
  )
}

/** 134 진입 팝업 — 히든 팀 오픈(0x22) · 칭호(0x1274c 창) */
function EntryPopupView({
  popup,
  index,
  onConfirmTitle,
  onClose,
}: {
  readonly popup: EntryPopup | null
  readonly index: number
  readonly onConfirmTitle: (() => void) | undefined
  readonly onClose: () => void
}) {
  if (popup?.kind === '히든팀') return <MessageBox text={popup.text} buttons={['확인']} onAnswer={onClose} />
  if (popup?.kind !== '칭호') return null
  // 칭호 팝업 확인 0x1b1e4 — 키를 받은 그 자리에서 비트 · 곧바로 장착(+0x1c4) · 저장 · 창을 바로 치운다(0x742a8, 닫힘 애니 없음)
  return <TitleWindow key={index} title={popup.title} onKey={onConfirmTitle} onClose={onClose} />
}
