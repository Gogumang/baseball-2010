import { useState } from 'react'
import type { ReactNode } from 'react'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import { generalPrepPushDirectionOf } from '@/pages/general-mode/lib/generalPrepPush'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import { hiddenTeamHintMessage } from '@/pages/general-mode/lib/hiddenTeam'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { MessageBox } from '@/shared/ui'
import { NariScreenPush } from './generalModeScreen/otherSlices'
import type { GeneralModeScreenProps } from './generalModeScreen/generalModeScreenProps'
import { generalModeOptionsOf } from './generalModeScreen/generalModeOptions'
import { GeneralModePlaying } from './generalModeScreen/GeneralModePlaying'
import { GeneralModeResume } from './generalModeScreen/GeneralModeResume'
import { withLiveGameInning } from './generalModeScreen/liveGameInning'
import { EntryStep, MatchInfoStep } from './generalModeScreen/MatchInfoSteps'
import { AceStep, FirstBatStep, TeamSelectStep } from './generalModeScreen/PrepareSteps'
import { prepPushViewOf, usePreviousView } from './generalModeScreen/prepareViews'

export type { GeneralModeScreenProps } from './generalModeScreen/generalModeScreenProps'

/**
 * **일반모드(원본 게임 모드 1) 한 판** — 메인 메뉴 하위 상태 18 → 19 → 20 → 21 → 22 → 경기 장면 0x104.
 *
 * ```
 * 18 유저 팀 고르기 (목록 k=0) → 19 AI 팀 고르기 (k=1) → 20 선공/구장 (k=3)
 * → 21 마선수 고르기 (k=2)     → 22 경기정보 (k=4)     → 경기
 * ```
 * 빠른실행이면 1~6 단계를 건너뛰고 22 로 바로 들어간다 (StrHOWTO[6] · J-2).
 *
 * 팀 고르기 두 장은 **나만의리그가 쓰던 화면을 그대로 빌려 쓴다** (`pages/create-player` 의
 * `TeamSelectScreen` — 원본도 공용 목록 0x63b15 의 k 만 다른 같은 화면이다).
 * 잠긴 히든 팀에서 OK 하면 힌트 팝업(`hiddenTeamHintMessage` — 18: 0x29d74 · 0x29d8a, 19: 0x29bfe · 0x29c14)만 뜨고
 * 단계는 그대로다.
 */
export function GeneralModeScreen(props: GeneralModeScreenProps) {
  const live = withLiveGameInning(props)
  if (live.resumeGame !== undefined) return <GeneralModeResume {...live} resumeGame={live.resumeGame} />
  return <GeneralModePrepare {...live} />
}

/** 상태 22 의 보이는 것 — 경기 중 · 22 밖이면 null, 엔트리 편집이면 '23' */
function matchViewOf(isPlaying: boolean, step: number, isEntryEditing: boolean): string | null {
  if (isPlaying || step !== GENERAL_MODE_STEP.경기정보) return null
  return isEntryEditing ? '23' : '22'
}

function GeneralModePrepare(props: GeneralModeScreenProps) {
  const { openedHiddenTeamIds, gamePoint, onExit } = props
  /** 18 · 19 에서 잠긴 히든 팀 OK — 힌트 팝업 글 (팝업 0x74ef5). 없으면 null */
  const [hiddenHint, setHiddenHint] = useState<string | null>(null)
  const showHiddenHint = (teamId: number) =>
    setHiddenHint(hiddenTeamHintMessage(teamId, { openedHiddenIds: openedHiddenTeamIds ?? [], mode: TEAM_GAME_MODE.일반 }))
  const hiddenHintOverlay = hiddenHint !== null && <MessageBox text={hiddenHint} buttons={['확인']} onAnswer={() => setHiddenHint(null)} />

  const session = useGeneralMode(generalModeOptionsOf(props))
  const { flow, actions } = session
  /**
   * 22 그림 0x2e0c4 의 0x63b15 넷째 인자 = `[메뉴+0x28] ≠ 0x17` — 이전 상태가 23(엔트리 편집)이 아니면 머리띠 미끄러짐 ·
   * 본문 숨김 · 배너 연출을 켠다 (모드 1 · 8 · 9 두 갈래 모두, 0x2e0ee~0x2e11a · 0x2e16a~). `pages/management/lib/matchInfoEntry`.
   */
  const isMatchInfoEntryAnimated = usePreviousView(matchViewOf(session.isPlaying, flow.step, session.entryEdit !== null)) !== '23'
  /**
   * 18 · 19 그림(0x2de3c · 0x2ddb0)의 0x63b15 넷째 인자 = `[메뉴+0x28] ≠ 0x13` · `≠ 0x12` — 상대 팀 고르기에서 넘어왔으면 0 이라
   * 0x63bd8~0x63be0 이 머리띠 미끄러짐([skin+0x84]) · 격자 열림 애니([skin+0xe8])를 끈다 (2de7e · 2ddf2, r333)
   */
  const previousStep = usePreviousView<number>(flow.step)
  /** 준비 단계 취소 — 18 · 빠른실행 22 의 CLR 은 게임시작 목록(하위 5)으로 (0x29d9a · 0x313c4) */
  const cancelPrepare = () => onExit(5)
  const back = () => {
    if (!actions.back()) cancelPrepare()
  }

  if (session.isPlaying) return <GeneralModePlaying props={props} options={session.gameOptions} />

  const wrap = (content: ReactNode) => (
    <NariScreenPush view={prepPushViewOf(flow.step, session.entryEdit)} directionOf={generalPrepPushDirectionOf}>
      {content}
    </NariScreenPush>
  )
  switch (flow.step) {
    case GENERAL_MODE_STEP.유저팀:
    case GENERAL_MODE_STEP.AI팀:
      return wrap(
        <TeamSelectStep
          props={props}
          isUserStep={flow.step === GENERAL_MODE_STEP.유저팀}
          previousStep={previousStep}
          actions={actions}
          onSelectLocked={showHiddenHint}
          onCancelPrepare={cancelPrepare}
          onBack={back}
          overlay={hiddenHintOverlay}
        />,
      )
    case GENERAL_MODE_STEP.선공구장:
      return wrap(<FirstBatStep props={props} flow={flow} actions={actions} onCancel={back} />)
    case GENERAL_MODE_STEP.마선수:
      return wrap(<AceStep props={props} flow={flow} actions={actions} onCancel={back} />)
    default:
      if (session.entryEdit !== null) return wrap(<EntryStep session={session} entryEdit={session.entryEdit} gamePoint={gamePoint} />)
      return wrap(<MatchInfoStep session={session} isEntryAnimated={isMatchInfoEntryAnimated} gamePoint={gamePoint} onCancel={back} />)
  }
}
