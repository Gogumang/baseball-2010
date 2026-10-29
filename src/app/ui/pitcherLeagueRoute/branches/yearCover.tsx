import type { ReactNode } from 'react'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'
import { PitcherResumeManagementFrame } from '@/pages/pitcher-league/ui/PitcherResumeManagementFrame'
import { nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { NariYearCoverScreen, YearCoverResumeLeftFrame } from '@/pages/management/ui/NariYearCoverScreen'
import { YEAR_COVER_ENTRY_FRAMES, resumeCoverUnderlayAt } from '@/pages/management/lib/nariYearCover'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { PITCHER_YEAR_START_EVENT } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { TEAMS } from '@/shared/config/original/teams'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

/** 이어하기 길 137 앞의 연초 114 — 재생기에 싣는 이벤트는 내장 연초 이벤트 하나다(0x8a681, 타자편과 같다) */
const PITCHER_YEAR_START_EVENTS = [PITCHER_YEAR_START_EVENT] as const
/** 그 114 는 효과기 끝(9 틀째)에 끊긴다 — 재생이 끝나거나 경기를 거는 일은 없다 */
const ignoreEventEnd = () => {}

/** 이어하기 길의 앞 화면 한 틀 (`resumeCoverUnderlayAt`) */
function resumeCoverFrameAt({ gameSettings, career, mainCursor }: PitcherBranchInput, statusBoard: ReactNode, frame: number): ReactNode {
  const underlay = resumeCoverUnderlayAt(frame)
  if (underlay === '앞판') return <YearCoverResumeLeftFrame frame={frame} />
  if (underlay === '관리')
    return <PitcherResumeManagementFrame career={career} cursor={nariMainCursorOnEntry(mainCursor.current, career.hasActedThisCycle, false)} />
  if (underlay === '상태판') return statusBoard
  // 연초 114 — 0x19e64 밑그림 위에 대화창 0x8b5ac(내장 이벤트 0x8a681 의 첫 say). 키는 장면 키 문이 버린다
  return (
    <>
      {statusBoard}
      <StoryScreen
        events={PITCHER_YEAR_START_EVENTS}
        event={PITCHER_YEAR_START_EVENT}
        playerName={career.name}
        teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
        skinIndex={career.skinIndex}
        battingTypeIndex={0}
        isVibrationOn={gameSettings.settings.isVibrationOn}
        onComplete={ignoreEventEnd}
        onMatch={ignoreEventEnd}
        isInputLocked
      />
    </>
  )
}

/** 표지 밑에 아홉 틀 도는 앞 화면 — 이어하기 길 · 114 끝(상태판) · 그 밖은 없음 */
function previousScreenAtOf(input: PitcherBranchInput, statusBoard: ReactNode) {
  if (input.session.yearCoverFromResume) return (frame: number) => resumeCoverFrameAt(input, statusBoard, frame)
  if (input.previousScene === '이벤트') return () => statusBoard
  return undefined
}

export function yearCoverBranch(input: PitcherBranchInput): ReactNode {
  const { session, career, scene, actions } = input
  if (scene !== '연차표지') return null
  // 앞 화면 아홉 틀은 앞 상태가 매 틀 그린다 — 114 끝은 0x19da4(상태판 · 머리띠, 새 시즌의 S), 이어하기 길은 `resumeCoverUnderlayAt`.
  // 134 대진판 · 141 엔딩은 그 화면이 선 채 아홉 틀을 돌고(`YearCoverHoldLayer`) 표지는 그다음 틀부터 — 타자편 `CareerRoutes` 와 같다
  const statusBoard = <PitcherEventUnderlay career={career} />
  const previousScreenAt = previousScreenAtOf(input, statusBoard)
  // 새 시즌 처리 뒤라 S+0xb3(= season − 1)은 이미 새 연차 idx 다 — 타자편과 같은 137
  return (
    <NariYearCoverScreen
      yearIndex={career.season - 1}
      onDone={() => actions.goto('관리')}
      previousScreenAt={previousScreenAt}
      {...(session.yearCoverAfterHold ? { startFrame: YEAR_COVER_ENTRY_FRAMES } : {})}
    />
  )
}
