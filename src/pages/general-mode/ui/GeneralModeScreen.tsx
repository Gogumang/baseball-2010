import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import { AceSelectScreen } from '@/pages/general-mode/ui/AceSelectScreen'
import { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'
import type { StadiumEntry } from '@/pages/general-mode/ui/FirstBatStadiumScreen'
import { MatchInfoScreen } from '@/pages/general-mode/ui/MatchInfoScreen'
import { MatchSettingsWindow } from '@/pages/general-mode/ui/MatchSettingsWindow'

export interface GeneralModeScreenProps {
  readonly random: RandomPort
  /** 메인 메뉴에서 **빠른실행**을 잡고 들어왔는가 */
  readonly isQuickStart?: boolean
  /** 전역 기록 +0x70+idx 가 켜진 히든 팀 번호 10~14 */
  readonly openedHiddenTeamIds?: readonly number[]
  /** 저장 +0x30..0x34 — 열린 마투수 0~4 */
  readonly openedAcePitcherIds?: readonly number[]
  /** 저장 +0x35..0x39 — 열린 마타자 0~4 */
  readonly openedAceBatterIds?: readonly number[]
  /** 마선수 레벨 (격자 칸 번호 → 레벨). 없으면 이름만 나온다 */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 들고 있는 G포인트 (원본은 전역 기록 `mgr+0x64`, 웹판은 육성 선수 칸).
   * 마선수 오픈 값과 머리띠 숫자가 이것을 본다.
   */
  readonly gamePoint?: number
  /** 마선수 한 칸을 G로 열었다 (0xa3f6) — 받는 쪽이 G를 빼고 오픈 플래그를 세운다 */
  readonly onOpenAce?: (cell: number) => void
  /** 구장 표 — 도시명 0xd1df8 · 수용 인원 0xd1e34 (웹판 데이터에 아직 없다) */
  readonly stadiums?: readonly StadiumEntry[]
  /** 저장에서 읽은 경기진행 설정 (모드 칸 0) */
  readonly initialSettings?: MatchProgressSettings
  /** 환경설정 "투구 게이지" */
  readonly gaugeSettingOn?: boolean
  /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) — 사람이 공격일 때만 먹는다 (0xae690) */
  readonly runningModeManual?: boolean
  /** 환경설정 "송구" 가 수동인가 (설정 +0xf4) — 사람이 수비일 때만 먹는다 (0xae6c8) */
  readonly throwModeManual?: boolean
  /** 경기가 끝나고 확인을 눌렀을 때 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /**
   * 준비 첫 화면에서 CLR, 또는 경기 중 메뉴에서 나가기.
   * 원본은 메인 메뉴 하위 상태 5(모드 목록)로 돌아간다.
   */
  readonly onExit: () => void
}

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
 *
 * ⚠️ **못 옮긴 것**: 잠긴 히든 팀을 눌렀을 때의 힌트 팝업(StrMODE[225] + [216+팀] + [0]).
 *    `TeamSelectScreen` 은 잠긴 칸을 누르면 커서만 옮기고 바깥에 알리지 않아 여기서 팝업을 띄울
 *    길이 없다. 문구를 만드는 함수는 `lib/hiddenTeam.ts` 의 `hiddenTeamHintMessage` 에 있다.
 */
export function GeneralModeScreen(props: GeneralModeScreenProps) {
  const {
    random, isQuickStart = false, openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds,
    aceLevels, gamePoint, onOpenAce, stadiums, initialSettings, gaugeSettingOn, runningModeManual,
    throwModeManual, onFinish, onExit,
  } = props

  const session = useGeneralMode({
    random,
    isQuickStart,
    ...(openedHiddenTeamIds === undefined ? {} : { openedHiddenTeamIds }),
    ...(openedAcePitcherIds === undefined ? {} : { openedAcePitcherIds }),
    ...(openedAceBatterIds === undefined ? {} : { openedAceBatterIds }),
    ...(initialSettings === undefined ? {} : { initialSettings }),
    ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
    ...(runningModeManual === undefined ? {} : { runningModeManual }),
    ...(throwModeManual === undefined ? {} : { throwModeManual }),
  })
  const { flow, actions } = session
  const back = () => {
    if (!actions.back()) onExit()
  }

  if (session.isPlaying) {
    return (
      <TeamGameScreen
        options={session.gameOptions}
        random={random}
        onFinish={onFinish}
        onQuit={onExit}
      />
    )
  }

  switch (flow.step) {
    case GENERAL_MODE_STEP.유저팀:
      return (
        <TeamSelectScreen
          title="팀선택"
          openedHiddenIds={openedHiddenTeamIds ?? []}
          onSelect={actions.selectUserTeam}
          onCancel={onExit}
        />
      )
    case GENERAL_MODE_STEP.AI팀:
      return (
        <TeamSelectScreen
          title="팀선택"
          openedHiddenIds={openedHiddenTeamIds ?? []}
          // ⚠️ 유저 팀과 같은 팀인지 보지 않는다 — 원본 그대로다 (R4 3a 상태 19)
          onSelect={actions.selectAiTeam}
          onCancel={back}
        />
      )
    case GENERAL_MODE_STEP.선공구장:
      return (
        <FirstBatStadiumScreen
          userTeamId={flow.setup.userTeamId}
          aiTeamId={flow.setup.aiTeamId}
          phase={flow.firstBatPhase}
          playerSide={flow.setup.playerSide}
          stadiumId={flow.setup.stadiumId}
          {...(stadiums === undefined ? {} : { stadiums })}
          onMoveFirstBat={actions.moveFirstBat}
          onChooseFirstBat={actions.selectFirstBat}
          onMoveStadium={actions.moveStadium}
          onChooseStadium={actions.selectStadium}
          onCancel={back}
        />
      )
    case GENERAL_MODE_STEP.마선수:
      return (
        <AceSelectScreen
          phase={flow.acePhase}
          {...(openedAcePitcherIds === undefined ? {} : { openedAcePitcherIds })}
          {...(openedAceBatterIds === undefined ? {} : { openedAceBatterIds })}
          {...(aceLevels === undefined ? {} : { levels: aceLevels })}
          {...(gamePoint === undefined ? {} : { gamePoint })}
          {...(onOpenAce === undefined ? {} : { onOpenAce })}
          onSelect={actions.selectAce}
          onCancel={back}
        />
      )
    default:
      return (
        <>
          <MatchInfoScreen
            setup={flow.setup}
            isQuickStart={flow.isQuickStart}
            onStart={actions.start}
            onOpenSettings={actions.openSettings}
            onRespin={actions.respin}
            onCancel={back}
          />
          {session.isSettingsOpen && (
            <MatchSettingsWindow
              settings={session.settings}
              onConfirm={actions.applySettings}
              onCancel={actions.closeSettings}
            />
          )}
        </>
      )
  }
}
