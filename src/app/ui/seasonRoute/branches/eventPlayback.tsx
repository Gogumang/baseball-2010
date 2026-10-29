import type { ReactNode } from 'react'
import { SeasonEventUnderlay, SeasonEventEndFrame } from '@/pages/season'
import { RawScreen, ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { SEASON_PLAYABLE_EVENTS, YEAR_GOAL_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { SEASON_YEAR_GOAL_LABEL_SET } from '@/pages/story/lib/yearGoalWindow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonRewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { seasonGoalWindowNumbersFor } from '@/app/model/useSeasonSession'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

type EventPlayback = NonNullable<SeasonBranchInput['session']['eventPlayback']>

/**
 * 끝 그림의 칸 — 앞 상태 [this+0x28] 가 0xd1 지도면 지도, 0xc9 면 관리 6칸, 그 밖은 칸 없음. 연초 목표(내장 이벤트)는 0xc9 → 0xd4 → 0xd3 이라
 * 앞 상태가 0xd4 다(웹은 0xd4 를 상태로 안 두고 관리 메뉴에서 곧장 튼다)
 */
function endFrameKindOf(previousScene: number | null, eventId: number): '지도' | '관리메뉴' | '칸없음' {
  if (previousScene === SEASON_SCENE_STATE.외출지도) return '지도'
  if (previousScene === SEASON_SCENE_STATE.관리메뉴 && eventId !== YEAR_GOAL_EVENT_ID) return '관리메뉴'
  return '칸없음'
}

/** 재생이 끝난 한 틀 — 대화창 없이 0xa09c 의 끝 그림 (`useEventEndFrame`) */
function eventEndFrameOf({ state, session, previousScene }: SeasonBranchInput, playback: EventPlayback): ReactNode {
  const kind = endFrameKindOf(previousScene, playback.eventId)
  return (
    <RawScreen>
      <SeasonEventEndFrame
        record={state.record}
        teamMorale={session.statusBoardMorale}
        gamePoint={session.gamePoints}
        kind={kind}
        cursor={session.menuCursors.management}
      />
    </RawScreen>
  )
}

// 이벤트 재생 0xd3 (갱신 0x5110 · 키 0x90ec · 그리기 0xa09c → 대화창 0x8b5ac).
// 대화창 0x8b5ac 가 공 무늬 · 상태판(둘째 인자 [이벤트+0xb]) · 머리띠를 먼저 깐다 (`SeasonEventUnderlay`).
// 상태판 사기는 0x1f570(SR[1]) +2 를 그때 읽어 국가대항전 461 이면 상대국 슬롯 값이다 (`statusBoardMorale`)
// 지도 갈래([gfx+0x174] 0x70 · 0x71)가 아니므로 초상화 바닥 y 는 135 다(0x7fdee — `StoryScreen` 기본).
export function eventPlaybackBranch(input: SeasonBranchInput): ReactNode {
  const { scene, state, session, actions, random, gameSettings, eventEnd, goalSource } = input
  if (scene !== SEASON_SCENE_STATE.이벤트재생 || session.eventPlayback === null) return null
  const playback = session.eventPlayback
  const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
  if (event === undefined) return null
  if (eventEnd.isEnding) return eventEndFrameOf(input, playback)
  // 밑그림은 240×320 판(RawScreen) 안에, 대사창 덮개(ScreenOverlay)는 그 **형제**로 (나리 `CareerRoutes` 와 같다) —
  // 판 안에 넣으면 덮개 기둥의 zoom 이 판의 zoom 위에 한 번 더 걸려, 배율이 1 이 아닌 창(모바일 · 480 폭)에서 대사창이
  // 커지고 왼쪽 위로 밀려 글 첫머리 · 오른쪽 · 아랫줄이 잘렸다 (r157)
  return (
    <>
      <RawScreen>
        <SeasonEventUnderlay record={state.record} teamMorale={session.statusBoardMorale} gamePoint={session.gamePoints} />
      </RawScreen>
      <ScreenOverlay>
        <StoryScreen
          // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
          isVibrationOn={gameSettings.settings.isVibrationOn}
          // 0x8bab8 — 시즌모드(0x7b999)면 말하는 이 1 의 이름 머리말이 없다
          isSeasonMode
          key={playback.serial}
          events={SEASON_PLAYABLE_EVENTS}
          event={event}
          // 화자 1(플레이어)은 s_event 에 없다. fmt 9 의 %s 는 구단 이름(SR+0x17c)이다
          playerName={state.record.name}
          teamName={state.record.name}
          onComplete={eventEnd.end}
          // s_event 에는 경기(match) 명령이 없다
          onMatch={() => undefined}
          // SYS sub 1 올해의 목표 창 — 연초 0xd4 내장 이벤트 · 392 (0x8d304 → 0x86fdc, 0x8656c 모드 2 갈래)
          yearGoalWindowOf={() => ({ labelSet: SEASON_YEAR_GOAL_LABEL_SET, ...seasonGoalWindowNumbersFor(goalSource) })}
          // SYS sub 3 · 4 — 시상 370 · 371 의 타이틀 창 0x8b3bc · 376 의 MVP 창 0x8b23c (시즌 갈래)
          systemWindowTextOf={(command) => session.awardWindowTextOf(command.sub)}
          // 보상 명령 7 의 알림 창 — 0x8beb8 글(모드 2 갈래) → 0x74ef4 종류 1. 종류 11(490)은 글이 굴린다
          rewardNoticeContext={() => seasonRewardNoticeContextOf(state.record, random)}
          // system 창 답 0 → 0x7fe90 (기록 +0x187 = 1 · 저장)
          onSystemWindowConfirm={actions.confirmEventSystemWindow}
          // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460 모드 2)
          onReward={actions.giveSeasonEventReward}
          // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
          onChoiceConfirm={actions.confirmSeasonEventChoice}
        />
      </ScreenOverlay>
    </>
  )
}
