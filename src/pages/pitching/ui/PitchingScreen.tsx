import { useEffect, useState } from 'react'
import { Hint, MenuList, Panel, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { goalsOf } from '@/entities/mission/model/missionGoal'
import { GoalBar } from '@/entities/mission/ui/GoalBar'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { CourseGrid } from '@/pages/pitching/ui/CourseGrid'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/MissionResultBoard'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 투구 화면. 원작 설명서 <투구 조작>의 세 단계를 그대로 따른다:
 *   1. 구질 선택  2. 코스 선택  3. 투구 결정(게이지)
 *
 * ⚠️ 게이지가 넘겨 주는 것은 **누른 칸 g(0~9)** 하나다 — 원본에는 PERFECT/GOOD/BAD 라는
 * 글자도 판정도 없다 (S5 U-15 확정, 누름 0x50e08). 등급 t = max(g−4, 1) 은 부르는 쪽
 * (`pitcherPitch.pitchGradeOf`)이 원본 자리에서 뽑는다. 나리 투수편 `PitcherGameScreen` 과 같다.
 *
 * 기록 달성 알림 0x4e35c 는 붙이지 않는다 — 프레임 0x52c50 이 미션(모드 5·6)에서도 부르지만 지급 0xa77f0 이
 * a780a(`state[1] ∈ {5,6,7}` → 끝)에서 막아 줄도 G 누계도 늘 비어 있다(R8 1절) → 원본도 판이 안 선다.
 */
type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
type MenuOverlay = '조작방법' | '설정'
/**
 * 미션 투수편 = 원본 전역 모드 **5** (XlsPITCHER_MISSION, Q2-mission-rewards 1-0) — 경기 중 메뉴 표 0xcfcfc 의 **행 1**
 * (모드 5~7 → 1: 자동진행 자리에 다시하기). 미션 장면도 경기 장면 0x104 라 '*' 가 같은 메뉴를 연다.
 */
const MISSION_PITCHER_MODE = 5

interface PitchingScreenProps {
  readonly run: PitcherRun
  readonly repertoire: readonly PitchTypeInfo[]
  /** 환경설정 [투구] 가 게이지일 때만 3단계 게이지가 뜬다 (설정 +0x2d, 0x3f500) */
  readonly usesGauge: boolean
  readonly atBat: AtBatState
  readonly bannerText: string
  /**
   * 이 판의 **남은 마구 횟수** = 팀+0x28 (0xaea10). `isMagicType` 과 함께 넘기면 마구 칸을 원본처럼 막는다:
   * 키 '0' → 메시지 7 → 0x50da8 이 `구질 == 22` 면 `0xaea10 > 0` 일 때만 받고(0x50db8 `bgt`), 아니면 그대로
   * 빠진다(0x523aa) — 구질이 안 바뀌고 다음 단계로도 안 간다. 안 넘기면 막지 않는다.
   */
  readonly magicRemaining?: number
  /** 메뉴 항목이 마구 칸(구질 22)인가 — 구질 표 `PitchTypeInfo` 에 마구 자리가 없어 부르는 쪽이 가른다 */
  readonly isMagicType?: (type: PitchTypeInfo) => boolean
  /**
   * 던진다. `gaugeCell` 은 게이지에서 **누른 칸 0~9**(안 눌렀거나 게이지를 안 쓰면 0),
   * `gaugeSettingOn` 은 환경설정 [투구]가 게이지인가다 — 꺼져 있으면 원본이 제구·체력
   * 확률표 0xd896c 로 등급을 뽑는다 (0x4dbac).
   */
  readonly onThrow: (
    type: PitchTypeInfo,
    courseCell: number,
    gaugeCell: number,
    gaugeSettingOn: boolean,
  ) => void
  /** 경기 중 메뉴 **"나가기"** (표 0xcfcfc 행 1 칸 4 — StrGAME[0]/[1] 확인 뒤 0x22 → 0x40140) */
  readonly onGiveUp: () => void
  /** 결과 판에서 미션 목록으로(0x140006c = 1) — 마선수 대결이면 대결 끝 */
  readonly onFinish: () => void
  /**
   * 결과 판에서 "예"(0x140006c = 3) — 같은 미션을 곧바로 다시. 안 넘기면 `onFinish` 와 같다.
   * 마선수 대결(`resultBoard.aceMatch`)은 어느 키든 `onFinish` 다.
   */
  readonly onRetry?: () => void
  /** 결과 판 0x4a384(모드 5·6) 의 값 — 번 G [+0x17f4] · 보유 G g[0x64] · 마선수 대결 칸 */
  readonly resultBoard?: Pick<MissionResultBoardProps, 'earnedGamePoint' | 'heldGamePoint' | 'aceMatch'>
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`) — 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다.
   * 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **사람 견제 키** — 구질 고르기(상태 0xf)에서 누른 키를 그대로 넘긴다. '3' 1루 · '1' 2루 · '7' 3루 (0x53548 → 메시지 0x10).
   * 원본 0x53580 은 수비면 구질 0x534d8 뒤에 견제 0x53548 을 늘 이어 부른다 — 모드 5(투수 미션)도 막지 않는다.
   * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 부르는 쪽이 키를 먹고 끝낸다.
   * 안 넘기면 견제 키가 없다.
   */
  readonly onPickoffKey?: (key: string) => void
  /**
   * **상태 0xe 의 OK 대기** — 세션이 새 타석마다 싣는다 (`useMissionSession.sceneConfirm`). 안 넘기면 기다리지 않는다
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /** 0xe 의 OK 하나를 받을 때마다 — 세션이 0xf 진입(CPU 대타 0xac228)을 이때 묻는다 (`useMissionSession.confirmScene`) */
  readonly onSceneConfirm?: () => void
  /**
   * **교체 연출 0x16** — 서 있으면 "CHANGE" 애니(0x4da30)를 그리고 0xe 대기를 세지 않는다. 다 그리면 `onSubstitutionSceneDone`.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly onSubstitutionSceneDone?: () => void
  /** 하늘 줄 — 구장 +0x10 (0x783b0). 미션은 장면마다 한 번 굴린 rand(0, 6) — 세션이 든다. 안 넘기면 타석 그림이 굴린다 */
  readonly skyRow?: number
  /**
   * **경기 난수** — 결과 판(경기 상태 0x19)의 배경 · 정산 효과(0x4ea0c 꼬리: 성공이면 밤하늘일 때 불꽃, 실패면 비)와 그림마다
   * 효과 · 파티클 틱이 쓴다. 안 넘기면 결과 판에 배경 · 효과가 없다.
   */
  readonly random?: RandomPort
}

export function PitchingScreen({
  run,
  repertoire,
  usesGauge,
  atBat,
  bannerText,
  magicRemaining,
  isMagicType,
  onThrow,
  onGiveUp,
  onFinish,
  onRetry,
  resultBoard,
  onPickoffKey,
  sceneConfirm: sceneConfirmWait,
  onSceneConfirm,
  substitutionScene = null,
  onSubstitutionSceneDone,
  skyRow,
  random,
  onRestart,
  settings,
  onSettingsChange,
}: PitchingScreenProps) {
  /**
   * 전역 경기 상태 +0x6b (`liveGameState`) — 미션 준비 0xaa57c 가 0xb6814 로 0 을 둔 뒤(0xaa5fc) 곧바로 0xaa698 이
   * `min(레코드 +3 아래 4비트, 0x63)` = 시작 이닝 인덱스를 쓴다(`start.inning` − 1). 재도전 · 다시하기도 같은 준비를 다시 돈다.
   * ⚠️ 미해결: 미션 경기 안의 이닝 넘김(0xb6b6c)은 웹 미션 진행에 이닝 칸이 없어 따라가지 않는다.
   */
  const missionInningIndex = run.game.inning
  useEffect(() => {
    setLiveGameInningIndex(missionInningIndex)
  }, [run.mission, missionInningIndex])

  const [phase, setPhase] = useState<PitchPhase>('구질')
  const [pitchType, setPitchType] = useState<PitchTypeInfo | null>(null)
  const [courseCell, setCourseCell] = useState(4)
  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /** 일시정지 팝업(0x741a0)이 떠 있는가 — 경기 중 메뉴 또는 그 하위 [조작방법] 뷰어. 경기 키가 안 간다 */
  const isPopupOpen = isMenuOpen || overlay !== null
  const isRunning = run.status === '진행중'
  // 결과 배경 캔버스의 난수 — 하늘 줄은 세션이 장면마다 한 번 굴린 `skyRow` 를 넘기므로 여기서 굴리지 않는다(넘기지 않은
  // 화면만 이 따로 든 난수로 굴린다 — 경기 난수에 새지 않게)
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()

  /**
   * 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*' 로 읽는다, 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴를 연다.
   * 미션 장면도 같은 경기 장면 0x104 라 그대로다. 결과 화면(끝난 미션)에서는 안 열린다.
   */
  useEffect(() => {
    if (!isRunning) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      event.preventDefault()
      menu.toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRunning, menu.toggle, overlay])
  /**
   * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0 — 공수·모드 갈림 없음). 결과 연출 동안은 받지 않는다.
   * ⚠️ 미이식: 0xe 그리기 0x4d9ec 가 0xd 그리기 위에 얹는 안내 판 0x44944.
   */
  // 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
  const sceneConfirm = useSceneConfirm(
    sceneConfirmWait,
    isRunning && bannerText === '' && !isPopupOpen && substitutionScene === null,
    onSceneConfirm,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && run.status === '진행중'

  // 견제 — 구질 고르기(0xf)에서만. 끝난 미션(결과 화면)·0xe(OK 대기)는 키를 안 받는다
  const acceptsPickoff =
    onPickoffKey !== undefined && phase === '구질' && isRunning && !isAwaitingConfirm && !isPopupOpen
  useEffect(() => {
    if (!acceptsPickoff || onPickoffKey === undefined) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      onPickoffKey(event.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsPickoff, onPickoffKey])

  const goals = goalsOf(run.mission, run.progress)

  if (run.status !== '진행중') {
    // [미션+0xbc] — 0x4ea0c 4ef2a · 0x4a384 4a3ea 의 "이겼나"
    const isSuccess = run.status === '성공'
    return (
      <PixelScreen title={run.mission.name}>
        <GoalBar goals={goals} />
        {/* 경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0 */}
        <div className={styles.matchupFrame}>
          {/*
            0x4a384 머리 — 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)을 먼저 그린다(선수 · 공 · HUD 없음). 갱신 0x4b100 은
            모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 가라앉는다. 정산 효과 0x4ea0c 꼬리(4f41a~)는 경기 난수로
          */}
          {random !== undefined && (
            <BattingStage
              skyRow={skyRow}
              // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
              batterAbility={STARTING_ABILITY}
              pitcherAbility={DEFAULT_PITCHER_ABILITY}
              swingMode="일반"
              gameMode={MISSION_PITCHER_MODE}
              isEagleEyeEnabled={false}
              hud={null}
              acePitcher={null}
              isPaused
              isResultBackdrop
              resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
              random={backdropRandom}
              settlement={{
                isWin: isSuccess,
                // 경기 상태 두 측 점수 0xb69b0 — 허용 실점 · 자동진행 반 이닝 득점이 모두 든 경기 칸(`run.game.scores`). 차이만 쓴다
                side0Score: run.game.scores[0],
                side1Score: run.game.scores[1],
                // 하늘 칸 — 경기 이닝 st[0x6b]
                inning: run.game.inning + 1,
                random,
                layers: settlementLayers,
              }}
              onPitchResolved={() => {}}
            />
          )}
          <MissionResultBoard
            isSuccess={isSuccess}
            {...(random === undefined ? {} : { effectLayers: settlementLayers })}
            earnedGamePoint={resultBoard?.earnedGamePoint ?? 0}
            {...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint })}
            {...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch })}
            onExit={(exit) => {
              if (resultBoard?.aceMatch === undefined && exit === '다시' && onRetry !== undefined) onRetry()
              else onFinish()
            }}
          />
        </div>
      </PixelScreen>
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
        hasSavedCareer={false}
        onChange={onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => {
          // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
          setOverlay(null)
          menu.reopen()
        }}
      />
    )
  }

  /** 게이지에서 누른 칸 g 를 그대로 넘긴다 (0x50e08 — 칸이 1~9 가 아니면 부르는 쪽이 무시한다) */
  const throwPitch = (gaugeCell: number) => {
    if (pitchType === null) return
    onThrow(pitchType, courseCell, gaugeCell, true)
    setPhase('구질')
    setPitchType(null)
  }

  /** 마구 칸인데 남은 횟수가 0 이하 — 0x50db8 이 키를 버린다 */
  const isBlockedMagic = (type: PitchTypeInfo): boolean =>
    magicRemaining !== undefined && isMagicType?.(type) === true && magicRemaining <= 0

  const typeItems: MenuItem[] = repertoire.map((type) => ({
    id: type.name,
    label: type.name,
    detail:
      isMagicType?.(type) === true && magicRemaining !== undefined
        ? `마구 · 남은 ${magicRemaining}회${magicRemaining <= 0 ? ' (못 던짐)' : ''}`
        : `구속 ${Math.round(type.speed * 100)} · 변화 ${Math.round(
            (Math.abs(type.horizontalBreak) + Math.abs(type.verticalBreak)) * 100,
          )}`,
  }))

  return (
    <>
    <PixelScreen
      title={run.mission.name}
      badge={remainingBadgeOf(run)}
      leftKey={
        isAwaitingConfirm && !isMenuOpen
          ? // 0xe — OK 하나만 받는다 (0x532b0). 구질 고르기(0xf)는 OK 뒤다
            { label: '확인', onPress: sceneConfirm.confirm, isDisabled: !sceneConfirm.acceptsConfirm }
          : undefined
      }
      // 소프트키1 도 0x498d4 가 '*' 로 읽는다 (498e8) — 경기 중 메뉴
      rightKey={{ label: isMenuOpen ? '닫기' : '메뉴', onPress: menu.toggle }}
    >
      <GoalBar goals={goals} />
      <Hint>
        {atBat.balls}볼 {atBat.strikes}스트라이크 {bannerText !== '' && `· ${bannerText}`}
      </Hint>

      {isMenuOpen && (
        <InGameMenu
          // 미션 투수편 = 모드 5 — 표 0xcfcfc 행 1(계속·다시하기·조작방법·설정·나가기)
          mode={MISSION_PITCHER_MODE}
          cursor={menu.cursor}
          onCursorChange={menu.setCursor}
          onContinue={menu.close}
          onQuit={onGiveUp}
          onRestart={onRestart}
          onOpenHelp={() => {
            menu.close()
            setOverlay('조작방법')
          }}
          onOpenSettings={
            settings === undefined || onSettingsChange === undefined
              ? undefined
              : () => {
                  menu.close()
                  setOverlay('설정')
                }
          }
        />
      )}

      {/*
        0xe — 0xd 두 그림 뒤 0x4d9ec 가 투수·타자 소개 판 0x44944 를 그린다(모드 검사 없음). 내가 던지므로 투수 PLAYER · 타자 COM.
        ⚠️ 원본은 판 아래 0xd 그리기(타석 장면)가 깔리지만 웹 투구 화면엔 그 캔버스가 없다. 웹 미션 상태에 없는 칸은 비운다.
      */}
      {/*
        교체 연출 0x16 — 0x4da30 의 "CHANGE" 애니. ⚠️ 원본은 그 아래 타석 그림이 깔리지만 웹 투구 화면엔 그 캔버스가 없다.
      */}
      {isRunning && substitutionScene !== null && (
        <div className={styles.matchupFrame}>
          <SubstitutionSceneOverlay key={substitutionScene.serial} onDone={() => onSubstitutionSceneDone?.()} />
        </div>
      )}

      {!isPopupOpen && isAwaitingConfirm && sceneConfirm.isInConfirmState && (
        <div className={styles.matchupFrame}>
          <SceneMatchupCards batterHand={0} pitcher={{ isComputer: false }} batter={{ isComputer: true }} />
        </div>
      )}

      {!isPopupOpen && phase === '구질' && !isAwaitingConfirm && (
        <>
          <Panel heading="1. 구질 선택" />
          <MenuList
            items={typeItems}
            onSelect={(id) => {
              const found = repertoire.find((type) => type.name === id)
              if (found === undefined || isBlockedMagic(found)) return
              setPitchType(found)
              setPhase('코스')
            }}
          />
        </>
      )}

      {!isPopupOpen && phase === '코스' && (
        <>
          <Panel heading={<>2. 코스 선택 — {pitchType?.name}</>} />
          <CourseGrid
            selectedCell={courseCell}
            onSelect={(cell) => {
              setCourseCell(cell)
              if (usesGauge) {
                setPhase('게이지')
              } else if (pitchType !== null) {
                // 기본 투구 — 게이지 단계가 아예 없고, 등급은 제구·체력 표로 뽑힌다 (0x4dbac)
                onThrow(pitchType, cell, 0, false)
                setPhase('구질')
                setPitchType(null)
              }
            }}
          />
          <Hint>노릴 코스를 고르세요 · 존 밖으로 빼려면 가장자리</Hint>
        </>
      )}

      {!isPopupOpen && phase === '게이지' && (
        <>
          {/* 원본에는 결과 글자가 없다 — 작아지는 원 한 장뿐이라 안내 문구도 붙이지 않는다 (S5 U-15) */}
          <Panel heading="3. 투구 결정" />
          <PitchGradeGauge onPress={throwPitch} />
        </>
      )}
    </PixelScreen>
    {overlay === '조작방법' && (
      <HelpScreen
        onBack={() => {
          // 뷰어를 닫으면(0x3ca36: 0x637d0 ≠ 0) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로,
          // 메뉴 객체는 안 건드려 커서가 그대로다
          setOverlay(null)
          menu.reopen()
        }}
      />
    )}
    </>
  )
}

/** 남은 시간·투구 수를 타이틀바 배지로. 제한이 없으면 배지도 없다. */
function remainingBadgeOf(run: PitcherRun): string | undefined {
  const parts: string[] = []
  if (run.remainingSeconds !== null) parts.push(`${Math.ceil(run.remainingSeconds)}초`)
  if (run.remainingPitches !== null) parts.push(`${Math.max(0, run.remainingPitches)}구`)
  return parts.join(' · ') || undefined
}
