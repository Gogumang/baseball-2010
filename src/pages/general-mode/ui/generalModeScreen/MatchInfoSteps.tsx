import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { TEAMS } from '@/shared/config/original/teams'
import type { GeneralModeEntryEdit, GeneralModeSession } from '@/pages/general-mode/model/useGeneralMode/generalModeTypes'
import { MatchInfoScreen } from '@/pages/general-mode/ui/MatchInfoScreen'
import { MatchSettingsWindow } from './otherSlices'

/** 상태 23 엔트리 편집 — 그리기 0x2e070 (엔트리 목록 창 0x5cfec + 머리띠 6/7), 키 0x2a370 → 0x55864 */
export function EntryStep({
  session,
  entryEdit,
  gamePoint,
}: {
  readonly session: GeneralModeSession
  readonly entryEdit: GeneralModeEntryEdit
  readonly gamePoint: number | undefined
}) {
  const { actions } = session
  return (
    <EntryEditorScreen
      editor={entryEdit.editor}
      lists={entryEdit.lists}
      teamName={`${TEAMS[entryEdit.teamId]?.name ?? ''} ${entryEdit.isUserTeam ? '(PLAYER)' : '(COM)'}`}
      isAceLocked={entryEdit.isAceLocked}
      {...(gamePoint === undefined ? {} : { gamePoint })}
      onKey={actions.pressEntryKey}
      onMoveCursor={actions.pointEntryCursor}
      onCloseAceLocked={actions.closeEntryAceLocked}
      // 메인 메뉴는 틀마다 0x2a370 → 0x55864 를 불러 키 셈 [ed+0x40c] 이 오른다 (▲▼ 깜빡 · 커서 꼴)
      onFrame={actions.frameEntry}
      ticksEveryFrame
      // 그림 0x2e070 도 22 진입이 떠 둔 구장 바탕(0x581dc(skin, [메뉴+0xb8], 0))을 먼저 깐다
      underlay={<MatchInfoStadiumBackdrop stage={session.matchInfoStage} />}
      // 23 진입 0x2648c 는 [skin+0x84] 를 안 세우고 그림 0x2e070 도 공용 목록 0x63b14 를 안 부른다
      slides={false}
    />
  )
}

interface MatchInfoStepProps {
  readonly session: GeneralModeSession
  readonly isEntryAnimated: boolean
  readonly gamePoint: number | undefined
  readonly onCancel: () => void
}

/** 상태 22 경기정보 (목록 k=4) — 설정 창이 열려 있으면 키가 모두 창으로 간다 (0x311a8 skin+0x2ba) — 시즌 0xdd 와 같은 창 0x6042c · 0x5ffcc 다 */
export function MatchInfoStep({ session, isEntryAnimated, gamePoint, onCancel }: MatchInfoStepProps) {
  const { flow, actions, isSettingsOpen } = session
  /** 설정 창이 닫혀 있을 때만 그 키를 받는다 */
  const unlessSettings = (run: () => void) => () => {
    if (!isSettingsOpen) run()
  }
  return (
    <>
      <MatchInfoScreen
        setup={flow.setup}
        isQuickStart={flow.isQuickStart}
        isEntryAnimated={isEntryAnimated}
        isSettingsOpen={isSettingsOpen}
        isRespinning={session.isRespinning}
        userStarterName={session.userStarterName}
        cpuMatchInfo={session.cpuMatchInfo}
        // 22 진입 0x314b0 → 0x5fd04 가 떠 둔 구장 바탕
        stage={session.matchInfoStage}
        // 머리띠 G포인트 — 전역 G(+0x64). 안 넘기면 0 으로 찍혔다
        {...(gamePoint === undefined ? {} : { gamePoint })}
        onStart={unlessSettings(actions.start)}
        onOpenSettings={unlessSettings(actions.openSettings)}
        onRespin={unlessSettings(actions.respin)}
        onCancel={unlessSettings(onCancel)}
        onOpenEntry={(isUserTeam) => {
          if (!isSettingsOpen) actions.openEntry(isUserTeam)
        }}
        settingsWindow={
          isSettingsOpen && <MatchSettingsWindow settings={session.settings} onConfirm={actions.applySettings} onClose={actions.closeSettings} />
        }
      />
    </>
  )
}
