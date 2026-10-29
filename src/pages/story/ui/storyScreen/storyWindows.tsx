import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { YearGoalWindow } from '@/pages/story/ui/YearGoalWindow'
import { RewardSkillWindow } from '@/pages/story/ui/RewardSkillWindow'
import { isYearGoalWindowOf } from './storyLines'
import type { ShownReward } from './storyLines'

/**
 * 공용 알림 · 질문 창 0x74ef4(창 [0x140005c], 글 [mgr+0xba], 종류, 0, 0, 0) 의 버튼 — 화면에는 `ui/popup.pzx` 그림이 나간다.
 * 종류 1(알림)은 프레임 0 "OK" 하나 · 종류 2(예아니오)는 1 "예" · 2 "아니오"(0x750f8~0x75140).
 */
const NOTICE_BUTTONS = ['OK'] as const
const YES_NO_BUTTONS = ['예', '아니오'] as const

/**
 * system 창 — 올해의 목표 창(system 1) · 알림. 0x8cf64 명령 2(system) 하위 0(0x8b924) · 3(0x8b3bc) · 4(0x8b23c) · 5(0x8b1b8) 는
 * 글을 [mgr+0xba] 에 채워 공용 창 0x74ef4(…, 종류 1) 을 띄운다(0x8d404~0x8d414). 창은 대사 상자 밖 — 화면 가운데 공용 판이다
 * (`MessageBox`). 창이 닫히면(0x8d91c → [창+9] == 0 → 0x8dac2) 다음 명령. 알림은 CLR 도 0(0x751c2~0x751ec: 키 −16 → 0)
 */
export function systemWindowsOf(
  command: EventCommand | null,
  key: string,
  yearGoalWindowOf: (() => YearGoalWindowSource) | undefined,
  closeSystemWindow: () => void,
) {
  const isYearGoalWindow = isYearGoalWindowOf(command, yearGoalWindowOf)
  const noticeText = command?.op === 'system' && !isYearGoalWindow ? (command.text ?? null) : null
  return (
    <>
      {isYearGoalWindow && <YearGoalWindow values={yearGoalWindowOf!()} onClose={closeSystemWindow} />}
      {noticeText !== null && (
        <MessageBox key={key} text={noticeText} buttons={NOTICE_BUTTONS} dimOpacity={EVENT_WINDOW_DIM_OPACITY} onAnswer={closeSystemWindow} />
      )}
    </>
  )
}

/**
 * 보상 창 — 0x8d71c 알림(0xbbef8(글, 1, 1, 1) → 0x74ef4 종류 1, 기다림 0x8daa0 은 답 0(OK · CLR)을 받은 그 갱신에 다음 명령) ·
 * 0x8d6bc 첫 종류 4 스킬 창 0x741a0 (그리기 0x87108 · 키 0x8e054 — 받은 그 갱신에 다음 명령)
 */
export function rewardWindowsOf(shownReward: ShownReward | null, answerReward: () => void, finishRewardWindow: (key: string) => void) {
  const notice = shownReward?.notice
  return (
    <>
      {notice?.kind === '알림' && (
        <MessageBox
          key={shownReward!.key}
          text={notice.text}
          buttons={NOTICE_BUTTONS}
          dimOpacity={EVENT_WINDOW_DIM_OPACITY}
          onAnswerKey={answerReward}
          onAnswer={() => finishRewardWindow(shownReward!.key)}
        />
      )}
      {notice?.kind === '스킬' && (
        <RewardSkillWindow
          key={shownReward!.key}
          text={notice.text}
          gained={notice.gained}
          onKey={answerReward}
          onClose={() => finishRewardWindow(shownReward!.key)}
        />
      )}
    </>
  )
}

/**
 * 예아니오 — 0x74ef4 종류 2 — 0x749d5 를 안 불러 처음 커서는 [예]. CLR 은 1 [아니오](0x7514a~0x75174: 키 −16 → 1).
 * 답 0 → [mgr+0x2bc] = 예 이벤트([명령+8]) · 1 → 아니오 이벤트([명령+0xa]) (0x8d954~0x8d9a2)
 */
export function yesNoWindowOf(command: EventCommand | null, key: string, jump: (eventId: number) => void) {
  if (command?.op !== 'yesno') return false
  return (
    <MessageBox
      key={key}
      text={command.text}
      buttons={YES_NO_BUTTONS}
      dimOpacity={EVENT_WINDOW_DIM_OPACITY}
      onAnswer={(answer) => jump(answer === 0 ? command.yesEvent : command.noEvent)}
    />
  )
}
