import { Hint, MarkupText, MenuList } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { dialogueButton } from '@/shared/ui/DialogueBox/DialogueBox.css'
import { SPEAKER_NAMES } from '@/shared/config/original/eventMeta'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { EventReward } from '@/entities/story/model/eventReward'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { useEventPlayback } from '@/pages/story/model/useEventPlayback'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import * as styles from '@/pages/story/ui/StoryScreen.css'

/** 화자 번호 1 은 플레이어 이름으로 바꾼다. */
const PLAYER_SPEAKER = 1
/** 대사 fmt 9 는 %s 자리에 팀 이름을 넣는다 (그 밖에는 선수 이름). */
const TEAM_NAME_FORMAT = 9

interface StoryScreenProps {
  readonly events: readonly OriginalEvent[]
  readonly event: OriginalEvent
  readonly playerName: string
  readonly teamName: string
  /** 주인공 초상화 팔레트 — 피부 0 황인 · 1 백인 · 2 흑인 (event_char_0.mpl, C-1) */
  readonly skinIndex?: number
  /** 0 타격형 · 1 장타형. 장타형이면 초상화 애니가 **+8** 이다 (V2 정정) */
  readonly battingTypeIndex?: number
  readonly onComplete: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => void
  /** 경기 명령 — 마선수 대결로 나간다 */
  readonly onMatch: (command: MatchCommand, carry: StoryCarry) => void
  /** 대결에서 돌아온 결과 이벤트라면 앞 이벤트가 모은 보상·기록 */
  readonly carried?: StoryCarry
}

/** 원작 이벤트. 대사마다 원본이 정한 인물·표정·자리로 초상화를 띄운다. */
export function StoryScreen({
  events, event, playerName, teamName, skinIndex, battingTypeIndex, onComplete, onMatch, carried,
}: StoryScreenProps) {
  const { step, portraits, next, jump } = useEventPlayback(events, event, onComplete, onMatch, carried)
  const command = step.command

  const speakerName =
    command?.op !== 'say' || command.speaker === 0
      ? null
      : command.speaker === PLAYER_SPEAKER
        ? playerName
        : (SPEAKER_NAMES[command.speaker] ?? null)
  const replacements = command?.op === 'say' && command.format === TEAM_NAME_FORMAT ? [teamName] : [playerName, teamName]
  const dialogue = command?.op === 'say' || command?.op === 'yesno' ? command.text : command?.op === 'system' ? (command.text ?? '') : ''

  const menu: MenuItem[] | null =
    command?.op === 'choice'
      ? command.choices.map((choice) => ({ id: String(choice.gotoEvent), label: stripGameMarkup(choice.text) }))
      : command?.op === 'yesno'
        ? [
            { id: String(command.yesEvent), label: '예' },
            { id: String(command.noEvent), label: '아니오' },
          ]
        : null
  const isDialogue = command?.op === 'say' || command?.op === 'system'

  return (
    <div className={styles.overlay}>
      <EventPortraits portraits={portraits} height={styles.PORTRAIT_HEIGHT}
        skinIndex={skinIndex} battingTypeIndex={battingTypeIndex} />
      {speakerName !== null && <span className={styles.nameTag}>{speakerName}</span>}

      {dialogue !== '' && (
        <button type="button" className={dialogueButton} onClick={isDialogue ? next : undefined}>
          <MarkupText raw={dialogue} replacements={replacements} />
        </button>
      )}

      {menu !== null ? (
        // 원본 선택지는 대사 창 안 글줄이라 화살표·판이 없고 고른 줄만 노랑이다 (0x7fd22, R14 3-4)
        <MenuList items={menu} cursorStyle="선택지" onSelect={(id) => jump(Number(id))} />
      ) : (
        <Hint>대사창을 누르거나 Enter</Hint>
      )}
    </div>
  )
}
