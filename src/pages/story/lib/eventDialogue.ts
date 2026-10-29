/**
 * **이벤트 재생기 say · 선택지 명령의 대사 상자** — 공용 대사 창 0x7fbc4 / 상자 0x7fad0. 원본 흐름은 `eventDialogue/dialogueBox` 머리말.
 * 공개 이름 모음 — 하위 폴더 (`eventDialogue/`): `dialogueBox`(상자 자리 · 크기 상수) · `dialogueMarkup`(글 속 표시) ·
 * `dialogueText`(머리말 · %s 채우기 · 줄 나누기 0x6ef4c) · `dialogueTyping`(창 칸 · 틀마다 찍기 · 확인 키 0x8b804)
 */
export {
  DIALOGUE_CURSOR,
  EVENT_DIALOGUE,
  EVENT_DIALOGUE_CHOICE,
  EVENT_WINDOW_DIM_OPACITY,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '@/pages/story/lib/eventDialogue/dialogueBox'
export {
  layoutDialogue,
  pageEndOf,
  speakerPrefixOf,
  substituteDialogue,
  visibleDialogueLinesOf,
  type DialogueGlyph,
  type DialogueLayout,
  type DialogueLine,
} from '@/pages/story/lib/eventDialogue/dialogueText'
export {
  lowerDialogueBox,
  pressDialogue,
  restartDialogueText,
  startDialogue,
  tickDialogue,
  type DialogueState,
} from '@/pages/story/lib/eventDialogue/dialogueTyping'
