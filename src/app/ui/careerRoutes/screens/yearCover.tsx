import type { ReactNode } from 'react'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { NARI_YEAR_START_EVENT } from '@/entities/story/model/storyScene'
import { NariYearCoverScreen, YearCoverResumeLeftFrame } from '@/pages/management/ui/NariYearCoverScreen'
import { YEAR_COVER_ENTRY_FRAMES, resumeCoverUnderlayAt } from '@/pages/management/lib/nariYearCover'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'
import { NariResumeManagementFrame } from '@/pages/management/ui/NariResumeManagementFrame'
import { nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { TEAMS } from '@/shared/config/original/teams'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

/** 이어하기 길 137 앞의 연초 114 — 재생기에 싣는 이벤트는 내장 연초 이벤트 하나다(0x8a681) */
const YEAR_START_EVENTS = [NARI_YEAR_START_EVENT] as const
/** 그 114 는 효과기 끝(9 틀째)에 끊긴다 — 재생이 끝나거나 경기를 거는 일은 없다 */
const ignoreEventEnd = () => {}

/** 이어하기 길의 앞 화면 한 틀 (`resumeCoverUnderlayAt`) */
function resumeCoverFrameAt({ career, gameSettings, mainCursor }: CareerScreenInput, statusBoard: ReactNode, frame: number): ReactNode {
  const underlay = resumeCoverUnderlayAt(frame)
  if (underlay === '앞판') return <YearCoverResumeLeftFrame frame={frame} />
  if (underlay === '관리')
    return <NariResumeManagementFrame career={career} cursor={nariMainCursorOnEntry(mainCursor.current, career.hasActedThisCycle, false)} />
  if (underlay === '상태판') return statusBoard
  // 연초 114 — 0x19e64 밑그림 위에 대화창 0x8b5ac(내장 이벤트 0x8a681 의 첫 say). 키는 장면 키 문이 버린다
  return (
    <>
      {statusBoard}
      <StoryScreen
        events={YEAR_START_EVENTS}
        event={NARI_YEAR_START_EVENT}
        playerName={career.name}
        teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
        skinIndex={career.skinIndex}
        battingTypeIndex={career.battingTypeIndex}
        isVibrationOn={gameSettings.settings.isVibrationOn}
        onComplete={ignoreEventEnd}
        onMatch={ignoreEventEnd}
        isInputLocked
      />
    </>
  )
}

/** 표지 밑에 아홉 틀 도는 앞 화면 — 이어하기 길 · 114 끝(상태판) · 그 밖은 없음 */
function previousScreenAtOf(input: CareerScreenInput, screen: ScreenOf<'연차표지'>, statusBoard: ReactNode) {
  if (screen.fromResume === true) return (frame: number) => resumeCoverFrameAt(input, statusBoard, frame)
  if (input.previousKind === '이벤트') return () => statusBoard
  return undefined
}

export function yearCoverScreenOf(input: CareerScreenInput, screen: ScreenOf<'연차표지'>): ReactNode {
  const { career, backToManagement } = input
  /*
   * 앞 화면 아홉 틀 — 원본은 앞 상태가 매 틀 그리기를 돈다(멈춘 판이 아니다). 114 끝(0x1c014 의 끝남 갈래가 0x1b768 을 부르고
   * 상태를 안 바꾼다)은 0x19e64 → 0x19da4 = 상태판 0x7d34c(gfx, 0) · 머리띠(커맨드 줄은 앞 상태가 105 가 아니라 칸 수 0)로,
   * 상태판은 새 시즌이 고친 S(소지금 S+2 · 연차)를 읽는다. 이어하기 길은 `resumeCoverUnderlayAt`.
   * 134 대진판 · 141 엔딩은 그 화면이 선 채 아홉 틀을 돌고(`YearCoverHoldLayer`) 표지는 그다음 틀부터 선다(`afterHold`)
   */
  const statusBoard = <NariEventUnderlay career={career} />
  const previousScreenAt = previousScreenAtOf(input, screen, statusBoard)
  // 새 시즌 처리 뒤라 S+0xb3(= season − 1)은 이미 새 연차 idx 다
  return (
    <NariYearCoverScreen
      yearIndex={career.season - 1}
      onDone={backToManagement}
      previousScreenAt={previousScreenAt}
      {...(screen.afterHold === true ? { startFrame: YEAR_COVER_ENTRY_FRAMES } : {})}
    />
  )
}
