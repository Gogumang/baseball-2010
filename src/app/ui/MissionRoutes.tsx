import { useEffect, useRef } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import {
  missionBatterSpecialSwingRemainingOf,
  missionMoundOpponent,
  missionMoundPitcherAbility,
  missionStageBatterOf,
} from '@/app/model/useMissionSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import { MissionSelectScreen, MissionBriefing } from '@/pages/mission-select/ui/MissionSelectScreen'
import { MissionPlayScreen } from '@/pages/mission-play/ui/MissionPlayScreen'
import { cpuSideOf, humanSideOf } from '@/entities/mission/model/missionGame'
import { HallOfFameScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { Collection } from '@/entities/collection/model/collection'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { DEFENSE_SCENE_START, type DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import type { ModeBatter } from '@/app/model/modeBatter'
import { isModeMagicPitchType, modePitchMenuOf } from '@/app/model/modePitcher'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchControl } from '@/entities/settings/model/gameSettings'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionResultHeldOf } from '@/pages/mission-play/lib/missionResultBoard'
import { missionRunScoreBoardOf } from '@/pages/mission-play/lib/missionRunScoreBoard'

/**
 * 마선수 대결의 전역 기록 칸 — 타자편 대결은 SYS 8 이 g[0x11f] = 1, 투수편 대결은 g[0x176] = 1 을 적는다.
 * 결과 판 0x4a384 는 둘 중 하나라도 서면 앞부분만 그리고, 0x4ea0c 는 G 보상을 건너뛴다.
 */
const BATTER_ACE_MATCH_FLAGS = { flag11f: true, flag176: false } as const
const PITCHER_ACE_MATCH_FLAGS = { flag11f: false, flag176: true } as const

/** 결과 판의 번 G · 보유 G (0x4ea0c 가 더한 뒤 — `missionResultHeldOf`) */
function resultBoardOf(
  session: ReturnType<typeof useMissionSession>,
  mission: OriginalMission,
  status: string,
  gamePoint: number | undefined,
  aceMatch?: { readonly flag11f: boolean; readonly flag176: boolean },
) {
  const earnedGamePoint = session.resultEarnedGamePointOf(mission, status, aceMatch !== undefined)
  return {
    earnedGamePoint,
    ...(gamePoint === undefined ? {} : { heldGamePoint: missionResultHeldOf(gamePoint, earnedGamePoint) }),
    ...(aceMatch === undefined ? {} : { aceMatch }),
  }
}

interface MissionRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 치는 육성 타자 — 0xb6414 능력치와 장착 스킬 (`modeBatterOf`). 명예 타자를 고르면 세션의 `hallOfFameBatter` 가 대신한다 */
  readonly batter: ModeBatter
  /** 선수 고르기 창(하위 17)이 그리는 명예의 전당 칸 */
  readonly hallOfFame: Collection
  /** 선수 고르기 칸 0·5 의 나리 투수·타자 (투수편·타자편 저장, `nariPitcherOf` · `nariBatterOf`) — 없으면 null */
  readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly pitchControl: PitchControl
  /**
   * 선수 고르기 창(하위 17) 머리띠의 G포인트 — 전역 기록 `mgr+0x64` (App 의 지갑 `wallet.balance`).
   * 머리띠 0x54d95 는 제목이 −1 이 아니면 G포인트(0x54a60)를 늘 그린다. 안 넘기면 머리띠를 예전(명예의 전당 띠)대로 둔다.
   */
  readonly gamePoint?: number
}

