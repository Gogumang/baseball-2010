import type { ReactNode } from 'react'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeSession } from '@/pages/general-mode/model/useGeneralMode/generalModeTypes'
import { AceSelectScreen } from '@/pages/general-mode/ui/AceSelectScreen'
import { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'
import { SkinBackdrop, TeamSelectScreen } from './otherSlices'
import type { GeneralModeScreenProps } from './generalModeScreenProps'

/** 19 진입 0x23e70 의 처음 칸 — 격자 x 0 · y 1(23eb2 · 23eb4), 폭 5 라 팀 5 */
const AI_TEAM_INITIAL_CURSOR = 5

interface TeamSelectStepProps {
  readonly props: GeneralModeScreenProps
  readonly isUserStep: boolean
  /** 바로 앞 단계 — 상대 팀 고르기에서 왔으면 들어옴 연출을 끈다 */
  readonly previousStep: number | null
  readonly actions: GeneralModeSession['actions']
  readonly onSelectLocked: (teamId: number) => void
  /** 18 취소는 게임시작 목록으로, 19 취소는 18 로 */
  readonly onCancelPrepare: () => void
  readonly onBack: () => void
  readonly overlay: ReactNode
}

/**
 * 18 · 19 는 다른 하위 상태라 들어설 때마다 새로 선다: 들어옴 0x23e08 · 0x23e70 이 목록 [메뉴+0x74] 커서를
 * vt+0x14(0, 0)(0x6c00c) 로 0 칸에 두고(19 는 이어서 (0, 1) = 팀 5 로 고쳐 쓴다 — 23eb2 · 23eb4), 그림 0x2de3c · 0x2ddb0 의
 * 공용 목록 0x63b14 가 상태 틱 0 인 첫 그림에서 넷째 인자대로 들어옴 연출을 다시 건다(상대 팀 고르기에서 왔으면 끈다 —
 * `isEntryAnimated`) — key 로 둘을 갈라 같은 화면을 이어 쓰지 않는다.
 * 19 는 ⚠️ 유저 팀과 같은 팀인지 보지 않는다 — 원본 그대로다 (R4 3a 상태 19)
 */
export function TeamSelectStep({ props, isUserStep, previousStep, actions, onSelectLocked, onCancelPrepare, onBack, overlay }: TeamSelectStepProps) {
  const { gamePoint } = props
  const otherTeamStep = isUserStep ? GENERAL_MODE_STEP.AI팀 : GENERAL_MODE_STEP.유저팀
  return (
    <TeamSelectScreen
      key={isUserStep ? '18' : '19'}
      title="팀선택"
      openedHiddenIds={props.openedHiddenTeamIds ?? []}
      {...(isUserStep ? {} : { initialCursor: AI_TEAM_INITIAL_CURSOR })}
      isEntryAnimated={previousStep !== otherTeamStep}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onSelect={isUserStep ? actions.selectUserTeam : actions.selectAiTeam}
      onSelectLocked={onSelectLocked}
      onCancel={isUserStep ? onCancelPrepare : onBack}
      overlay={overlay}
    />
  )
}

interface StepProps {
  readonly props: GeneralModeScreenProps
  readonly flow: GeneralModeFlowState
  readonly actions: GeneralModeSession['actions']
  readonly onCancel: () => void
}

/** 상태 20 선공/구장 (목록 k=3) */
export function FirstBatStep({ props, flow, actions, onCancel }: StepProps) {
  const { gamePoint } = props
  return (
    <FirstBatStadiumScreen
      userTeamId={flow.setup.userTeamId}
      aiTeamId={flow.setup.aiTeamId}
      phase={flow.firstBatPhase}
      // 선공 칸은 커서 skin+0x74 를 그린다 — 기록 rec+8 은 OK 때만 옮겨 적힌다
      playerSide={flow.firstBatCursor}
      stadiumId={flow.setup.stadiumId}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onMoveFirstBat={actions.moveFirstBat}
      onChooseFirstBat={actions.selectFirstBat}
      onMoveStadium={actions.moveStadium}
      onChooseStadium={actions.selectStadium}
      onCancel={onCancel}
    />
  )
}

/** 상태 21 마선수 고르기 (목록 k=2) */
export function AceStep({ props, flow, actions, onCancel }: StepProps) {
  const { openedAcePitcherIds, openedAceBatterIds, aceLevels, gamePoint, onOpenAce, onAllAcesOpen, onLevelUpAce } = props
  return (
    <AceSelectScreen
      phase={flow.acePhase}
      // rec+0xe — 마타자 단계에서 회색으로 안 그릴 마투수 칸 (0x7b1d8)
      chosenPitcherCell={flow.setup.acePitcherId}
      {...(openedAcePitcherIds === undefined ? {} : { openedAcePitcherIds })}
      {...(openedAceBatterIds === undefined ? {} : { openedAceBatterIds })}
      {...(aceLevels === undefined ? {} : { levels: aceLevels })}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      {...(onOpenAce === undefined ? {} : { onOpenAce })}
      {...(onAllAcesOpen === undefined ? {} : { onAllAcesOpen })}
      {...(onLevelUpAce === undefined ? {} : { onLevelUp: onLevelUpAce })}
      onSelect={actions.selectAce}
      onCancel={onCancel}
      // 그림 0x2dfe0 은 맨 앞(0x2e012)에서 공 무늬 바탕 0x5fd61(skin, 0, 0, W, H) 을 깐다
      underlay={<SkinBackdrop kind="공무늬" />}
    />
  )
}
