import type { ReactNode } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { isBattingOrderEventId } from '@/entities/career/model/battingOrder'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { TEAMS } from '@/shared/config/original/teams'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { yearGoalWindowValuesOf } from '@/entities/career/model/seasonFlow'
import { careerLeagueRecordsOf, judgeSeasonAwards } from '@/entities/awards/model/seasonAwards'
import { managementOf } from '@/app/ui/careerRoutes/managementScreen'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

type StoryEvent = NonNullable<CareerScreenInput['session']['storyEvents']>[number]

// 114 그림 0x19e64 → 대화창 0x8b5ac: [gfx+0x174](0x7e84c 가 받은 마지막 상태)가 0x70·0x71 이면 외출 지도,
// 그 밖(105 · 115 · 116 · 117 · 130~138 뒤)은 공 무늬 + 상태판(둘째 인자 [이벤트+0xb]) + 머리띠 (`NariEventUnderlay`).
// 웹이 트는 이벤트는 파일 이벤트라 [이벤트+0xb] 는 0 이다(경기 뒤 평가 내장 이벤트는 경기평가 화면이 맡는다).
// 외출진입(112) · 장소(113) · 대결결과(140 — 진입 0x10df8 이 0x7e84c(gfx, 0x70))는 지도 0x7ea64(gfx, −1, 0) 만 (`OutingMapUnderlay`).
// 같은 [gfx+0x174] 가 초상화 바닥 y 도 고른다(0x7fdee — 지도 252 · 그 밖 135).
function isOverOutingMapContext(context: ScreenOf<'이벤트'>['context']): boolean {
  return context === '외출진입' || context === '장소' || context === '대결결과'
}

/** 상태판 밑그림을 까는 맥락 — 105 · 115 · 연초 · 시즌 쪽 */
function isStatusBoardContext(context: ScreenOf<'이벤트'>['context']): boolean {
  return context === '관리' || context === '연초' || context === '시즌'
}

// 재생이 끝난 한 틀(`useEventEndFrame`) — 0x19e64 는 앞 상태 [this+0x28] 가 112 · 113 일 때만 지도다. 140(대결결과)은 앞 상태가
// 0x8c 라 지도가 아니라 0x19da4 를 그린다(재생 중 지도는 [gfx+0x174] = 0x70 탓). 커맨드 줄 칸은 앞 상태가 105 일 때만
// (0x7e84c(0x69) 의 관리 6칸 — '관리' 갈래, 138 을 거친 타순 이벤트는 빼고), 그 밖은 칸 수 0 이라 안 그린다
function eventEndFrameOf({ session, career, mainCursor }: CareerScreenInput, screen: ScreenOf<'이벤트'>): ReactNode {
  if (screen.context === '외출진입' || screen.context === '장소') {
    return (
      <RawScreen>
        <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />
      </RawScreen>
    )
  }
  return (
    <RawScreen>
      <NariEventUnderlay career={career}>
        {screen.context === '관리' && !isBattingOrderEventId(screen.eventId) && (
          <NariMainCommandBar menuEnable={career} cursor={mainCursor.current} />
        )}
      </NariEventUnderlay>
    </RawScreen>
  )
}

function eventStoryOf(input: CareerScreenInput, screen: ScreenOf<'이벤트'>, events: readonly StoryEvent[], event: StoryEvent): ReactNode {
  const { session, random, career, onAceMatch, gameSettings, actions, eventEnd } = input
  const isOverOutingMap = isOverOutingMapContext(screen.context)
  // 밑그림은 240×320 판(RawScreen) 안에, 대사창 덮개(ScreenOverlay)는 그 형제로 — 밑그림을 안 감싸면 창 왼쪽 위(−120, −240)에 어긋나 그려졌다
  return (
    <>
      <RawScreen>
        {isStatusBoardContext(screen.context) && <NariEventUnderlay career={career} />}
        {isOverOutingMap && <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />}
        {/* 대사창은 화면 **위에 얹히는 덮개**다 — 안 감싸면 창 전체로 퍼져 구석에 그려진다 */}
      </RawScreen>
      <ScreenOverlay>
        <StoryScreen
          // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
          isVibrationOn={gameSettings.settings.isVibrationOn}
          isOverOutingMap={isOverOutingMap}
          key={event.id}
          events={events}
          event={event}
          playerName={career.name}
          teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
          skinIndex={career.skinIndex}
          battingTypeIndex={career.battingTypeIndex}
          onComplete={eventEnd.end}
          carried={screen.carried}
          onMatch={(command, carried) => onAceMatch(command, carried, screen.context)}
          // 370·375 의 system 3·4 — 타이틀(0x8b3bc)·MVP(0x8b23c) 발표 창. 130·131 과 같은 판정(0x8dad4 타자 · 0x8dd60)이다
          systemWindowTextOf={(command) => awardWindowTextOf(command.sub, () => judgeSeasonAwards(career, careerLeagueRecordsOf(career), '타자'))}
          // system 1 올해의 목표 창 — 연초 115 · 392 (0x8d304 → 0x86fdc)
          yearGoalWindowOf={() => yearGoalWindowValuesOf(career)}
          // 보상 명령 7 의 알림 창 — 0x8beb8 글 → 0x74ef4 종류 1 · 첫 종류 4 는 스킬 창 0x741a0 (모드 4 타자편)
          rewardNoticeContext={() => rewardNoticeContextOf(career, BATTER_LEAGUE_MODE, random)}
          // system 창 답 0 → 0x7fe90 (S+0x1b7 = 1 · 저장)
          onSystemWindowConfirm={actions.confirmEventSystemWindow}
          // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460)
          onReward={actions.giveEventReward}
          // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
          onChoiceConfirm={actions.confirmEventChoice}
        />
      </ScreenOverlay>
    </>
  )
}

export function eventScreenOf(input: CareerScreenInput, screen: ScreenOf<'이벤트'>): ReactNode {
  const { session } = input
  const event = session.storyEvents?.find((candidate) => candidate.id === screen.eventId)
  if (session.storyEvents === null || event === undefined) return managementOf(input)
  if (input.eventEnd.isEnding) return eventEndFrameOf(input, screen)
  return eventStoryOf(input, screen, session.storyEvents, event)
}
