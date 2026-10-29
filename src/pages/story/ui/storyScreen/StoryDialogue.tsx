import type { Dispatch, SetStateAction } from 'react'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import type { EventStep } from '@/entities/story/model/eventScript'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import type { DialogueBoxContent, StoryScreenProps } from './storyScreenProps'
import { isBoxClearedOf } from './storyLines'

/** 상자 키를 받는가 — 0x8b804 는 지금 명령이 say · 선택지일 때만 받는다(창 밑에 남은 상자는 창이 키를 가져간다). 입력 잠금 동안은 아니다 */
const isBoxActiveOf = (command: EventCommand | null, isInputLocked = false) => (command?.op === 'say' || command?.op === 'choice') && !isInputLocked

/**
 * 대사 상자 — 상자 객체는 재생 내내 하나다 — 재생은 늘 높이 0 에서 시작한다(앞 재생 끝 0x8d4e2 의 0x7f7cc · 글 칸 비우기)
 */
export function StoryDialogue({
  box,
  command,
  step,
  isReleased,
  selectedChoice,
  setSelectedChoice,
  lowerCount,
  props,
  next,
  skip,
  leftEventIds,
  jump,
}: {
  readonly box: DialogueBoxContent
  readonly command: EventCommand | null
  readonly step: EventStep
  readonly isReleased: boolean
  readonly selectedChoice: number
  readonly setSelectedChoice: Dispatch<SetStateAction<number>>
  readonly lowerCount: number
  readonly props: StoryScreenProps
  readonly next: () => void
  readonly skip: () => void
  readonly leftEventIds: () => readonly number[]
  readonly jump: (eventId: number) => void
}) {
  const choiceCommand = command?.op === 'choice' ? command : null
  return (
    <EventDialogueBox
      raw={isBoxClearedOf(step, isReleased) ? '' : (box.slots[0] ?? '')}
      replacements={box.replacements}
      choices={box.isChoice ? { lines: box.slots, selected: selectedChoice } : null}
      textKey={box.key}
      lowerKey={lowerCount}
      slideIn
      onAdvance={next}
      isActive={isBoxActiveOf(command, props.isInputLocked)}
      // 0x8b7b0 — say 중 취소는 다음 보상 · system · 선택지 · 예아니오 · 4 · 경기 명령까지 say · 효과 · 소리를 건너뛴다
      onCancel={command?.op === 'say' ? skip : undefined}
      onChoiceMove={setSelectedChoice}
      // 0x8b8b6 — [mgr+0x2bc] = [명령+0x24 + 2 × 고른 줄] · [mgr+8] = 1 → 다음 틀에 그 이벤트를 싣는다(0x8be20)
      onChoiceConfirm={(selected) => {
        const choice = choiceCommand?.choices[selected]
        // 8b8d8 0x8b0e4 — 고른 이벤트를 싣기(다음 틀 0x8be20) 앞에 떠나온 줄 본 표시 · S+4 · 저장
        props.onChoiceConfirm?.(step.cursor.eventId, leftEventIds())
        if (choice !== undefined) jump(choice.gotoEvent)
      }}
    />
  )
}
