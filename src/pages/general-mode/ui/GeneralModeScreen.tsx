import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import type { TeamGameProgress, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { XLS_ROW_MATCHUP_RECORDS } from '@/pages/team-game/lib/teamMatchupCards'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import { generalPrepPushDirectionOf } from '@/pages/general-mode/lib/generalPrepPush'
import type { GeneralPrepPushView } from '@/pages/general-mode/lib/generalPrepPush'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import type { MatchSettingsSeenSlot } from '@/pages/general-mode/model/useGeneralMode'
import { AceSelectScreen } from '@/pages/general-mode/ui/AceSelectScreen'
import { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'
import { MatchInfoScreen } from '@/pages/general-mode/ui/MatchInfoScreen'
import { MatchSettingsWindow } from '@/pages/match-settings'
import { hiddenTeamHintMessage } from '@/pages/general-mode/lib/hiddenTeam'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import { MessageBox } from '@/shared/ui'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { TEAMS } from '@/shared/config/original/teams'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'

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
  /**
   * 마선수 레벨 (격자 칸 번호 → 레벨 0~4, 전역 `mgr[0x13a+칸]`). 없으면 모두 0 = LV.1.
   * 이름 막대 LV 와 경기 속 마선수 능력치 배율·상대 마투수 마구 횟수가 함께 본다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /** 마선수 고르기의 `0` 키 레벨업 확정 (0x5fbee) — 받는 쪽이 레벨을 올리고 G `cost` 를 뺀다 */
  readonly onLevelUpAce?: (cell: number, cost: number) => void
  /**
   * 들고 있는 G포인트 (원본은 전역 기록 `mgr+0x64`, 웹판은 육성 선수 칸).
   * 마선수 오픈 값과 머리띠 숫자, 그리고 경기 정산 판의 "보유 GP"(0x4ae2e `[0x1f1d9()+0x64]`)가 이것을 본다 —
   * 정산 진입 0x4ea0c 가 번 G 를 먼저 더하고(4ec5a) 판을 그리므로, 받는 쪽이 `onSettlementEnter` 에서 더한 값이 그대로 보인다.
   */
  readonly gamePoint?: number
  /**
   * 경기 중 메뉴 **자동진행** [예] — 받는 쪽이 전역 G(+0x64)에서 값을 뺀다. 원본 0x3c7ee~0x3c84e: 비용은 모드 8·9 만 100,
   * 그 밖(모드 1 포함) 30 이고, 보유 G < 비용이면 StrGAME[5] 알림으로 끝(화면이 먼저 막는다), 아니면 G += −비용 을
   * [0, 99999] 로 자른다. 이어 0x3c850~0x3c8d6 이 **모드 2 만 k3(시즌), 8·9 만 k4(대전)** 로 소모 통계 `0x22c29` 에 적고
   * 모드 1 은 아무 칸에도 적지 않는다 — 그래서 받는 쪽은 G 만 뺀다. 없으면 자동진행 칸이 잠긴다
   */
  readonly onSpendGamePoint?: (cost: number) => void
  /**
   * 환경설정 값 · 바꾸기 — 경기 중 메뉴 하위 4 "환경설정"(일시정지 팝업 0x741a0)이 연다. 시즌(`SeasonRoute`)과 같은 손잡이다.
   * 없으면 그 칸이 잠긴다
   */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /** 마선수 한 칸을 G로 열었다 (0xa3f6) — 받는 쪽이 G를 빼고 오픈 플래그를 세운다 */
  readonly onOpenAce?: (cell: number) => void
  /** 상태 21 마선수 격자(종류 7)가 서 있는 동안 열 칸이 다 열렸으면 — 히든 팀 외인구단 12 (0x7b408, `AceSelectScreen`) */
  readonly onAllAcesOpen?: () => void
  /**
   * 전역기록의 경기진행 설정 (모드 칸 m = 0) — 설정 창이 열 때 읽고(0x5fef4), 경기 · **이어하기 경기**가 이 값으로 사람 타석을
   * 가른다(0xc1e04 는 타석마다 전역 칸을 읽는다)
   */
  readonly initialSettings?: MatchProgressSettings
  /** 설정 창 확인 0x60376 — 받는 쪽이 전역 m = 0 칸에 되쓰고 저장한다 */
  readonly onMatchSettingsConfirm?: (settings: MatchProgressSettings) => void
  /** 전역기록 +0x11e — 22 에 처음 들어오면 설정 창을 저절로 연다(0x3163c~0x31688, 시즌 0xdd 와 같은 칸) */
  readonly matchSettingsSeen?: MatchSettingsSeenSlot
  /** 환경설정 "투구 게이지" */
  readonly gaugeSettingOn?: boolean
  /** 환경설정 "주루" 가 수동인가 (설정 +0xbd) — 사람이 공격일 때만 먹는다 (0xae690) */
  readonly runningModeManual?: boolean
  /** 환경설정 "송구" 가 수동인가 (설정 +0xf4) — 사람이 수비일 때만 먹는다 (0xae6c8) */
  readonly throwModeManual?: boolean
  /** 경기가 끝나고 확인을 눌렀을 때 */
  readonly onFinish: (summary: TeamGameSummary) => void
  /**
   * **이어하기로 들어왔다** — 모드 1 저장 블록에서 읽은 진행. 있으면 준비 화면(18~22) 없이 곧바로 경기 장면으로 간다
   * (메인 메뉴 [13]/[최근게임] → 상태 0x27 → 0x327b8 → 0x213c0(앱, 1, 0) → 장면 0x104).
   */
  readonly resumeGame?: TeamGameProgress
  /**
   * **경기정보 OK** (0x3136e) — 새 경기의 첫 저장. 받는 쪽이 +0x3c = 1 · +0x4d = 1 · 블록 = 이 진행을 쓴다.
   */
  readonly onGameStart?: (save: TeamGameProgress) => void
  /**
   * **블록만 고쳐 쓴다** — 반 이닝 자동 저장(0x4f928 → 0x22754, 이어하기 경기도 같다), 그리고 경기정보 22 들어옴·재굴림 끝의
   * 0x30f20 과 엔트리 편집 23 나감의 0x2a370(둘 다 0x22755) — OK 없이 나가도 블록은 새 경기로 바뀐다(원본 그대로)
   */
  readonly onGameSave?: (save: TeamGameProgress) => void
  /**
   * **정산 진입** (0x4ea0c) — 받는 쪽이 이 자리에서 정산(기록 달성 G · 통계)을 하고 +0x4d 를 지운다(0x4f3d6).
   * `onFinish` 는 그 뒤 결과 화면 확인이다
   */
  readonly onSettlementEnter?: (summary: TeamGameSummary) => void
  /**
   * 메인 메뉴로 나간다. `openTier` 5 = 게임시작 목록(하위 5)으로 바로 — **준비 단계 취소**만 이 값이다:
   * 18 의 CLR(0x29d9a `bcb49(메뉴+0x18, 5)`) · 빠른실행 22 의 CLR(0x313c4 `movs r1, #5`) 은 같은 장면 0x103 안에서
   * 곧장 하위 5 로 간다. 경기 중 메뉴 "나가기"(0x40140)는 인자 없이 — 메인 메뉴 처음 단(하위 4)이다.
   */
  readonly onExit: (openTier?: 5) => void
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
 * 잠긴 히든 팀에서 OK 하면 힌트 팝업(`hiddenTeamHintMessage` — 18: 0x29d74 · 0x29d8a, 19: 0x29bfe · 0x29c14)만 뜨고
 * 단계는 그대로다.
 */
/** 19 진입 0x23e70 의 처음 칸 — 격자 x 0 · y 1(23eb2 · 23eb4), 폭 5 라 팀 5 */
const AI_TEAM_INITIAL_CURSOR = 5

export function GeneralModeScreen(props: GeneralModeScreenProps) {
  const live = withLiveGameInning(props)
  if (live.resumeGame !== undefined) return <GeneralModeResume {...live} resumeGame={live.resumeGame} />
  return <GeneralModePrepare {...live} />
}

/**
 * **전역 경기 상태 +0x6b** (`liveGameState`) — 경기 장면이 이닝을 넘길 때(0xb6b6c) 지금 이닝을 적는다. 반 이닝 저장(0x4f928)이
 * 그 뒤라 저장이 오는 때의 이닝이 곧 이 칸이고, 경기 중 나가기(0x40140)는 이 칸을 안 지워 나간 그 이닝이 남는다.
 * 경기 끝(정산 진입 · 결과 확인)은 끝 이닝. 0 으로 두는 자리는 상태 22 의 0x30f20(`useGeneralMode`)이다.
 */
/** 경기 끝 측별 팀 +0x28 · 점수 +0x7e (`setLiveGameSides`) — 요약에 측이 없으면(손으로 만든 요약) 건드리지 않는다 */
function setSummarySides(summary: TeamGameSummary): void {
  const playerSide = summary.playerSide
  if (playerSide !== undefined) setLiveGameSides(liveGameSidesOf(summary, { ...summary, playerSide }))
}

function withLiveGameInning(props: GeneralModeScreenProps): GeneralModeScreenProps {
  const { onGameStart, onGameSave, onSettlementEnter, onFinish } = props
  return {
    ...props,
    onGameStart: (save) => {
      setLiveGameInningIndex(save.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(save.options, save.game))
      onGameStart?.(save)
    },
    onGameSave: (save) => {
      setLiveGameInningIndex(save.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(save.options, save.game))
      onGameSave?.(save)
    },
    ...(onSettlementEnter === undefined
      ? {}
      : {
          onSettlementEnter: (summary: TeamGameSummary) => {
            setLiveGameInningIndex(summary.inningsPlayed - 1)
            setSummarySides(summary)
            onSettlementEnter(summary)
          },
        }),
    onFinish: (summary) => {
      setLiveGameInningIndex(summary.inningsPlayed - 1)
      setSummarySides(summary)
      onFinish(summary)
    },
  }
}

/**
 * **이어하기 경기** — 저장 블록의 진행에서 장면 0x104 를 다시 세운다. 환경설정(투구 게이지·주루·송구)과 마선수 레벨,
 * 경기진행 설정(전역기록 +0x12c+0 계열 — 0xc1e04 가 타석마다 읽는다)은 원본이 경기 중에 전역 칸에서 그때그때 읽으므로
 * 지금 값으로 바꿔 끼운다.
 */
function GeneralModeResume(props: GeneralModeScreenProps & { readonly resumeGame: TeamGameProgress }) {
  const {
    random, resumeGame, aceLevels, gaugeSettingOn, runningModeManual, throwModeManual, gamePoint, initialSettings,
    onSpendGamePoint, settings, onSettingsChange, onFinish, onExit, onGameSave, onSettlementEnter,
  } = props
  const [resumeFrom] = useState<TeamGameProgress>(() => ({
    ...resumeGame,
    options: {
      ...resumeGame.options,
      ...(initialSettings === undefined ? {} : { settings: initialSettings }),
      ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
      ...(runningModeManual === undefined ? {} : { runningModeManual }),
      ...(throwModeManual === undefined ? {} : { throwModeManual }),
      ...(aceLevels === undefined ? {} : { aceLevels }),
    },
  }))
  return (
    <TeamGameScreen
      options={resumeFrom.options}
      resumeFrom={resumeFrom}
      random={random}
      onFinish={onFinish}
      // 경기 중 나가기 0x40140 — 메인 메뉴 처음 단
      onQuit={() => onExit()}
      // 소개 판 0x44944 · 교체 창 줄 — 모드 1 레코드는 Xls 행 사본이라 표의 줄(게이트 거짓)
      matchupRecords={XLS_ROW_MATCHUP_RECORDS}
      // 정산 판의 보유 GP · 자동진행 비용 판정(0x3c802) — 자동진행 [예] 는 G 만 뺀다(모드 1 은 소모 통계 없음, 0x3c850)
      {...(gamePoint === undefined ? {} : { gamePoint })}
      {...(onSpendGamePoint === undefined ? {} : { onSpendGamePoint })}
      {...(settings === undefined ? {} : { settings })}
      {...(onSettingsChange === undefined ? {} : { onSettingsChange })}
      {...(onGameSave === undefined ? {} : { onHalfInningSave: onGameSave })}
      {...(onSettlementEnter === undefined ? {} : { onSettlementEnter })}
    />
  )
}

function GeneralModePrepare(props: GeneralModeScreenProps) {
  const {
    random, isQuickStart = false, openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds,
    aceLevels, onLevelUpAce, gamePoint, onOpenAce, onAllAcesOpen, initialSettings, onMatchSettingsConfirm, matchSettingsSeen,
    gaugeSettingOn, runningModeManual, throwModeManual, onSpendGamePoint, settings, onSettingsChange, onFinish, onExit, onGameStart, onGameSave, onSettlementEnter,
  } = props
  /** 이 경기의 첫 저장인가 — 경기정보 OK 몫(0x3136e)이고 그 뒤는 반 이닝 저장(0x4f928)이다 */
  const isFirstSaveRef = useRef(true)
  /** 18 · 19 에서 잠긴 히든 팀 OK — 힌트 팝업 글 (팝업 0x74ef5). 없으면 null */
  const [hiddenHint, setHiddenHint] = useState<string | null>(null)
  const showHiddenHint = (teamId: number) => setHiddenHint(
    hiddenTeamHintMessage(teamId, { openedHiddenIds: openedHiddenTeamIds ?? [], mode: TEAM_GAME_MODE.일반 }),
  )
  const hiddenHintOverlay = hiddenHint !== null && (
    <MessageBox text={hiddenHint} buttons={['확인']} onAnswer={() => setHiddenHint(null)} />
  )

  const session = useGeneralMode({
    random,
    isQuickStart,
    ...(openedHiddenTeamIds === undefined ? {} : { openedHiddenTeamIds }),
    ...(openedAcePitcherIds === undefined ? {} : { openedAcePitcherIds }),
    ...(openedAceBatterIds === undefined ? {} : { openedAceBatterIds }),
    ...(initialSettings === undefined ? {} : { initialSettings }),
    ...(onMatchSettingsConfirm === undefined ? {} : { onSettingsConfirm: onMatchSettingsConfirm }),
    ...(matchSettingsSeen === undefined ? {} : { matchSettingsSeen }),
    ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
    ...(runningModeManual === undefined ? {} : { runningModeManual }),
    ...(throwModeManual === undefined ? {} : { throwModeManual }),
    // 고르기 화면 LV 와 같은 칸이 경기 속 마선수 배율·마구 횟수도 정한다 (0xb6414 · 0xaebe4)
    ...(aceLevels === undefined ? {} : { aceLevels }),
    // 0x30f20(22 들어옴 · 재굴림 끝) · 0x2a370(23 나감)도 0x22755 로 블록만 쓴다 — 반 이닝 저장과 같은 손잡이
    ...(onGameSave === undefined ? {} : { onMatchBlockWrite: onGameSave }),
  })
  const { flow, actions } = session
  /**
   * 22 그림 0x2e0c4 의 0x63b15 넷째 인자 = `[메뉴+0x28] ≠ 0x17` — 이전 상태가 23(엔트리 편집)이 아니면 머리띠 미끄러짐 ·
   * 본문 숨김 · 배너 연출을 켠다 (모드 1 · 8 · 9 두 갈래 모두, 0x2e0ee~0x2e11a · 0x2e16a~). `pages/management/lib/matchInfoEntry`.
   */
  const matchView = session.isPlaying || flow.step !== GENERAL_MODE_STEP.경기정보 ? null
    : session.entryEdit !== null ? '23' : '22'
  const matchViewTrail = useRef<{ readonly view: string | null; readonly previous: string | null }>({ view: matchView, previous: null })
  if (matchViewTrail.current.view !== matchView) matchViewTrail.current = { view: matchView, previous: matchViewTrail.current.view }
  const isMatchInfoEntryAnimated = matchViewTrail.current.previous !== '23'
  /**
   * 18 · 19 그림(0x2de3c · 0x2ddb0)의 0x63b15 넷째 인자 = `[메뉴+0x28] ≠ 0x13` · `≠ 0x12` — 상대 팀 고르기에서 넘어왔으면 0 이라
   * 0x63bd8~0x63be0 이 머리띠 미끄러짐([skin+0x84]) · 격자 열림 애니([skin+0xe8])를 끈다 (2de7e · 2ddf2, r333)
   */
  const stepTrail = useRef<{ readonly step: number; readonly previous: number | null }>({ step: flow.step, previous: null })
  if (stepTrail.current.step !== flow.step) stepTrail.current = { step: flow.step, previous: stepTrail.current.step }
  const isTeamSelectEntryAnimated = (otherTeamStep: number) => stepTrail.current.previous !== otherTeamStep
  /** 준비 단계 취소 — 18 · 빠른실행 22 의 CLR 은 게임시작 목록(하위 5)으로 (0x29d9a · 0x313c4) */
  const cancelPrepare = () => onExit(5)
  const back = () => {
    if (!actions.back()) cancelPrepare()
  }

  if (session.isPlaying) {
    return (
      <TeamGameScreen
        options={session.gameOptions}
        random={random}
        onFinish={onFinish}
        // 경기 중 나가기 0x40140 — 메인 메뉴 처음 단
        onQuit={() => onExit()}
        // 소개 판 0x44944 · 교체 창 줄 — 모드 1 레코드는 Xls 행 사본이라 표의 줄(게이트 거짓)
        matchupRecords={XLS_ROW_MATCHUP_RECORDS}
        // 정산 판의 보유 GP · 자동진행 비용 판정(0x3c802) — 자동진행 [예] 는 G 만 뺀다(모드 1 은 소모 통계 없음, 0x3c850)
        {...(gamePoint === undefined ? {} : { gamePoint })}
        {...(onSpendGamePoint === undefined ? {} : { onSpendGamePoint })}
        {...(settings === undefined ? {} : { settings })}
        {...(onSettingsChange === undefined ? {} : { onSettingsChange })}
        onHalfInningSave={(save) => {
          if (isFirstSaveRef.current) {
            isFirstSaveRef.current = false
            onGameStart?.(save)
            return
          }
          onGameSave?.(save)
        }}
        {...(onSettlementEnter === undefined ? {} : { onSettlementEnter })}
      />
    )
  }

  /**
   * 18 ↔ 19 · 22 ↔ 23 은 화면 밀기(효과기 종류 8)로 바뀐다 — 모든 단계를 같은 밀기 틀에 담아 앞 화면을 떠 둔다(A-68,
   * `lib/generalPrepPush`). 23 은 [메뉴+0xec](유저 팀 1 · CPU 팀 0)에 따라 방향이 갈린다
   */
  const pushView: GeneralPrepPushView = flow.step === GENERAL_MODE_STEP.유저팀 ? '18'
    : flow.step === GENERAL_MODE_STEP.AI팀 ? '19'
      : flow.step === GENERAL_MODE_STEP.경기정보 ? (session.entryEdit === null ? '22' : session.entryEdit.isUserTeam ? '23:유저' : '23:CPU')
        : '그밖'
  const wrap = (content: ReactNode) => (
    <NariScreenPush view={pushView} directionOf={generalPrepPushDirectionOf}>{content}</NariScreenPush>
  )

  switch (flow.step) {
    // 18 · 19 는 다른 하위 상태라 들어설 때마다 새로 선다: 들어옴 0x23e08 · 0x23e70 이 목록 [메뉴+0x74] 커서를
    // vt+0x14(0, 0)(0x6c00c) 로 0 칸에 두고(19 는 이어서 (0, 1) = 팀 5 로 고쳐 쓴다 — 23eb2 · 23eb4), 그림 0x2de3c · 0x2ddb0 의
    // 공용 목록 0x63b14 가 상태 틱 0 인 첫 그림에서 넷째 인자대로 들어옴 연출을 다시 건다(상대 팀 고르기에서 왔으면 끈다 —
    // `isTeamSelectEntryAnimated`) — key 로 둘을 갈라 같은 화면을 이어 쓰지 않는다
    case GENERAL_MODE_STEP.유저팀:
      return wrap(
        <TeamSelectScreen
          key="18"
          title="팀선택"
          openedHiddenIds={openedHiddenTeamIds ?? []}
          isEntryAnimated={isTeamSelectEntryAnimated(GENERAL_MODE_STEP.AI팀)}
          {...(gamePoint === undefined ? {} : { gamePoint })}
          onSelect={actions.selectUserTeam}
          onSelectLocked={showHiddenHint}
          onCancel={cancelPrepare}
          overlay={hiddenHintOverlay}
        />
      )
    case GENERAL_MODE_STEP.AI팀:
      return wrap(
        <TeamSelectScreen
          key="19"
          title="팀선택"
          openedHiddenIds={openedHiddenTeamIds ?? []}
          // 19 진입 0x23e70 이 격자 [메뉴+0x74] 의 칸을 x 0 · y 1 로 둔다(23eb2 · 23eb4) — 팀 = y × 5 + x = 5 (r333)
          initialCursor={AI_TEAM_INITIAL_CURSOR}
          isEntryAnimated={isTeamSelectEntryAnimated(GENERAL_MODE_STEP.유저팀)}
          // ⚠️ 유저 팀과 같은 팀인지 보지 않는다 — 원본 그대로다 (R4 3a 상태 19)
          {...(gamePoint === undefined ? {} : { gamePoint })}
          onSelect={actions.selectAiTeam}
          onSelectLocked={showHiddenHint}
          onCancel={back}
          overlay={hiddenHintOverlay}
        />
      )
    case GENERAL_MODE_STEP.선공구장:
      return wrap(
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
          onCancel={back}
        />
      )
    case GENERAL_MODE_STEP.마선수:
      return wrap(
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
          onCancel={back}
          // 그림 0x2dfe0 은 맨 앞(0x2e012)에서 공 무늬 바탕 0x5fd61(skin, 0, 0, W, H) 을 깐다
          underlay={<SkinBackdrop kind="공무늬" />}
        />
      )
    default:
      // 상태 23 엔트리 편집 — 그리기 0x2e070 (엔트리 목록 창 0x5cfec + 머리띠 6/7), 키 0x2a370 → 0x55864
      if (session.entryEdit !== null) {
        const { entryEdit } = session
        return wrap(
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
      return wrap(
        <>
          <MatchInfoScreen
            setup={flow.setup}
            isQuickStart={flow.isQuickStart}
            isEntryAnimated={isMatchInfoEntryAnimated}
            isSettingsOpen={session.isSettingsOpen}
            isRespinning={session.isRespinning}
            userStarterName={session.userStarterName}
            cpuMatchInfo={session.cpuMatchInfo}
            // 22 진입 0x314b0 → 0x5fd04 가 떠 둔 구장 바탕
            stage={session.matchInfoStage}
            // 머리띠 G포인트 — 전역 G(+0x64). 안 넘기면 0 으로 찍혔다
            {...(gamePoint === undefined ? {} : { gamePoint })}
            // 설정 창이 열려 있으면 키가 모두 창으로 간다 (0x311a8 skin+0x2ba) — 시즌 0xdd 와 같은 창 0x6042c · 0x5ffcc 다
            onStart={() => {
              if (!session.isSettingsOpen) actions.start()
            }}
            onOpenSettings={() => {
              if (!session.isSettingsOpen) actions.openSettings()
            }}
            onRespin={() => {
              if (!session.isSettingsOpen) actions.respin()
            }}
            onCancel={() => {
              if (!session.isSettingsOpen) back()
            }}
            onOpenEntry={(isUserTeam) => {
              // 설정 창이 열려 있으면 키가 창으로 간다 (0x311a8 skin+0x2ba)
              if (!session.isSettingsOpen) actions.openEntry(isUserTeam)
            }}
            settingsWindow={session.isSettingsOpen && (
              <MatchSettingsWindow
                settings={session.settings}
                onConfirm={actions.applySettings}
                onClose={actions.closeSettings}
              />
            )}
          />
        </>
      )
  }
}
