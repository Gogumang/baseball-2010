import { useState } from 'react'
import type { ReactNode } from 'react'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import { EvaluationChangeWindow } from '@/pages/story/ui/EvaluationChangeWindow'
import { EvaluationGauge } from '@/pages/story/ui/EvaluationGauge'
import type { EvaluationChangeValues } from '@/pages/story/lib/evaluationChangeWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { evaluationManagerPortraitsOf } from '@/pages/story/lib/evaluationDialogue'
import { PORTRAIT_HEIGHT } from '@/pages/story/ui/StoryScreen.css'
import { SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'
import { portraitBaseYOf } from '@/pages/story/lib/eventBackdrop'

/** 평가 내장 이벤트를 차례로 튼다 — 명령 1 say → 명령 2 system sub 2(변화 창) → (있으면) 명령 3 say(연속 기록) */
type EvaluationStep = '대사' | '변화' | '연속기록'

/**
 * 초상화 바닥 — 0x7fbc4 끝(0x7fdee~0x7fe4c)이 0x7f998(창, y) 에 넘기는 y:
 * 장면 [gfx+0x174] 이 0x70 · 0x71(이야기 이벤트) 이거나 효과 칠 인자가 켜져 있으면 H − 0x44,
 * 아니면 mode_ui 프레임 10 박스 0 (0, 65, 240, 72) 의 y + h − 2 = 135. 114(0x72)의 0x8b5ac 는 효과 칠 인자로
 * 화면 효과(0x140007c) 칠이 걸렸을 때만 1 을 넘기는데 평가 이벤트에는 그런 명령이 없어 135 다.
 * 0x7f998 은 (0, 0, W, y + 1) 로 잘라 y 를 바닥으로 그린다.
 */
const PORTRAIT_BOTTOM = SCREEN_HEIGHT - portraitBaseYOf(false, false)

interface EvaluationEventPlayerProps {
  /** 116 · 114 밑그림 — 공 무늬 · 상태판([이벤트+0xb] = 1) · 머리띠 */
  readonly underlay: ReactNode
  /** 명령 1 글 — 기록 줄 + 감독 글 (0x8bab8 — 말하는 이 0 이라 머리말 없음) */
  readonly dialogue: string
  /** 명령 1 표정 [명령+8] (`batterEvaluationExpressionOf` · `pitcherEvaluationExpressionOf`) */
  readonly dialogueExpression: number
  readonly changeValues: EvaluationChangeValues
  readonly goals: YearGoalWindowSource
  readonly year: number
  readonly game: number
  /** 명령 3 글 — 연속 기록 알림 줄(전역 버퍼 0x1552af4). 빈 글이면 명령이 없다 */
  readonly streak: string
  readonly streakExpression: number
  /**
   * 0x8587c 의 인기도 변화 막대 — S+0x4a 와 d(`evaluationGaugeDivisorOf`). 0x8b5ac 가 틀마다 대사 상자 뒤에
   * 0x847e0 · 0x85944 · 0x858cc 로 그린다(`EvaluationGauge`)
   */
  readonly gauge: { readonly popularityChange: number; readonly divisor: number }
  /** 마지막 명령이 끝나면 — 114 끝 */
  readonly onDone: () => void
}

/**
 * **114 가 트는 116 평가 내장 이벤트 0x8a6fc** (그림 0x8b5ac → 0x7fbc4 — say 상자 `EventDialogueBox`, 직접 떴다).
 * 0x8b5ac 는 틀마다 0x7fbc4 로 상자와 마지막 say 글을 그린다 — 변화 창(팝업)이 떠 있는 동안에도 앞 대사가 밑에 남는다.
 * 명령 3 say 는 [mgr+0x2c0] 이 이미 1 이라 상자가 다시 오르지 않고 글만 새로 찍는다(0x8d1f2).
 * 초상화(감독 · 오른쪽)는 0x7fbc4 끝(0x7fdee~)이 그린다 — 114 에서는 바닥 y 가 경기장 띠 아래 135 다(`PORTRAIT_BOTTOM`).
 */
export function EvaluationEventPlayer({
  underlay, dialogue, dialogueExpression, changeValues, goals, year, game, streak, streakExpression, gauge, onDone,
}: EvaluationEventPlayerProps) {
  const [step, setStep] = useState<EvaluationStep>('대사')
  const afterChange = () => (streak !== '' ? setStep('연속기록') : onDone())
  const expression = step === '연속기록' ? streakExpression : dialogueExpression

  return (
    <>
      {underlay}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: PORTRAIT_BOTTOM, zIndex: 30, pointerEvents: 'none' }}>
        <EventPortraits portraits={evaluationManagerPortraitsOf(expression)} height={PORTRAIT_HEIGHT} />
      </div>
      <div role="group" aria-label="경기 평가">
        {step === '연속기록' ? (
          <EventDialogueBox key="연속기록" raw={streak} slideIn={false} onAdvance={onDone} />
        ) : (
          <EventDialogueBox key="대사" raw={dialogue} slideIn isActive={step === '대사'} onAdvance={() => setStep('변화')} />
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
    </>
  )
}
