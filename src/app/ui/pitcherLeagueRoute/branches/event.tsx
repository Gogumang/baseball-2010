import type { ReactNode } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { pitcherYearGoalWindowValuesOf } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { ScreenOverlay } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { judgePitcherSeasonAwards } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

type Story = NonNullable<PitcherBranchInput['session']['story']>
type StoryEvent = NonNullable<PitcherBranchInput['session']['storyEvents']>[number]

// 114 그림 0x19e64 → 대화창 0x8b5ac: [gfx+0x174] 가 0x70·0x71(112 · 113 · 140 진입)이면 외출 지도, 그 밖(105 · 115 ·
// 116 · 117 · 130~138 뒤)은 공 무늬 + 상태판 + 머리띠 (`PitcherEventUnderlay`) — 커맨드 줄은 없다.
function isOverStatusBoardContext(context: Story['context']): boolean {
  return context === '관리' || context === '중간평가' || context === '연초' || context === '연말'
}

// 지도(112) · 장소(113) · 대결결과(140) 뒤는 지도 0x7ea64(gfx, −1, 0) 만 — 선택 화살표 · 말풍선 · 머리띠 없음 (`OutingMapUnderlay`)
function isOverMapContext(context: Story['context']): boolean {
  return context === '지도' || context === '장소' || context === '대결결과'
}

// 재생이 끝난 한 틀 — 타자편과 같은 0x19e64: 앞 상태 112 · 113 만 지도, 그 밖(140 포함)은 0x19da4 = 공 무늬 · 상태판(0) ·
// 커맨드 줄(앞 상태 105 = '관리' 갈래만 관리 6칸, 그 밖 칸 수 0) · 머리띠 제목 9
function eventEndFrameOf({ session, career, mainCursor }: PitcherBranchInput, story: Story): ReactNode {
  if (story.context === '지도' || story.context === '장소') {
    return (
      <RawScreen>
        <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />
      </RawScreen>
    )
  }
  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      <PitcherStatusBoard career={career} />
      {story.context === '관리' && <NariMainCommandBar menuEnable={career} cursor={mainCursor.current} />}
      <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={null} footer={5} slides={false} />
    </RawScreen>
  )
}

function eventStoryOf(input: PitcherBranchInput, story: Story, events: readonly StoryEvent[], event: StoryEvent): ReactNode {
  const { session, random, gameSettings, career, actions, eventEnd } = input
  const isOverStatusBoard = isOverStatusBoardContext(story.context)
  const isOverMap = isOverMapContext(story.context)
  // 밑그림은 240×320 판(RawScreen) 안에, 대사창 덮개(ScreenOverlay)는 그 형제로 — 밑그림을 안 감싸면 창 왼쪽 위(−120, −240)에 어긋나 그려졌다
  return (
    <>
      <RawScreen>
        {isOverStatusBoard && <PitcherEventUnderlay career={career} />}
        {isOverMap && <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />}
      </RawScreen>
      <ScreenOverlay>
        <StoryScreen
          // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
          isVibrationOn={gameSettings.settings.isVibrationOn}
          // 초상화 바닥 y — [gfx+0x174] 0x70 · 0x71 이면 252, 그 밖 135 (0x7fdee)
          isOverOutingMap={isOverMap}
          key={`${story.context}:${event.id}`}
          events={events}
          event={event}
          playerName={career.name}
          teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
          skinIndex={career.skinIndex}
          battingTypeIndex={0}
          replacementsFor={session.storyReplacementsFor}
          onComplete={eventEnd.end}
          carried={story.carried}
          onMatch={actions.beginAceMatch}
          // 370·375 의 system 3·4 — 타이틀(0x8b3bc, 투수 문구 79~81 · 마무리 82)·MVP(0x8b23c) 발표 창 (130·131 과 같은 판정)
          systemWindowTextOf={(command) => awardWindowTextOf(command.sub, () => judgePitcherSeasonAwards(career))}
          // system 1 올해의 목표 창 — 연초 115 · 392 (0x8d304 → 0x86fdc)
          yearGoalWindowOf={() => pitcherYearGoalWindowValuesOf(career)}
          // 보상 명령 7 의 알림 창 — 0x8beb8 글 → 0x74ef4 종류 1 · 첫 종류 4 는 스킬 창 0x741a0 (모드 3 투수편)
          rewardNoticeContext={() => rewardNoticeContextOf(career, PITCHER_LEAGUE_MODE, random)}
          // system 창 답 0 → 0x7fe90 (S+0x1b7 = 1 · 저장)
          onSystemWindowConfirm={actions.confirmEventSystemWindow}
          // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460)
          onReward={actions.giveStoryReward}
          // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
          onChoiceConfirm={actions.confirmStoryChoice}
        />
      </ScreenOverlay>
    </>
  )
}

export function eventBranch(input: PitcherBranchInput): ReactNode {
  const { session, scene } = input
  if (scene !== '이벤트' || session.story === null) return null
  const { story } = session
  const event = session.storyEvents?.find((candidate) => candidate.id === story.eventId)
  // 이벤트 본문이 오기 전에는 다음 갈래(끝내 관리 화면)로 넘긴다
  if (session.storyEvents === null || event === undefined) return null
  if (input.eventEnd.isEnding) return eventEndFrameOf(input, story)
  return eventStoryOf(input, story, session.storyEvents, event)
}
