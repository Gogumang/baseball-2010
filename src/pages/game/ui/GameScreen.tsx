import { useEffect, useRef, useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { RecordAlertPanel } from '@/widgets/game-scene/ui/RecordAlertPanel'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { gameMatchupCardsOf } from '@/pages/game/lib/gameMatchupCards'
import { gameHalfInningCardsOf } from '@/pages/game/lib/gameHalfInningCards'
import { activeSound } from '@/shared/api/audio/soundPort'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { mySpecialSwingRemainingOf, stealableBasesOf } from '@/features/play-game/model/gameFlow'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { RUTHLESS_SKILL_ID } from '@/entities/batting/model/specialSwing'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import * as styles from '@/pages/game/ui/GameScreen.css'
import { detail } from '@/shared/ui/MenuList/MenuList.css'

const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`

interface GameScreenProps {
  readonly career: PlayerCareer
  readonly progress: GameProgress
  readonly atBat: AtBatState
  readonly pitcherAbility: PitcherAbility
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 상대 마투수의 마구 횟수
   * 0xd8509[레벨] (0xaebe4) 이 이 칸을 본다 — 안 넘기면 Lv1(3 회).
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  /** 세 번째 인자는 **필살타법이 성공한 타구인가** (0x51800) */
  /** 넷째 인자는 이 공의 번트 종류(장면 +0xfdc, `BattingStage.onPitchResolved`) — 타구 판 리드(0x3d7b8)가 본다 */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => void
  /** 경기를 그만두고 메인 메뉴로 (이 경기 기록은 사라진다) */
  readonly onQuit: () => void
  /**
   * **도루 출발** (원본 0x53610 → 메시지 0x583 → 0xa9bd4). 인자는 대상 주자가 선 루다 —
   * 키 '3' 1루 주자 · '2' 2루 주자 · '1' 3루 주자(홈으로). 판정은 공이 도착할 때 도루 판이 한다.
   * 안 넘기면 도루 입구가 뜨지 않는다.
   */
  readonly onSteal?: (base: StealBase) => void
  /**
   * **CPU 투수의 견제** — 상대 투수 AI 가 목표점 대신 견제(종류 4, 0x34848)를 고르면 타석 화면이 공을 안 던지고
   * 그 루를 알려 준다. 원본 0x345fc 는 홈런더비(모드 7)만 갈라 타자편(모드 4)도 견제한다.
   * 안 넘기면 견제가 꺼진다(종류 4 → 1, `selectPitch` 주석).
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 값. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 벤치 클리어링 연출(상태 0x1e)이 끝났다 — `progress.pendingBenchClearing` 이 차 있는 동안 타석 대신 연출을 띄운다.
   * 인자는 틱 10 의 갱신이 돌았는가 (진행기 `resolveBenchClearing` 이 그 굴림 8 번을 낸다).
   */
  readonly onBenchClearingDone?: (reachedTargetTick: boolean) => void
  /**
   * 필살 스윙이 나간 틱(`0x4e136`)에 줄인 남은 횟수를 받는다 — 진행기(`spendMySpecialSwing`)가 든다.
   * 안 넘기면 횟수를 줄여도 받아 줄 곳이 없어 경기 내내 처음 횟수로 남는다.
   */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  /** 경기 중 기록 달성 알림 0x4e35c 의 이번 그림 (`useRecordAlert`, 부르는 쪽이 든다). 안 넘기면 안 그린다 */
  readonly recordAlert?: RecordAlertFrame
  /** 알림을 든 쪽에 이 화면의 팝업 · 장면 갈래를 알린다 (`RecordAlertScene`) — 바뀔 때마다 */
  readonly onRecordAlertSceneChange?: (scene: RecordAlertScene) => void
}

/**
 * 기록 달성 알림을 든 쪽(`app/ui/GameRoute`)이 이 화면에서 알아야 할 것.
 * - `isFrozen`: 팝업 관리자 [0x140005c]+9 — 경기 중 메뉴 · 그 하위(조작방법 · 설정)가 떠 있으면 0x52cc6 이 장면 갱신을 막아
 *   알림의 폭 · 시간 · 상태 틱과 0x12 대기 틱이 안 오른다.
 * - `key`: 상태 틱 [+0x2c] 를 0 부터 다시 세는 장면 갈래 — ⚠️ 근사(벤치 클리어링 0x1e · 1회초 판 0x18 · 0xe 대기 · 타석).
 */
export interface RecordAlertScene {
  readonly isFrozen: boolean
  readonly key: string
}

/** 나만의리그 타자편 = 원본 전역 모드 4 — 경기 중 메뉴 표 0xcfcfc 의 **행 2**(네 칸)다 */
const BATTER_CAREER_MODE = 4
/** 경기 화면을 덮는 하위 화면 */
type MenuOverlay = '조작방법' | '설정'

export function GameScreen({
  career,
  progress,
  atBat,
  pitcherAbility,
  aceLevels,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  onQuit,
  onSteal,
  onPickoff,
  settings,
  onSettingsChange,
  onBenchClearingDone,
  onSpecialSwingUsed,
  recordAlert,
  onRecordAlertSceneChange,
}: GameScreenProps) {
  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  const isEagleEyeEnabled = career.eagleEyeGamesRemaining > 0
  const ace = progress.aceOpponent
  /**
   * 경기 중 모은 G포인트 누계. 원본도 기록을 달성할 때마다 더해 화면에 보여 준다 (0xa77f0 이 evt+0x180 에 누적).
   * 원본이 이 숫자를 어디에 그리는지는 아직 못 찾아, 웹 껍데기의 제목 옆 칸에 둔다 (추정).
   */
  const earnedGamePoint = recordGamePointsOf(progress.recordIds)

  /** 지금 출발시킬 수 있는 루 — `canStartSteal`(0xa9924 앞길 검사). 이번 공에 이미 출발한 주자는 빠진다 */
  const stealableBases = onSteal === undefined ? [] : stealableBasesOf(progress)
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const stealIfFlying = (base: StealBase) => {
    if (flightProbeRef.current?.() !== true) return
    onSteal?.(base)
  }

  const isBenchClearing = progress.pendingBenchClearing !== null
  /** OK 로 1회초 판을 닫았는가 */
  const [isBoardClosed, setBoardClosed] = useState(false)
  const board = progress.halfInningBoard ?? null
  const isHalfInningBoardOpen = !isBoardClosed && board !== null && isAtFirstPitchOf(progress, atBat)
  /**
   * **상태 0xe — 내 타석마다 사람 OK 를 기다린다** (`features/play-game/model/sceneConfirm`, 0x39e14 → 0x532b0).
   * 타석 결과 연출·돌발 창·1회초 판·벤치 클리어링·경기 중 메뉴·조작방법·설정이 덮고 있으면 받지 않는다.
   * 받은 OK 는 진행기가 실은 대기 객체에 남아, 수비 화면을 갔다 와 이 화면이 다시 서도 다시 묻지 않는다.
   * 돌발 제안 창(0x1b)은 원본처럼 OK 뒤에 선다 — 그 창을 띄우는 `app/ui/GameRoute` 가 대기가 끝나기를 기다린다.
   */
  /** 상태 0xe 소개 판 값 (0x44944) */
  const matchup = gameMatchupCardsOf(progress, career)
  const sceneConfirm = useSceneConfirm(
    progress.sceneConfirm,
    !isPaused &&
      bannerText === '' &&
      !isMenuOpen &&
      overlay === null &&
      !isBenchClearing &&
      !isHalfInningBoardOpen,
  )
  /** 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2'/'1' */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      // 벤치 클리어링(0x1e)·1회초 판(0x18) 중에는 공용 키가 안 열린다 (0x498d4 의 상태 범위 밖)
      if (isBenchClearing || isHalfInningBoardOpen) return
      // 조작방법 뷰어(경기 중 메뉴 하위 4)의 키는 0x3ca36 이 뷰어 0x637d0 에만 준다 — '*' 도 아무 일 안 한다
      if (overlay === '조작방법') return
      if (event.key === '*') {
        event.preventDefault()
        return menu.toggle()
      }
      if (isMenuOpen || overlay !== null) return
      const base = stealBaseOfKey(event.key)
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        // 공이 나는 동안(상태 0x11)만 — 그 밖의 키는 원본도 먹고 끝난다
        if (flightProbeRef.current?.() === true) onSteal?.(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isBenchClearing, isHalfInningBoardOpen, isMenuOpen, menu.toggle, onSteal, overlay, stealableBases])

  // 기록 달성 알림의 팝업 멈춤 · 장면 갈래를 알림을 든 쪽에 알린다 (`RecordAlertScene`)
  const isAlertFrozen = isMenuOpen || overlay !== null
  const alertSceneKey = isBenchClearing
    ? 'benchClearing'
    : isHalfInningBoardOpen
      ? `board-${board?.serial ?? 0}`
      : sceneConfirm.isAwaiting
        ? 'confirm'
        : 'play'
  useEffect(() => {
    onRecordAlertSceneChange?.({ isFrozen: isAlertFrozen, key: alertSceneKey })
  }, [alertSceneKey, isAlertFrozen, onRecordAlertSceneChange])

  // 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 공용 키 '*'·도루도 0x1e 에서는 안 열린다
  if (progress.pendingBenchClearing !== null && onBenchClearingDone !== undefined) {
    return <BenchClearingScene onDone={onBenchClearingDone} />
  }

  /**
   * 1회초 판(상태 0x18) — 선공·1번 타자일 때만 진행기가 세운다(`gameFlow.withFirstInningBoard`, 굴림 36 개는 그때 썼다).
   * 징글 13 은 판의 틱 2 (0x4f7ac). OK → 0xae3a0 → 0xd → 첫 타석.
   */
  if (isHalfInningBoardOpen && board !== null) {
    return (
      <HalfInningBoard
        inning={board.inning}
        half={board.half}
        onTick={(tick) => {
          if (tick === HALF_INNING_JINGLE_TICK) activeSound().play(HALF_INNING_SOUND)
        }}
        // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
        scoreboardSides={humanVsComputerSidesOf(progress.game.playerSide, career.teamId, progress.opponentTeamId)}
        // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
        cards={gameHalfInningCardsOf(progress, career, board.half)}
        onConfirm={() => setBoardClosed(true)}
      />
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

  return (
    <>
      <PixelScreen
        title={`${career.name} · ${career.battingOrder}번타자`}
        badge={
          isEagleEyeEnabled
            ? `G ${earnedGamePoint} · 이글아이 ${career.eagleEyeGamesRemaining}`
            : `G ${earnedGamePoint}`
        }
        leftKey={
          sceneConfirm.isAwaiting && !isMenuOpen
            ? // 0xe — OK 하나만 받는다 (0x532b0)
              { label: '확인', onPress: sceneConfirm.confirm, isDisabled: !sceneConfirm.acceptsConfirm }
            : stealableBases.length > 0 && !isMenuOpen
            ? {
                label: `도루 ${stealableBases[0]}루`,
                onPress: () => stealIfFlying(stealableBases[0]),
              }
            : undefined
        }
        rightKey={{
          label: isMenuOpen ? '닫기' : '메뉴',
          onPress: menu.toggle,
        }}
      >
        {/* 0xe 에서 화면을 누르면 OK 로 본다 (터치용 웹판 편의 — 캔버스 탭이 스윙인 것과 같은 자리) */}
        <div className={styles.stageArea} onClick={sceneConfirm.acceptsConfirm ? sceneConfirm.confirm : undefined}>
          {ace !== null && (
            <div className={styles.aceAlert}>
              <img src={ace.iconUrl} alt={ace.name} width={33} height={33} />
              <div>
                <strong>{ace.name}</strong> 등판!
                <span className={detail}>필살기 · {ace.burst}</span>
              </div>
            </div>
          )}

          <BattingStage
            batterAbility={effectiveAbilityOf(career)}
            // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드를 안 본다. 타자편은 내 선수가 쳐서 마선수(0xb633c)가 아니다
            canBunt
            swingMode="나만의리그"
            gameMode={BATTER_CAREER_MODE}
            // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
            isScoreboardOn={settings?.isScoreboardOn}
            // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
            isVibrationOn={settings?.isVibrationOn}
            // 타자 폼 = 원본 rec[0xb] 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a) — 장타형이면 sluger 몸통이 나온다
            batterForm={career.battingTypeIndex * 2 + career.battingSide}
            // 고른 피부(0 황인 · 1 백인 · 2 흑인)와 장비를 타석 그림에 입힌다 —
            // 안 넘기면 구운 벌(피부 0)과 맨몸으로 나간다
            batterSkinIndex={career.skinIndex}
            batterEquipmentLevels={career.equipmentLevels}
            // 스윙 결과 0xab214 는 0xb62b4 = 장착 비트(+0x14)만 본다 — 보유 전부가 아니다
            batterSkillIds={career.equippedSkillIds}
            recentAtBatCodes={progress.recentAtBatCodes}
            pitcherAbility={pitcherAbility}
            // 마선수 대결의 상대 마투수 마구 횟수 = 0xd8509[mgr[0x13a + 순번]] (0xaebe4)
            aceLevels={aceLevels}
            hud={{
              inning: progress.game.inning,
              half: progress.game.half,
              ourScore: progress.game.ourScore,
              opponentScore: progress.game.opponentScore,
              balls: atBat.balls,
              strikes: atBat.strikes,
              outs: progress.game.outs,
              bases: progress.game.bases,
              // HUD 팀 아이콘은 작은 로고 ui/team_logo_ini (0x373d0)
              ourLogoUrl: smallLogoUrlOf(career.teamId),
              opponentLogoUrl: smallLogoUrlOf(progress.opponentTeamId),
              ourTeamId: career.teamId,
              opponentTeamId: progress.opponentTeamId,
            }}
            isEagleEyeEnabled={isEagleEyeEnabled}
            acePitcher={
              ace === null
                ? null
                : { framesUrl: ace.framesUrl, frameCount: ace.frameCount, stillUrl: ace.stillUrl }
            }
            // 조작방법 뷰어 동안도 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            // 0xe(OK 대기)에서도 공이 안 나간다 — 타석 장면(0xd 그리기)만 선다
            isPaused={isPaused || isMenuOpen || overlay !== null || sceneConfirm.isAwaiting}
            random={random}
            // 필살타법 '0' (0x535a4 → 0x51dee → 0x34c74). 레벨이 아니라 **고른 번호**(+0x18)를 넘긴다 —
            // 0 이면(아직 안 고름) '0' 키가 무시된다
            specialSwingNumber={career.specialSwingNumber}
            // 한 경기 횟수 s8 team[+0x29 + 타순] — 0xaebe4 가 표 0xd84f0[+0x18] (+ 스킬 23 무자비 1)로 채운다
            specialSwingRemaining={mySpecialSwingRemainingOf(progress, {
              swingNumber: career.specialSwingNumber,
              hasRuthlessSkill: career.equippedSkillIds.includes(RUTHLESS_SKILL_ID),
            })}
            onSpecialSwingUsed={onSpecialSwingUsed}
            // 0xab214 의 내 선수 보너스 — 모드 4 에서 rec = 0x1f8d4(저장, 4) = [저장+0xbc]+0x11c 의 rec[0xa] 비트7(육성)이
            // 서고(0xb6389, ab3d6), 연차 idx 는 같은 레코드 +0xb3 (ab3f2) — 커리어 연차는 1부터라 1 을 뺀다
            isBatterOwnPlayer
            careerYearIndex={career.season - 1}
            onPitchResolved={onPitchResolved}
            flightProbeRef={flightProbeRef}
            onPickoff={onPickoff}
          />
          {/*
            0xe 그리기 0x4d9ec — 0xd 두 그림 뒤 타석 장면 위에 투수·타자 소개 판 0x44944. 팀 글자는 0xb6c20: 내 팀 PLAYER · 상대 COM.
            값은 `gameMatchupCardsOf` (내 레코드 · 상대 마운드).
          */}
          {sceneConfirm.isAwaiting && sceneConfirm.isInConfirmState && <SceneMatchupCards {...matchup} />}
          {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c — 그리기 표 다음이라 맨 위 */}
          {recordAlert !== undefined && <RecordAlertPanel frame={recordAlert} />}
        </div>

        {isMenuOpen ? (
          <InGameMenu
            // 나만의리그 타자편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
            mode={BATTER_CAREER_MODE}
            cursor={menu.cursor}
            onCursorChange={menu.setCursor}
            onContinue={menu.close}
            onQuit={onQuit}
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
        ) : bannerText === '' ? (
          <Hint>
            탭·Space·5 스윙 · 좌우 끝 탭·←→(4·6) 타자 이동 · 8·7·9(Shift)·길게 눌러 번트
            {stealableBases.includes(1) && ' · 3 도루(1루)'}
            {stealableBases.includes(2) && ' · 2 도루(2루)'}
            {stealableBases.includes(3) && ' · 1 도루(3루)'}
          </Hint>
        ) : (
          <BigResult>{bannerText}</BigResult>
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

/**
 * 판이 아직 OK 를 기다리는 자리인가 — 경기 첫 타석의 첫 공 전(아웃·주자·점수 없고 볼카운트 0-0).
 * 이 화면은 수비 재생 동안 앱이 내렸다 다시 올리므로(닫힘 상태가 사라진다) 판이 다시 서지 않게
 * 경기가 한 걸음이라도 나갔으면 판을 안 띄운다. 1회초 판은 경기 첫 장면에만 서므로 이것으로 충분하다.
 */
function isAtFirstPitchOf(progress: GameProgress, atBat: AtBatState): boolean {
  const { game } = progress
  return (
    game.inning === 1 &&
    game.outs === 0 &&
    game.ourScore === 0 &&
    game.opponentScore === 0 &&
    !game.bases.first &&
    !game.bases.second &&
    !game.bases.third &&
    atBat.balls === 0 &&
    atBat.strikes === 0
  )
}
