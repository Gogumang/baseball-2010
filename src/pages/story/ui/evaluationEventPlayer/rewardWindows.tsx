import { MessageBox } from '@/shared/ui'
import type { RewardNotice } from '@/entities/story/model/rewardNotice'
import { RewardSkillWindow } from '@/pages/story/ui/RewardSkillWindow'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'
import type { EvaluationStep } from '@/pages/story/ui/evaluationEventPlayer/rewardSteps'

/** 보상 창 버튼 — 0x74ef4 종류 1 (OK 하나) */
const NOTICE_BUTTONS = ['OK'] as const
const POPUP_LAYER = { position: 'absolute', inset: 0, zIndex: 40 } as const

export interface ShownReward {
  readonly key: number
  readonly notice: RewardNotice
}

/** 지금 그리는 보상 창 — 보상 단계면 그 칸, 아니면 닫히는 중인 창(없으면 null) */
export function shownRewardOf(
  step: EvaluationStep,
  rewardNotices: readonly RewardNotice[],
  rewardIndex: number,
  closingReward: ShownReward | null,
): ShownReward | null {
  const currentReward = step === '보상' ? rewardNotices[rewardIndex] : undefined
  return currentReward !== undefined ? { key: rewardIndex, notice: currentReward } : closingReward
}

/** 0x8d71c — 0xbbef8(글, 1, 1, 1) → 0x74ef4 종류 1. 기다림 0x8daa0 은 답 0(OK · CLR)을 받은 그 갱신에 다음 명령 */
export function rewardNoticeWindowOf(shownReward: ShownReward | null, onKey: () => void, onClose: (key: number) => void) {
  if (shownReward?.notice.kind !== '알림') return null
  return (
    <div style={POPUP_LAYER}>
      <MessageBox
        key={`보상${shownReward.key}`}
        text={shownReward.notice.text}
        buttons={NOTICE_BUTTONS}
        dimOpacity={EVENT_WINDOW_DIM_OPACITY}
        onAnswerKey={onKey}
        onAnswer={() => onClose(shownReward.key)}
      />
    </div>
  )
}

/** 0x8d6bc — 첫 종류 4 는 스킬 창 0x741a1(그리기 0x87108 · 키 0x8e054 — OK · '5' · CLR, 받은 그 갱신에 다음 명령) */
export function rewardSkillWindowOf(shownReward: ShownReward | null, onKey: () => void, onClose: (key: number) => void) {
  if (shownReward?.notice.kind !== '스킬') return null
  return (
    <div style={POPUP_LAYER}>
      <RewardSkillWindow
        key={`보상${shownReward.key}`}
        text={shownReward.notice.text}
        gained={shownReward.notice.gained}
        onKey={onKey}
        onClose={() => onClose(shownReward.key)}
      />
    </div>
  )
}

/** 마지막 system sub 5 알림 창 */
export function finalNoticeWindowOf(step: EvaluationStep, finalNotice: string | null, onDone: () => void) {
  if (step !== '알림' || finalNotice === null) return null
  return (
    <div style={POPUP_LAYER}>
      <MessageBox text={finalNotice} buttons={['확인']} onAnswer={onDone} />
    </div>
  )
}
