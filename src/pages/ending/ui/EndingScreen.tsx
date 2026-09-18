import { useState } from 'react'
import { DialogueBox, MarkupText, PixelScreen } from '@/shared/ui'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import type { HallOfFameResult } from '@/entities/collection/model/collection'

interface EndingScreenProps {
  readonly playerName: string
  readonly endingIndex: number
  /** 엔딩 보너스(0이면 부상·방출 엔딩) */
  readonly bonusGamePoint: number
  readonly isContinuable: boolean
  readonly onRegister: () => HallOfFameResult['kind']
  /** 5000 G포인트로 이어하기. 모자라면 false */
  readonly onContinue: () => boolean
  readonly onFinish: () => void
}

/** 엔딩 뒤 원문 문구 */
const TEXT = {
  bonus: '!C엔딩 보너스 획득!N[!cFFFF00%d G포인트!cFFFFFF]', // StrMODE[214]
  ask: '!C나만의 리그 선수를!N[!cFFFF00명예의 전당!cFFFFFF]에!N등록 하시겠습니까?', // StrMODE[215]
  later: '!C나중에 등록 하시겠습니까?!N메인 메뉴로 이동합니다', // StrMODE[219]
  continue: '!C!cFFFF005000 G포인트!cFFFFFF를 소모하여 현재!N상태에서 이어하시겠습니까? ', // StrMODE[221]
  shortage: '!C!cFF0000%d G포인트!cFFFFFF가 부족합니다', // StrCOMMON[41]
  full: '!C!cffffff명예의 전당에!N빈슬롯이 없습니다', // StrCOMMON[51]
  done: '!C!cffffff명예의 전당에!N등록이 완료되었습니다', // StrCOMMON[52]
}
const CONTINUE_COST = 5000

type Phase = '엔딩' | '보너스' | '이어하기질문' | '등록질문' | '나중질문' | '안내'
type QuestionPhase = '이어하기질문' | '등록질문' | '나중질문'

interface Question {
  readonly title: string
  readonly text: string
  readonly onYes: () => void
  readonly onNo: () => void
}

/**
 * 나만의리그 엔딩 (0x1220c) — StrENDING[0~9] 원문 (번호는 엔딩 판정표 0xa3a84).
 * 부상·방출(0·1)은 이어하기를 묻고, 그 밖은 엔딩 보너스를 준 뒤 명예의 전당 등록을 묻는다.
 * "나중에 등록" 은 원본에서 선수를 남겨 두지만, 웹판은 저장이 하나라 등록하지 않으면 사라진다.
 * G포인트가 모자랄 때 원본이 어디로 가는지는 미확인 — StrCOMMON[41] 을 띄우고 끝낸다 (추정).
 */
export function EndingScreen(props: EndingScreenProps) {
  const { playerName, endingIndex, bonusGamePoint, isContinuable, onRegister, onContinue, onFinish } = props
  const [phase, setPhase] = useState<Phase>('엔딩')
  const [message, setMessage] = useState('')
  const inform = (text: string) => {
    setMessage(text)
    setPhase('안내')
  }

  if (phase === '엔딩' || phase === '보너스' || phase === '안내') {
    const next = () => {
      if (phase === '안내') return onFinish()
      if (phase === '보너스') return setPhase('등록질문')
      if (isContinuable) return setPhase('이어하기질문')
      return setPhase(bonusGamePoint > 0 ? '보너스' : '등록질문')
    }
    const raw =
      phase === '엔딩' ? ORIGINAL_ENDINGS[endingIndex] ?? ''
        : phase === '보너스' ? TEXT.bonus.replace('%d', String(bonusGamePoint))
          : message
    return (
      <PixelScreen title={phase === '안내' ? '안내' : '엔딩'} leftKey={{ label: '확인', onPress: next }}>
        <DialogueBox>
          <MarkupText raw={raw} replacements={[playerName]} />
        </DialogueBox>
      </PixelScreen>
    )
  }

  const questions: Record<QuestionPhase, Question> = {
    이어하기질문: {
      title: '이어하기',
      text: TEXT.continue,
      onYes: () => {
        if (!onContinue()) inform(TEXT.shortage.replace('%d', String(CONTINUE_COST)))
      },
      onNo: onFinish,
    },
    등록질문: {
      title: '명예의 전당',
      text: TEXT.ask,
      onYes: () => inform(onRegister() === '등록' ? TEXT.done : TEXT.full),
      onNo: () => setPhase('나중질문'),
    },
    나중질문: { title: '명예의 전당', text: TEXT.later, onYes: onFinish, onNo: () => setPhase('등록질문') },
  }
  const question = questions[phase]
  return (
    <PixelScreen
      title={question.title}
      leftKey={{ label: '예', onPress: question.onYes }}
      rightKey={{ label: '아니오', onPress: question.onNo }}
    >
      <DialogueBox>
        <MarkupText raw={question.text} />
      </DialogueBox>
    </PixelScreen>
  )
}
