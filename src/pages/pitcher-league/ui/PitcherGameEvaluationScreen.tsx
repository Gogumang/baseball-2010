import { useEffect, useState } from 'react'
import { MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { dialogueButton } from '@/shared/ui/DialogueBox/DialogueBox.css'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { NO_LAST_EVALUATION, pitcherLastGameLineOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherStreakEventOfCareer, pitcherStreakMarkupOf } from '@/entities/pitcher-career/model/pitcherStreaks'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'

/** StrUSER_EVT[75] "사기 변화: %d / 현재 사기: %d / … 평판" — 0x8a78c 둘째 명령의 글 번호 0x4b */
const EVALUATION_POPUP_INDEX = 75
/** 기록 줄 끝 — 원본 글 0xcc9e0 은 "실점!N" 이라 감독 글이 다음 줄에서 시작한다 (웹 `pitcherLastGameLineOf` 는 "실점" 까지) */
const RECORD_LINE_END = '!N'

const fillNumbers = (raw: string, values: readonly number[]) => {
  let index = 0
  return raw.replace(/%d/g, () => String(values[index++] ?? ''))
}

/** 평가 내장 이벤트를 차례로 튼다 — 대사 → 변화 팝업 → (있으면) 연속 기록 알림 */
type EvaluationStep = '대사' | '변화' | '연속기록'

interface PitcherGameEvaluationScreenProps {
  /** 116 진입이 쓴 뒤의 선수 — 지금 사기·인기도·평판과 S+0x4a · +0x64 · +7 변화를 읽는다 */
  readonly career: PitcherCareer
  readonly lastGame: PitcherLastGame
  /** [확인] = 114 */
  readonly onConfirm: () => void
}

/**
 * **투수편 116 경기 뒤 평가** (장면 0x106 상태 116, 진입 0x1278c — 타자편과 같은 상태, 모드 3 갈래).
 * 진입이 평가 내장 이벤트 0x8a6fc(장면+0x160, 모드, 글 번호, 기록 줄, …, S+7 · 사기 · +0x4a · 인기도 · +0x64 · +0x62)를 쌓아
 * 114 로 넘기고, 114 가 그 이벤트를 튼다.
 *
 * 그림 (타자편 `GameResultScreen` 의 `underlay` 와 같은 틀 — 040883f):
 * ```
 * 0x11e0c(116) · 0x8b5ac(114 대화창)  공 무늬 0x5fd61 → 상태판 0x7d34c(gfx, [이벤트+0xb] = 1 — 0x8a71e) → 머리띠(제목 9)
 * 0x8a6fc  명령 1(+0x14, 0xac7e5): 대사 — 글 번호 [+0x1e] = 감독 글 StrUSER_EVT[2~38], 기록 줄은 이벤트 +0x2cc
 *          0x8bab8: [이벤트+0xb] 면 대사 = 기록 줄 + 감독 글 (한 대사 상자)
 *          명령 2(+0x18, 0xac8b5): 종류 2 · 글 0x4b = StrUSER_EVT[75], 값 여섯은 이벤트 +0x2e0~+0x2f4
 *          감독 글 38 이면 연속 기록(0x8a836~)을 통째로 건너뛴다
 * ```
 * 0x8a6fc 의 투수편 연속 기록 알림(모드 레코드 +0x1bc · 글 103~107 · 109~112)은 그 뒤 알림이다(`pitcherStreakEventOf`) —
 * 그 보상은 [확인](114)이 먹는다.
 * ⚠️ 미해결(U-106): 대사 상자 · 변화 창(0x86531) · 알림의 원본 좌표와 글자 찍기 속도, 대사의 말하는 이 칸([명령+8])은 안 떴다 —
 * 대사는 이야기 화면(`StoryScreen`)과 같은 대사 상자, 변화 · 알림은 공용 알림 상자로 둔다.
 */
export function PitcherGameEvaluationScreen({ career, lastGame, onConfirm }: PitcherGameEvaluationScreenProps) {
  const changes = career.lastEvaluation ?? NO_LAST_EVALUATION
  const streakMarkup = pitcherStreakMarkupOf(pitcherStreakEventOfCareer(career), ORIGINAL_USER_EVENTS)
  const [step, setStep] = useState<EvaluationStep>('대사')
  const dialogue = `${pitcherLastGameLineOf(lastGame)}${RECORD_LINE_END}${ORIGINAL_USER_EVENTS[lastGame.managerCommentIndex] ?? ''}`
  const changeText = fillNumbers(ORIGINAL_USER_EVENTS[EVALUATION_POPUP_INDEX] ?? '', [
    changes.moraleChange,
    career.morale,
    changes.popularityChange,
    career.popularity,
    changes.reputationChange,
    career.reputation,
  ])
  const afterChange = () => (streakMarkup !== '' ? setStep('연속기록') : onConfirm())

  // 대사는 확인 키로 넘긴다 (팝업은 공용 알림 상자가 제 키를 받는다)
  useEffect(() => {
    if (step !== '대사') return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      event.preventDefault()
      setStep('변화')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step])

  return (
    <RawScreen>
      <PitcherEventUnderlay career={career} isPreviousGame />
      <div role="group" aria-label="경기 평가"
        style={{ position: 'absolute', left: 8, right: 8, bottom: 24, zIndex: 30 }}>
        {step === '대사' && (
          <button type="button" className={dialogueButton} onClick={() => setStep('변화')}>
            <MarkupText raw={dialogue} />
          </button>
        )}
      </div>
      {step === '변화' && <MessageBox text={changeText} buttons={['확인']} onAnswer={afterChange} />}
      {step === '연속기록' && <MessageBox text={streakMarkup} buttons={['확인']} onAnswer={onConfirm} />}
    </RawScreen>
  )
}