/** 미션 모드 화면 분기. 진행 중인 미션이 없으면 선택 화면으로 되돌린다. */
export function MissionRoutes({
  screen,
  setScreen,
  session,
  runner,
  random,
  batter: nariBatter,
  hallOfFame,
  nari,
  pitchControl,
  gameSettings,
  gamePoint,
}: MissionRoutesProps) {
  const { missionRun, pitcherRun, actions } = session
  const batter = session.hallOfFameBatter ?? nariBatter
  /**
   * 미션 경기 장면 0x104 하나 — 미션 · 마선수 대결을 세울 때마다(`begin` · `beginAceMatch` 가 새 화면 칸을 세운다) 새로 만든다.
   * 이 라우트는 목록 · 설명 · 결과도 그려 마운트 수명이 장면보다 길다 — 진행 화면 칸이 바뀔 때 아래 칸들을 0 으로 둔다
   */
  const playScreenRef = useRef<Screen | null>(null)
  if (screen.kind === '미션진행' || screen.kind === '투수미션' || screen.kind === '마선수대결') playScreenRef.current = screen
  /** 미션 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, playScreenRef.current)
  /** 장면 +0xfdc — 타자 미션의 번트 · 스윙 키가 쓴다. 키 없는 공은 앞 공의 값이 남는다(`BattingStage.sceneBuntKind`) */
  const sceneBuntKindRef = useSceneScopedRef(0, playScreenRef.current)

  const overlay = missionOverlayOf(session, defenseSceneRef)
  if (overlay !== null) return overlay

  // 미션 모드로 들어오면 먼저 선수를 고른다 (하위 17 — 진입 0x2613c · 갱신 0x29a54). 결과 0(되돌아가기)은
  // 하위 5 모드 목록 — 웹은 메인 메뉴다. 1·3 → 모드 5(투수 미션), 2·4 → 모드 6(타자 미션) 목록으로 간다.
  // 원본은 육성·명예 선수가 다 없으면 코드 5·6 팝업만 떠서 들어갈 수 없다(신인 대체 없음, Q2 3-1).
  //
  // 그리기 0x2dec8 (직접 뜸) 은 셋만 부른다:
  //   0x58371(skin, [this+0x90], 0)                         ; 바탕
  //   0x63b15(skin, [this+0x74] 목록, 6, 1, [this+0x2c], −1) ; 명예의 전당 목록 k 6 (시즌 0xe2 0xa10c 와 같은 k)
  //   0x54d95(skin, 11, 5, 0)                                ; 머리띠 — 제목 11 "미션모드"(game_frame 18) · 바닥 5(되돌아가기만)
  // 0x54d95 는 제목이 −1 이 아니면 G포인트(0x54a60)도 그린다(0x550de) — 명예의 전당(하위 27, 제목 16) 띠가 아니다.
  // 머리글 질문 StrMAINMENU[14] "어떤 선수로 플레이 하시겠습니까?" 는 **안 띄운다**: 그 팝업 0x25d78(0x74ef5(…, 0x10))은
  // 진입 표 0xcf06c 에서 하위 13(나만의리그 편 고르기, 0x329f6) 하나만 부르고, 하위 17 의 진입 0x2613c(0x24924 자원 ·
  // 0x5eb8c 칸 채우기)·갱신 0x29a54(0x62569 키 → 표 0xcec00)·그리기 0x2dec8 어디에도 0x25d78·0x74ef5·문자열 0x702b5 호출이 없다.
  // ⚠️ 미해결: 바탕 0x58371 의 내부는 안 읽어 명예의 전당 화면 바탕 그대로 둔다.
  if (screen.kind === '미션선택' && session.player === null) {
    return (
      <HallOfFameScreen
        {...(gamePoint === undefined ? {} : { frame: { title: '미션모드' as const, gamePoint } })}
        collection={hallOfFame}
        mode={{ kind: '선수고르기', nari, onPick: actions.choosePlayer, onCancel: () => setScreen({ kind: '메인메뉴' }) }}
        onBack={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  const selectScreen = (
    <MissionSelectScreen
      clearedKeys={session.clearedKeys}
      clearCounts={session.clearCounts}
      initialSide={session.player?.side ?? session.lastSide}
      // 고른 선수가 편을 정한다 — 목록 안에서 편을 바꾸는 길은 원본에 없다
      canSwitchSide={session.player === null}
      onSelect={(mission) => setScreen({ kind: '미션설명', mission })}
      onBack={() => setScreen({ kind: '메인메뉴' })}
    />
  )

  if (screen.kind === '미션설명') {
    return (
      <MissionBriefing
        mission={screen.mission}
        onStart={() => actions.begin(screen.mission)}
        onBack={() => setScreen({ kind: '미션선택' })}
      />
    )
  }

  // 이벤트 마선수 대결도 같은 타석 화면이다 — 끝나면 미션 목록 대신 결과 이벤트로 돌아간다
  if (screen.kind === '미션진행' || screen.kind === '마선수대결') {
    if (missionRun === null) return selectScreen
    // 지금 사람 칸 타석의 타자 — 미션 타자 차례가 아니면 사람 칸 팀 마스터 줄(능력치 0xb6415 · 이름 · +0x14 스킬, 필살 0)
    const stageBatter = missionStageBatterOf(missionRun, batter)
    return (
      <MissionPlayScreen
        run={missionRun}
        ability={stageBatter.ability}
        batterSkillIds={stageBatter.skillIds}
        batterName={stageBatter.name}
        pitcherAbility={missionMoundPitcherAbility(missionRun, session.aceLevels, session.opponentStaminaPercent)}
        opponent={missionMoundOpponent(missionRun)}
        atBat={runner.atBat}
        isPaused={runner.isPaused}
        bannerText={runner.bannerText}
        random={random}
        onPitchResolved={(detail, _pitch, isUncatchable, buntKind) => {
          sceneBuntKindRef.current = buntKind ?? 0
          session.handleMissionPitch(detail, isUncatchable, buntKind)
        }}
        sceneBuntKind={sceneBuntKindRef.current}
        // 필살타법 — 나리 타자편 저장 선수의 번호(+0x18)와 이 미션 한 판의 남은 횟수 (0xaebe4 가 채운다)
        specialSwingNumber={stageBatter.specialSwingNumber}
        specialSwingRemaining={missionBatterSpecialSwingRemainingOf(session.batterSpecialSwingStored, stageBatter)}
        onSpecialSwingUsed={actions.specialSwingUsed}
        // 상대 마투수 마구 횟수 0xd8509[레벨] (타석 교대 0xaebe4) — 안 넘기면 늘 Lv1 의 3회다
        aceLevels={session.aceLevels}
        // CPU 견제 (0x345fc 종류 4 → 0x34848 → 메시지 0x10) — 미션(모드 6)에서도 돈다
        onPickoff={actions.cpuPickoff}
        // 도루 출발 (0x53610 → 0x583 → 0xa9bd4) — 판정은 공이 도착할 때 도루 판(종류 5)이 한다
        stealableBases={session.stealableBases}
        onSteal={actions.steal}
        // 경기 중 "나가기" — 보통 미션은 0x40140 이 0xa5368(…, 0) 뒤 곧장 메인 메뉴(결과 화면 없음).
        // ⚠️ 미해결: 마선수 대결(+0x11f/+0x176)도 0x40140 은 플래그를 안 보고 메인 메뉴로 나가는 것으로 보이나, 다시 들어올 때
        //    105 진입이 결과 이벤트를 어떻게 잇는지 못 읽어 예전(실패 결과 → 진 이벤트) 그대로 둔다
        onGiveUp={screen.kind === '마선수대결' ? actions.giveUpBatter : actions.quitBatterMission}
        onFinish={screen.kind === '마선수대결' ? actions.finishAceMatch : actions.finishBatter}
        // 결과 판 0x4a384(모드 5·6) — "예"는 같은 미션 곧바로 다시(0x140006c = 3)
        onRetry={actions.retryBatter}
        resultBoard={resultBoardOf(session, missionRun.mission, missionRun.status, gamePoint,
          screen.kind === '마선수대결' ? BATTER_ACE_MATCH_FLAGS : undefined)}
        // 경기 중 메뉴 "다시하기" (StrGAME[7]) — 같은 미션을 처음부터 다시 세운다. 0x3c98e 는 g[0x11f] 를 안 보고 모드 5·6 이면
        // 장면 0x107 → 0x104 로 같은 미션을 다시 세운다 — g[0x11f] 는 아무도 안 내려 마선수 대결은 **같은 대결**로 다시 선다
        // (투수편 대결 `PitcherAceMatchRoute` 와 같다)
        onRestart={() => {
          if (screen.kind === '마선수대결') {
            const { kind: _kind, mission: _mission, ...pending } = screen
            actions.beginAceMatch(missionRun.mission, pending)
            return
          }
          actions.begin(missionRun.mission)
        }}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        // 상태 0xe — 새 타석마다 사람 OK 를 기다린다
        sceneConfirm={session.sceneConfirm}
        onSceneConfirm={session.confirmScene}
        substitutionScene={session.substitutionScene}
        // 하늘 줄 — 장면을 세울 때 한 번 굴린 구장 +0x10 (0x783b0 rand(0, 6))
        skyRow={session.skyRow}
        onSubstitutionSceneDone={session.finishSubstitutionScene}
      />
    )
  }

  if (screen.kind === '투수미션') {
    if (pitcherRun === null) return selectScreen
    return (
      <PitchingScreen
        run={pitcherRun}
        // 미션 투수(나리 투수편 저장 · 명예 투수)의 구질 칸 0xb6d2c — `modePitcherOf` 를 세션이 들고 있다.
        // 칸 5 마구(+0x18 ≠ 0)는 이 미션 한 판의 남은 횟수 팀+0x28 (0xaebe4 가 0xd84ff[+0x18] 로 채운다)과 함께
        repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
        magicRemaining={session.pitcherMagicRemaining}
        isMagicType={isModeMagicPitchType}
        usesGauge={pitchControl === '게이지'}
        atBat={runner.atBat}
        bannerText={runner.bannerText}
        onThrow={session.handleThrow}
        // 경기 중 메뉴 "나가기" — 보통 미션은 0x40140 이 0xa5368(…, 0) 뒤 곧장 메인 메뉴(결과 화면 없음, 모드 5·6 같은 갈래)
        onGiveUp={actions.quitPitcherMission}
        onFinish={actions.finishPitcher}
        // 결과 판 0x4a384(모드 5·6) — "예"는 같은 미션 곧바로 다시(0x140006c = 3)
        onRetry={actions.retryPitcher}
        resultBoard={resultBoardOf(session, pitcherRun.mission, pitcherRun.status, gamePoint)}
        // 경기 중 메뉴 "다시하기" (StrGAME[7]) — 같은 미션을 처음부터 다시 세운다
        onRestart={() => actions.begin(pitcherRun.mission)}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        // 사람 견제 '3'·'1'·'7' (0x53548 → 0x50f28) — 모드 5 도 막지 않는다 (`actions.pickoff` 주석)
        onPickoffKey={actions.pickoff}
        // 상태 0xe — 새 타석마다 사람 OK 를 기다린다
        sceneConfirm={session.sceneConfirm}
        onSceneConfirm={session.confirmScene}
        substitutionScene={session.substitutionScene}
        // 하늘 줄 — 장면을 세울 때 한 번 굴린 구장 +0x10 (0x783b0 rand(0, 6))
        skyRow={session.skyRow}
        onSubstitutionSceneDone={session.finishSubstitutionScene}
        // 결과 판 0x4a384 의 배경 · 정산 효과(0x4ea0c 꼬리 — 모드를 안 가린다)는 경기 난수로
        random={random}
      />
    )
  }

  return selectScreen
}

/**
 * 공 사이에 끼어드는 화면 — 수비·벤치 클리어링·견제 재생. 없으면 null.
 *
 * **수비 화면(상태 0x17)이 먼저다.** 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라
 * 맞은 공은 0x11 → 0x13 → **늘 0x17** 로 간다 (`0xae5f0` = `movs r0,#0x17`, R10 8절 전이표).
 * 다 돌고 나서야 `0xae3e8` 이 다음 타석으로 보낸다 — 그 자리가 `finishDefensePlay` 다.
 *
 * 사람이 잡는 쪽(`side`)은 편에 따라 다르다: 타자 미션은 내가 공격(주루), 투수 미션은 내가 수비(송구).
 *
 * 수비 장면 득점 점수판 0x41a64(`runScoreBoard`) — 두 측 팀 · 사람 칸 · 공격 측은 미션 준비 0xaa57c 가 레코드 +2 · +3 으로 세운
 * 그대로다(`missionRunScoreBoardOf`). 두 점수는 플레이 시작 때의 경기 점수판 0xb69b0(`run.game.scores` — 타석 득점 · 자동진행
 * 반 이닝 득점이 모두 든다). 사람 칸 팀은 경기[0x28 + 사람 칸] — 마선수 대결(g[0x11f]/g[0x176] 이고 g[0xf6] ∈ 2..4)이면
 * 0xaa57c aa6dc~aa728 이 그 모드 저장 레코드 +1 의 팀으로 세운다(`missionHumanTeamIdOf` → `run.game.humanBatting.teamId`).
 */
function missionOverlayOf(
  session: ReturnType<typeof useMissionSession>,
  defenseScene: MutableRefObject<DefenseSceneMemory>,
): ReactNode | null {
  const { pendingDefensePlay, actions } = session
  if (pendingDefensePlay !== null) {
    const isPitcher = pendingDefensePlay.side === '투수'
    const run = isPitcher ? session.pitcherRun : session.missionRun
    const runScoreBoard =
      run === null
        ? undefined
        : missionRunScoreBoardOf(missionWithSideTeamsOf(run.mission, run.game.humanBatting.teamId), {
            ours: run.game.scores[humanSideOf(run.mission)],
            opponents: run.game.scores[cpuSideOf(run.mission)],
          })
    return (
      <DefensePlayback
        input={pendingDefensePlay.input}
        side={isPitcher ? '수비' : '공격'}
        runScoreBoard={runScoreBoard}
        sceneMemory={defenseScene}
        onDone={actions.finishDefensePlay}
      />
    )
  }

  // 투수 미션 사구 뒤 벤치 클리어링 연출(상태 0x1e) — 투수편 `PitcherGameScreen` 과 같은 위젯이다
  if (session.pendingBenchClearing !== null) {
    return <BenchClearingScene onDone={actions.finishBenchClearing} />
  }

  // CPU 견제 한 판 — 세션이 이미 다 돌려 먹였다. 화면은 재생만 한다 (나만의리그 `GameRoute` 의 lastDefensePlay 와 같은 꼴)
  if (session.pickoffReplay !== null) {
    return <DefensePlayback ticks={session.pickoffReplay.ticks} onDone={actions.finishPickoffReplay} />
  }
  return null
}

/**
 * 경기[0x28 + 칸] 두 측 팀 — 다른 칸은 레코드 +2 아래 4비트 그대로, 사람 칸은 0xaa57c 가 세운 팀(`MissionGame.humanBatting.teamId`:
 * 보통 미션은 레코드 팀, 마선수 대결은 그 편 나리 저장 팀). 점수판 재료(`missionRunScoreBoardOf`)는 레코드의 `sideTeams` 를 읽는다.
 */
function missionWithSideTeamsOf(mission: OriginalMission, humanTeamId: number): OriginalMission {
  const human = humanSideOf(mission)
  if (mission.sideTeams[human] === humanTeamId) return mission
  const other = mission.sideTeams[human === 0 ? 1 : 0]
  return { ...mission, sideTeams: human === 0 ? [humanTeamId, other] : [other, humanTeamId] }
}

interface PitcherAceMatchRouteProps {
  /** SYS 8 이 고른 투수 미션 레코드 (team − 1, `aceMatchMissionOf(team, '투수')`) */
  readonly mission: OriginalMission
  readonly session: ReturnType<typeof useMissionSession>
  readonly runner: AtBatRunner
  readonly pitchControl: PitchControl
  /** 경기 중 메뉴 "설정" 칸 — App 이 환경설정을 넘긴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 대결이 끝났다 — 저장 +0x177 의 결과 바이트 (이겼나) */
  readonly onFinish: (isWin: boolean) => void
}

/**
 * **투수편 마선수 대결 화면** — 투수편 라우트의 `renderAceMatch` 가 그린다.
 * 원본은 투수편 장면(0x106)을 떠나 미션 장면(모드 5)으로 가서 보통 투수 미션과 같은 투구 화면으로 던지고,
 * 끝나면 결과 화면에서 재도전 커서 없이(0x407f0 의 +0x176 갈래) 원래 모드로 돌아온다 (0x4b328 · 0x4090c).
 * 들어서면 `beginPitcherAceMatch` 로 미션을 세우고, 결과 [확인]에서 `finishPitcherAceMatch` 의 이겼나를 넘긴다.
 */
export function PitcherAceMatchRoute(
  { mission, session, runner, pitchControl, gameSettings, onFinish }: PitcherAceMatchRouteProps,
) {
  const beginRef = useRef(session.actions.beginPitcherAceMatch)
  beginRef.current = session.actions.beginPitcherAceMatch
  useEffect(() => {
    beginRef.current(mission)
  }, [mission])

  // 대결 하나 = 미션 장면 하나 (`beginPitcherAceMatch` 가 `mission` 마다 세운다)
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, mission)
  const overlay = missionOverlayOf(session, defenseSceneRef)
  if (overlay !== null) return overlay

  // 미션을 세우기 전(첫 그림) — 아무것도 안 그린다
  const { pitcherRun, actions } = session
  if (pitcherRun === null || session.pitcherAceMatchMission !== mission) return null

  return (
    <PitchingScreen
      run={pitcherRun}
      repertoire={modePitchMenuOf(session.pitcher, session.pitcherMagicRemaining)}
      magicRemaining={session.pitcherMagicRemaining}
      isMagicType={isModeMagicPitchType}
      usesGauge={pitchControl === '게이지'}
      atBat={runner.atBat}
      bannerText={runner.bannerText}
      onThrow={session.handleThrow}
      // ⚠️ 근사: 원본 경기 중 메뉴 나가기 0x40140 은 모드 5·6 이면 0xa5368(obj,0) 뒤 메인 메뉴(장면 0x103)로 간다 —
      //    +0x176 이 서 있을 때 어디로 가는지는 안 읽었다. 웹은 보통 미션처럼 '실패' 로 두어 패배 결과로 잇는다.
      onGiveUp={actions.giveUpPitcher}
      // 경기 중 메뉴 "다시하기"(0x3c706 → StrGAME[7] 예 → 하위 3 0x3c98e) — 0x3c98e 는 +0x176 을 안 보고 모드 5·6 이면
      // 0x140006c = 3 · 장면 0x107 로 간다. 0x107 진입 0x1d9a4 가 this+0x9c = 미션객체+0xbd 를 잡고 상태 3 0x1e908 이 그 미션을
      // 곧장 다시 세운다(장면 0x104). 대결의 +0xbd 는 SYS 8 이 g[0x175] 와 같은 team − 1 로 적었고(0x8d88a~0x8d890), g[0x176] 은
      // 아무도 안 내리므로 **같은 대결을 처음부터** 다시 치르고 끝나면 그대로 투수편으로 돌아간다
      onRestart={() => actions.beginPitcherAceMatch(mission)}
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // 마선수 대결도 미션 장면(모드 5)이라 사람 견제 길이 같다
      onPickoffKey={actions.pickoff}
      // 대결도 미션 장면이라 새 타석마다 0xe 에서 OK 를 기다린다
      sceneConfirm={session.sceneConfirm}
      onSceneConfirm={session.confirmScene}
      substitutionScene={session.substitutionScene}
      skyRow={session.skyRow}
      onSubstitutionSceneDone={session.finishSubstitutionScene}
      onFinish={() => {
        const isWin = actions.finishPitcherAceMatch()
        if (isWin !== null) onFinish(isWin)
      }}
      // 결과 판 0x4a384 — g[0x176] 이 서 있어 앞부분(띠 · YOU WIN/LOSE)만, G 보상 없음
      resultBoard={resultBoardOf(session, pitcherRun.mission, pitcherRun.status, undefined, PITCHER_ACE_MATCH_FLAGS)}
      // 대결도 정산 0x4ea0c 꼬리를 지난다 — 배경 · 정산 효과는 경기 난수로
      random={session.random}
    />
  )
}
