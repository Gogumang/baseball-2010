import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import type { EventStep } from '@/entities/story/model/eventScript'
import { speakerPrefixOf } from '@/pages/story/lib/eventDialogue'
import type { DialogueBoxContent, StoryScreenProps } from './storyScreenProps'
import { replacementsOf, speakerNameOf } from './storyLines'

type SayOrChoice = Extract<EventCommand, { op: 'say' } | { op: 'choice' }>

/**
 * say · 선택지 명령이 도는 틀 — 상자 글 칸을 쓴다. system · 예아니오는 대사 상자의 글을 건드리지 않는다 — 0x8b924 는 관리자
 * 버퍼 [mgr+0xba] 에 쓰고(say 글은 0x7b818 이 돌려주는 상자 쪽 글 0xbc965), 0x8b5ac 는 창이 떠 있는 동안에도 틀마다
 * 0x7fbc4 로 앞 상자를 그린다 — 선택지 뒤라면 선택지 줄과 고른 줄 테두리가 그대로 남는다.
 * 명령이 도는 렌더에서 곧바로 상자 칸을 쓴다(그 렌더의 그림부터 새 칸).
 *
 * 돌려주는 차례: [이 그림의 상자 칸, 고른 줄 [mgr+0xb9], 고른 줄 쓰기]
 */
export function useDialogueBoxContent(
  step: EventStep,
  isReleased: boolean,
  props: StoryScreenProps,
  heldBox: DialogueBoxContent | null,
  setBox: Dispatch<SetStateAction<DialogueBoxContent | null>>,
  eventLoads: number,
  setLowerCount: Dispatch<SetStateAction<number>>,
) {
  /** [mgr+0xb9] — 선택지가 돌 때 0, 위 · 아래로 바뀐다. 다음 say · 선택지가 돌 때까지 남는다 */
  const [selectedChoice, setSelectedChoice] = useState(0)
  /** 이 이벤트 실음에서 say 를 돌렸는가 ([mgr+0x2c0]) — 값은 그때의 `eventLoads` */
  const [saidInLoad, setSaidInLoad] = useState<number | null>(null)
  const command = releasedCommandOf(step, isReleased)
  const commandKey = `${step.cursor.eventId}:${step.cursor.commandIndex}`
  const isNewBox = isBoxWritingCommand(command) && heldBox?.key !== commandKey
  if (!isNewBox) return [heldBox, selectedChoice, setSelectedChoice] as const
  // 0x8d1f2 — 이 이벤트의 첫 say 면 0x7f7cc(높이 0) · [mgr+0x2c0] = 1, 그다음 0x8bab8 · 0x7f7d5
  if (command.op === 'say' && saidInLoad !== eventLoads) {
    setSaidInLoad(eventLoads)
    if (heldBox !== null) setLowerCount((count) => count + 1)
  }
  // 0x8d22c — 0x8ba2c(칸 k = 갈래 글, [mgr+0xb9] = 0) · 0x7f7d5 · [창+0xe4] = 갈래 수 · 0x7f54c(초상화)
  if (command.op === 'choice') setSelectedChoice(0)
  const box = boxContentOf(command, commandKey, step.cursor.eventId, props)
  setBox(box)
  return [box, selectedChoice, setSelectedChoice] as const
}

const isBoxWritingCommand = (command: EventCommand | null): command is SayOrChoice => command?.op === 'say' || command?.op === 'choice'

/** say 는 칸 0 에 "머리말 + 글"(0x8bab8), 선택지는 칸 k 에 갈래 글(0x8ba2c) */
function boxContentOf(command: SayOrChoice, key: string, eventId: number, props: StoryScreenProps): DialogueBoxContent {
  if (command.op === 'choice') return { key, slots: command.choices.map((choice) => choice.text), isChoice: true, replacements: [] }
  const slot = `${speakerPrefixOf(speakerNameOf(command, props))}${command.text}`
  return { key, slots: [slot], isChoice: false, replacements: replacementsOf(command, eventId, props) }
}

/** 막는 효과를 기다리는 동안은 멈출 명령이 아직 돌지 않았다 — 앞 say 상자가 그대로다 */
const releasedCommandOf = (step: EventStep, isReleased: boolean) => (isReleased ? step.command : null)
