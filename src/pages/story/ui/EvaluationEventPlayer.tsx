import { useState } from 'react'
import { MessageBox } from '@/shared/ui'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import { EvaluationChangeWindow } from '@/pages/story/ui/EvaluationChangeWindow'
import { EvaluationGauge } from '@/pages/story/ui/EvaluationGauge'
import { evaluationManagerPortraitsOf } from '@/pages/story/lib/evaluationDialogue'
import { PORTRAIT_HEIGHT } from '@/pages/story/ui/StoryScreen.css'
import { SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'
import { portraitBaseYOf } from '@/pages/story/lib/eventBackdrop'
import { RewardSkillWindow } from '@/pages/story/ui/RewardSkillWindow'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'
import type { RewardNotice } from '@/entities/story/model/rewardNotice'
import { givenRewardCountOf, nextWindowRewardOf } from '@/pages/story/ui/evaluationEventPlayer/rewardSteps'
import type { EvaluationStep } from '@/pages/story/ui/evaluationEventPlayer/rewardSteps'
import type { EvaluationEventPlayerProps } from '@/pages/story/ui/evaluationEventPlayer/evaluationEventPlayerProps'

/** 보상 창 버튼 — 0x74ef4 종류 1 (OK 하나) */
const NOTICE_BUTTONS = ['OK'] as const

/**
 * 초상화 바닥 — 0x7fbc4 끝(0x7fdee~0x7fe4c)이 0x7f998(창, y) 에 넘기는 y:
 * 장면 [gfx+0x174] 이 0x70 · 0x71(이야기 이벤트) 이거나 효과 칠 인자가 켜져 있으면 H − 0x44,
 * 아니면 mode_ui 프레임 10 박스 0 (0, 65, 240, 72) 의 y + h − 2 = 135. 114(0x72)의 0x8b5ac 는 효과 칠 인자로
 * 화면 효과(0x140007c) 칠이 걸렸을 때만 1 을 넘기는데 평가 이벤트에는 그런 명령이 없어 135 다.
 * 0x7f998 은 (0, 0, W, y + 1) 로 잘라 y 를 바닥으로 그린다.
 */
const PORTRAIT_BOTTOM = SCREEN_HEIGHT - portraitBaseYOf(false, false)

/**
 * **114 가 트는 116 평가 내장 이벤트 0x8a6fc** (그림 0x8b5ac → 0x7fbc4 — say 상자 `EventDialogueBox`, 직접 떴다).
 * 0x8b5ac 는 틀마다 0x7fbc4 로 상자와 마지막 say 글을 그린다 — 변화 창(팝업)이 떠 있는 동안에도 앞 대사가 밑에 남는다.
 * 명령 3 say 는 [mgr+0x2c0] 이 이미 1 이라 상자가 다시 오르지 않고 글만 새로 찍는다(0x8d1f2).
 * 초상화(감독 · 오른쪽)는 0x7fbc4 끝(0x7fdee~)이 그린다 — 114 에서는 바닥 y 가 경기장 띠 아래 135 다(`PORTRAIT_BOTTOM`).
 *
 * 키는 다른 이벤트와 같은 0x8b804 다 — 나리 114 키 0x13b88 · 시즌 0xd3 키 0x90ec 모두 `0x8b804(관리자, 키)` 하나만 부른다.
 * 그래서 say 중 CLR(웹 Escape · Backspace)은 0x8b7b0 건너뛰기다: [mgr+0x10] 을 늘려 가며 종류 7 · 2 · 1 · 3 · 4 · 8 명령을 찾는다.
 * 변화 창(0x8d386, 키 표 −5 · '5' 뿐)은 CLR 을 받지 않는다.
 */
export function EvaluationEventPlayer({
  underlay,
  dialogue,
  dialogueExpression,
  changeValues,
  goals,
  year,
  game,
  streak,
  streakExpression,
  gauge,
  finalNotice = null,
  rewardNotices = [],
  underlayAfterRewards,
  onRewardsGiven,
  onDone,
}: EvaluationEventPlayerProps) {
  const [step, setStep] = useState<EvaluationStep>('대사')
  /** 마지막 say 가 연속 기록이었는가 — 알림 창 밑에 남는 상자가 그 글이다 */
  const [hasStreakShown, setStreakShown] = useState(false)
  /** 지금 보상 명령 칸 (`rewardNotices` 첨자) — 그 앞 명령들의 보상은 이미 들어갔다 */
  const [rewardIndex, setRewardIndex] = useState(0)
  /**
   * 키를 받아 넘긴 뒤에도 닫히는 공용 창 — 0x8daa0 은 답을 받은 그 갱신에 다음 명령으로 넘기고 창은 닫힘 애니를 마저 돈다
   * (스킬 창 0x8e054 → 0x742a9 는 닫힘 애니 없이 그 자리에서 치운다). StoryScreen 의 `closingReward` 와 같다
   */
  const [closingReward, setClosingReward] = useState<{ readonly key: number; readonly notice: RewardNotice } | null>(null)
  const finish = () => (finalNotice !== null ? setStep('알림') : onDone())
  /** 연속 기록 say 다음 — 보상 명령이 있으면 그 창, 없으면 끝(또는 system sub 5) */
  const afterStreak = () => {
    const first = nextWindowRewardOf(rewardNotices, 0)
    if (first >= rewardNotices.length) return finish()
    setRewardIndex(first)
    setStep('보상')
    onRewardsGiven?.(first + 1)
  }
  const afterChange = () => {
    if (streak === '') return afterStreak()
    setStreakShown(true)
    setStep('연속기록')
  }
  const answerReward = () => {
    const notice = rewardNotices[rewardIndex]
    if (step !== '보상' || notice === undefined) return
    setClosingReward({ key: rewardIndex, notice })
    const next = nextWindowRewardOf(rewardNotices, rewardIndex + 1)
    if (next >= rewardNotices.length) return finish()
    setRewardIndex(next)
    onRewardsGiven?.(next + 1)
  }
  const finishRewardWindow = (key: number) => setClosingReward((closing) => (closing?.key === key ? null : closing))
  const currentReward = step === '보상' ? rewardNotices[rewardIndex] : undefined
  const shownReward = currentReward !== undefined ? { key: rewardIndex, notice: currentReward } : closingReward
  const givenRewardCount = givenRewardCountOf(step, rewardIndex, rewardNotices.length)
  const expression = hasStreakShown ? streakExpression : dialogueExpression

  return (
    <>
      {underlayAfterRewards === undefined ? underlay : underlayAfterRewards(givenRewardCount)}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: PORTRAIT_BOTTOM, zIndex: 30, pointerEvents: 'none' }}>
        <EventPortraits portraits={evaluationManagerPortraitsOf(expression)} height={PORTRAIT_HEIGHT} />
      </div>
      <div role="group" aria-label="경기 평가">
        {hasStreakShown ? (
          // 명령 3 say 중 CLR → 0x8b7b0 이 뒤의 보상 명령(종류 7, 8ac54 · 8ad22~8af8a 가 say 뒤에 쌓는다)을 찾아 돌리거나, 없으면 끝 —
          // OK 로 글을 끝까지 넘긴 것과 같은 다음 명령이다
          <EventDialogueBox
            key="연속기록"
            raw={streak}
            slideIn={false}
            isActive={step === '연속기록'}
            onAdvance={afterStreak}
            onCancel={afterStreak}
          />
        ) : (
          // 명령 1 say 중 CLR(−16) → 0x8b7b0 이 바로 다음 명령 2(system 종류 2 · 하위 2 = 변화 창)에서 멈춘다 — 단계와 상관없이
          <EventDialogueBox
            key="대사"
            raw={dialogue}
            slideIn
            isActive={step === '대사'}
            onAdvance={() => setStep('변화')}
            onCancel={() => setStep('변화')}
          />
        )}
      </div>
      {/* 0x8b72c~0x8b75a — 상자 · 초상화(0x7fbc4) 다음에 그린다. 팝업(변화 창)은 그 위 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 35, pointerEvents: 'none' }}>
        <EvaluationGauge popularityChange={gauge.popularityChange} divisor={gauge.divisor} />
      </div>
      {step === '변화' && (
        // 팝업은 상자 · 초상화 위에 그린다
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <EvaluationChangeWindow values={changeValues} goals={goals} year={year} game={game} onClose={afterChange} />
        </div>
      )}
      {shownReward?.notice.kind === '알림' && (
        // 0x8d71c — 0xbbef8(글, 1, 1, 1) → 0x74ef4 종류 1. 기다림 0x8daa0 은 답 0(OK · CLR)을 받은 그 갱신에 다음 명령
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <MessageBox
            key={`보상${shownReward.key}`}
            text={shownReward.notice.text}
            buttons={NOTICE_BUTTONS}
            dimOpacity={EVENT_WINDOW_DIM_OPACITY}
            onAnswerKey={answerReward}
            onAnswer={() => finishRewardWindow(shownReward.key)}
          />
        </div>
      )}
      {shownReward?.notice.kind === '스킬' && (
        // 0x8d6bc — 첫 종류 4 는 스킬 창 0x741a1(그리기 0x87108 · 키 0x8e054 — OK · '5' · CLR, 받은 그 갱신에 다음 명령)
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <RewardSkillWindow
            key={`보상${shownReward.key}`}
            text={shownReward.notice.text}
            gained={shownReward.notice.gained}
            onKey={answerReward}
            onClose={() => finishRewardWindow(shownReward.key)}
          />
        </div>
      )}
      {step === '알림' && finalNotice !== null && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
          <MessageBox text={finalNotice} buttons={['확인']} onAnswer={onDone} />
        </div>
      )}
    </>
  )
}
