import { useEffect, useRef, useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import * as styles from '@/pages/mission-play/ui/MissionPlayScreen.css'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { goalsOf } from '@/entities/mission/model/missionGoal'
import { GoalBar } from '@/entities/mission/ui/GoalBar'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/MissionResultBoard'
import { setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'

interface MissionPlayScreenProps {
  readonly run: MissionRun
  readonly ability: BatterAbility
  /**
   * 지금 타자 이름 — 마스터 타순 차례(미션 타자가 아닌 사람 칸 타자)면 그 줄 이름(0xb62c0). 0xe 소개 판 0x44944 의 타자 칸.
   * 안 넘기면 비운다(미션 타자 — 웹 미션 상태에 이름 칸이 없다).
   */
  readonly batterName?: string
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 미션은 나리 타자편 저장을 올리므로 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  readonly pitcherAbility: PitcherAbility
  /** 마투수 미션의 상대. 일반 투수면 null */
  readonly opponent: AcePlayer | null
  readonly atBat: AtBatState
  readonly isPaused: boolean
  readonly bannerText: string
  readonly random: RandomPort
  /** 셋째 인자는 필살타법이 성공한 타구인가 · 넷째는 번트 종류 장면 +0xfdc (`BattingStage.onPitchResolved` 그대로) */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean, buntKind?: number) => void
  /**
   * 치는 선수의 **고른 필살 번호** (레코드 +0x18) — '0' 키 0x51dee 가 S+0x10 에 싣는다. 안 넘기면 0 = '0' 키 무시.
   */
  readonly specialSwingNumber?: number
  /** 이 미션 한 판의 남은 필살 횟수 (0xaea30). 안 넘기면 횟수 제한 없이 번호만 본다 (`BattingStage` 기본) */
  readonly specialSwingRemaining?: number
  /** 필살 스윙이 나가 남은 횟수가 줄었다 (0x4e136) — 인자는 줄인 뒤 값 */
  readonly onSpecialSwingUsed?: (remaining: number) => void
  /**
   * 이 공 앞의 장면 +0xfdc(마지막으로 쓴 번트 종류) — 타석 화면(`BattingStage.sceneBuntKind`)이 사람 키로 고치고 판정된 공의
   * `onPitchResolved` 넷째 인자로 돌려준다. 부르는 쪽이 경기 장면 동안 들고 있다가 다시 넘긴다. 안 주면 타석 화면이 스스로 든다.
   */
  readonly sceneBuntKind?: number
  readonly onGiveUp: () => void
  /** 결과 판에서 미션 목록으로(0x140006c = 1) — 마선수 대결이면 대결 끝(결과 이벤트로) */
  readonly onFinish: () => void
  /**
   * 결과 판에서 "예"(0x140006c = 3) — 같은 미션을 곧바로 다시. 안 넘기면 `onFinish` 와 같다.
   * 마선수 대결(`resultBoard.aceMatch`)은 어느 키든 `onFinish` 다(0x4b100 이 원래 모드로 돌려보낸다).
   */
  readonly onRetry?: () => void
  /**
   * 결과 판 0x4a384(모드 5·6) 의 값 — 번 G [+0x17f4] · 보유 G g[0x64] · 마선수 대결 칸. 안 넘기면 번 G 0 · 보유 칸 비움
   */
  readonly resultBoard?: Pick<MissionResultBoardProps, 'earnedGamePoint' | 'heldGamePoint' | 'aceMatch'>
  /**
   * 마선수 레벨 열 칸 (`useAceLevels` 의 `levels`) — `BattingStage` 로 그대로 넘긴다.
   * 상대 마투수의 마구 횟수가 `0xd8509[레벨]` = [3,4,5,6,7] 을 따른다 (타석 교대 0xaebe4). 안 넘기면 Lv1 = 3회.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **CPU 투수의 견제** — `BattingStage.onPickoff` 로 그대로 넘긴다. 미션(모드 6)도 견제 길에 모드·미션 갈림이 없다
   * (0x50f28 · 0x345fc 의 갈림은 홈런더비 하나). 안 넘기면 견제가 꺼진다.
   */
  readonly onPickoff?: (base: 1 | 2 | 3) => void
  /**
   * **도루 출발** (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`). 인자는 대상 주자가 선 루다.
   * 판정은 공이 도착할 때 도루 판(종류 5)이 한다.
   */
  readonly onSteal: (base: StealBase) => void
  /** 지금 출발시킬 수 있는 루 (`canStartSteal`). 안 넘기면 도루 입구가 없다 */
  readonly stealableBases?: readonly StealBase[]
  /**
   * 경기 중 메뉴 **"다시하기"** (표 0xcfcfc 행 1 · StrGAME[7], `0x3c706`).
   * 미션·홈런더비 행만 자동진행 자리에 이 칸이 온다. 안 넘기면 칸이 잠긴다.
   */
  readonly onRestart?: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * **상태 0xe 의 OK 대기** — 세션이 새 타석마다 싣는다 (`useMissionSession.sceneConfirm`). 안 넘기면 기다리지 않는다
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /** 0xe 의 OK 하나를 받을 때마다 — 세션이 0xf 진입(CPU 투수 교체 0xac428)을 이때 묻는다 (`useMissionSession.confirmScene`) */
  readonly onSceneConfirm?: () => void
  /**
   * **교체 연출 0x16** — 서 있으면 타석을 멈추고 "CHANGE" 애니(0x4da30)를 얹으며 0xe 대기를 세지 않는다.
   * 다 그리면 `onSubstitutionSceneDone`.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly onSubstitutionSceneDone?: () => void
}

/**
 * 미션 타자편 = 원본 전역 모드 **6** — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(다시하기가 있는 줄).
 * 모드 5 가 XlsPITCHER_MISSION 을 올리는 투수편이다 (Q2-mission-rewards 1-0 확정).
 * 행은 "모드 5~7 → 1" 이라 5·6 어느 쪽이든 같은 칸이 나온다.
 */
const MISSION_BATTER_MODE = 6
type MenuOverlay = '조작방법' | '설정'

export function MissionPlayScreen({
  run,
  ability,
  batterName,
  batterSkillIds,
  pitcherAbility,
  opponent,
  atBat,
  isPaused,
  bannerText,
  random,
  onPitchResolved,
  specialSwingNumber,
  specialSwingRemaining,
  onSpecialSwingUsed,
  sceneBuntKind,
  aceLevels,
  onPickoff,
  onGiveUp,
  onFinish,
  onRetry,
  resultBoard,
  onSteal,
  stealableBases = [],
  onRestart,
  settings,
  onSettingsChange,
  sceneConfirm: sceneConfirmWait,
  onSceneConfirm,
  substitutionScene = null,
  onSubstitutionSceneDone,
}: MissionPlayScreenProps) {
  /**
   * 전역 경기 상태 +0x6b (`liveGameState`) — 미션 준비 0xaa57c 가 0xb6814 로 0 을 둔 뒤(0xaa5fc) 곧바로 0xaa698 이
   * `min(레코드 +3 아래 4비트, 0x63)` = 시작 이닝 인덱스를 쓴다(`start.inning` − 1). 재도전 · 다시하기도 같은 준비를 다시 돈다.
   * ⚠️ 미해결: 미션 경기 안의 이닝 넘김(0xb6b6c)은 웹 미션 진행에 이닝 칸이 없어 따라가지 않는다.
   */
  const missionStartInningIndex = run.mission.start.inning - 1
  useEffect(() => {
    setLiveGameInningIndex(missionStartInningIndex)
  }, [run.mission, missionStartInningIndex])

  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  const goals = goalsOf(run.mission, run.progress)
  const isOver = run.status !== '진행중'
  /** [미션+0xbc] — 결과 판 · 정산 효과의 "이겼나" (0x4ea0c 4ef2a · 0x4a384 4a3ea) */
  const isSuccess = run.status === '성공'
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  /**
   * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0, 모드 갈림 없음). 결과 연출·메뉴·조작방법·설정이 덮으면
   * 받지 않는다. ⚠️ 미이식: 0xe 그리기 0x4d9ec 가 0xd 그리기 위에 얹는 안내 판 0x44944.
   */
  const isSubstituting = !isOver && substitutionScene !== null
  // 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
  const sceneConfirm = useSceneConfirm(
    sceneConfirmWait,
    !isOver && !isPaused && bannerText === '' && !isMenuOpen && overlay === null && !isSubstituting,
    onSceneConfirm,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && !isOver
  /**
   * 번트 키 '7'/'8'/'9' — 원본은 미션 목표와 상관없이 받는다. 타격 키 0x535a4 는 모드를 안 보고 0x6a7 을 보내고,
   * 받는 0x51e48 은 상태 0x11 · S+4(스윙 받을 준비) · 지금 타자(0xae89c)가 마선수(0xb633c, +0xa 비트6)가 아님만 본다.
   * 미션은 나리 타자편 저장의 선수가 치므로 마선수가 아니다 → 늘 켠다.
   */
  const canBunt = true
  // 도루 출발 — 사람 공격이고 앞길이 열린 주자가 있을 때 (`canStartSteal`). 목표에 도루가 없어도 키는 먹는다
  const canSteal = !isOver && stealableBases.length > 0
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  const stealIfFlying = (base: StealBase) => {
    if (flightProbeRef.current?.() === true) onSteal(base)
  }
  // 원본 공용 키 처리 0x498d4 — 도루 '3'/'2'/'1' (공이 나는 동안만, 그 밖의 키는 먹고 끝난다)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isMenuOpen || overlay !== null) return
      const base = stealBaseOfKey(event.key)
      if (base !== null && stealableBases.includes(base)) {
        event.preventDefault()
        if (flightProbeRef.current?.() === true) onSteal(base)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen, onSteal, overlay, stealableBases])

  const badgeParts: string[] = []
  if (run.remainingSeconds !== null) badgeParts.push(`${Math.ceil(run.remainingSeconds)}초`)
  if (run.remainingPlateAppearances !== null) {
    badgeParts.push(`${Math.max(0, run.remainingPlateAppearances)}타석`)
  }
  if (run.remainingSwings !== null) badgeParts.push(`${Math.max(0, run.remainingSwings)}스윙`)

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
        title={run.mission.name}
        badge={badgeParts.join(' · ') || undefined}
        leftKey={
          isOver
            ? // 결과 판(0x19)은 제 키(0x407f0)를 받는다
              undefined
            : isAwaitingConfirm && !isMenuOpen
              ? // 0xe — OK 하나만 받는다 (0x532b0)
                { label: '확인', onPress: sceneConfirm.confirm, isDisabled: !sceneConfirm.acceptsConfirm }
            : canSteal
              ? { label: `도루 ${stealableBases[0]}루`, onPress: () => stealIfFlying(stealableBases[0]) }
              : undefined
        }
        rightKey={
          isOver
            ? undefined
            : { label: isMenuOpen ? '닫기' : '메뉴', onPress: menu.toggle }
        }
      >
        <GoalBar goals={goals} />

        {isMenuOpen && (
          <InGameMenu
            // 미션 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
            mode={MISSION_BATTER_MODE}
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

        {/* 0xe 에서 화면을 누르면 OK 로 본다 (터치용 웹판 편의 — 캔버스 탭이 스윙인 것과 같은 자리) */}
        <div className={styles.stageArea} onClick={sceneConfirm.acceptsConfirm ? sceneConfirm.confirm : undefined}>
          <BattingStage
            batterAbility={ability}
            batterSkillIds={batterSkillIds}
            // 판정 묶음 '미션' = 모드 6(타자 미션) — 공격(사람) +100 (0xab5c0)
            swingMode="미션"
            // 미션은 나리 타자편 저장의 선수(등록 타자 rec[0xa] 0xa0 — 비트7)가 친다. 내 선수 보너스는 모드 3·4 에서만
            // 켜지므로(sp40) 판정 값은 안 바뀐다 — 연차도 그 갈래에서만 읽혀 넘기지 않는다
            isBatterOwnPlayer
            specialSwingNumber={specialSwingNumber}
            specialSwingRemaining={specialSwingRemaining}
            onSpecialSwingUsed={onSpecialSwingUsed}
            sceneBuntKind={sceneBuntKind}
            gameMode={MISSION_BATTER_MODE}
            // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
            isScoreboardOn={settings?.isScoreboardOn}
            // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
            isVibrationOn={settings?.isVibrationOn}
            pitcherAbility={pitcherAbility}
            isEagleEyeEnabled={false}
            // 시작 상황을 원본 HUD 에 보인다. 미션 팀 로고는 레코드에 없어 기본 두 팀을 쓴다 (추정)
            hud={{
              inning: run.mission.start.inning,
              half: '말',
              ourScore: run.mission.start.ourScore + (run.progress.counts['타점'] ?? 0),
              opponentScore: run.mission.start.opponentScore,
              balls: atBat.balls,
              strikes: atBat.strikes,
              outs: run.outs,
              bases: run.bases,
              ourLogoUrl: './sprites/team_logo_ini/000.png',
              opponentLogoUrl: './sprites/team_logo_ini/001.png',
            }}
            acePitcher={
              opponent === null
                ? null
                : { framesUrl: opponent.framesUrl, frameCount: opponent.frameCount, stillUrl: opponent.stillUrl }
            }
            canBunt={canBunt}
            // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            // 0xe(OK 대기)에서도 공이 안 나간다
            // 교체 연출 0x16 에는 갱신이 없다(R10 표 — 진입 0x3d458 · 그리기 0x4da30 뿐)
            isPaused={isPaused || isOver || overlay !== null || isAwaitingConfirm || isSubstituting}
            random={random}
            /*
              경기 상태 0x19 — 결과 그림 0x4a384 는 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)만 그린다(선수 · 공 · HUD 없음).
              갱신 0x4b100 은 모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 150 까지 가라앉는다.
              정산 진입 0x4ea0c 꼬리(4f41a~)는 모드를 안 가린다 — 성공(4ef36 [sp+0x50] = 1)이면 밤하늘일 때 불꽃, 실패(4efb4 = 0)면
              비(|0xb69b0(0) − (1)| × 30). 효과 · 파티클 틱은 경기 난수로 그림마다 돈다
            */
            isResultBackdrop={isOver}
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
            {...(!isOver
              ? {}
              : {
                  settlement: {
                    isWin: isSuccess,
                    // 경기 상태 두 측 점수 — 위 HUD 와 같은 근사(웹 미션은 득점 칸을 따로 안 든다). 차이의 절댓값만 쓴다
                    side0Score: run.mission.start.opponentScore,
                    side1Score: run.mission.start.ourScore + (run.progress.counts['타점'] ?? 0),
                    // 하늘 칸 — 타석 하늘과 같은 미션 시작 이닝(⚠️ 미션 안 이닝 넘김은 웹 미션이 안 따른다)
                    inning: run.mission.start.inning,
                    random,
                    layers: settlementLayers,
                  },
                })}
            aceLevels={aceLevels}
            onPitchResolved={onPitchResolved}
            onPickoff={onPickoff}
            flightProbeRef={flightProbeRef}
          />

          {/*
            0xe 그리기 0x4d9ec — 0xd 두 그림 뒤 투수·타자 소개 판 0x44944 (모드 검사 없음). 사람이 치므로 타자 PLAYER · 투수 COM.
            ⚠️ 웹 미션 상태에 없는 칸(이름·기록·좌우 등)은 비운다 — 마투수 미션이면 투수 이름만 적는다. 타자 손은 우타(0) 배치.
          */}
          {/* 교체 연출 0x16 — 그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE" 를 얹는다 */}
          {isSubstituting && substitutionScene !== null && (
            <SubstitutionSceneOverlay key={substitutionScene.serial} onDone={() => onSubstitutionSceneDone?.()} />
          )}

          {isAwaitingConfirm && sceneConfirm.isInConfirmState && (
            <SceneMatchupCards
              batterHand={0}
              pitcher={{ isComputer: true, ...(opponent === null ? {} : { name: opponent.name }) }}
              batter={{ isComputer: false, ...(batterName === undefined ? {} : { name: batterName }) }}
            />
          )}

          <div className={styles.overlay}>
            {isOver ? null : bannerText === '' ? (
              <Hint>
                {atBat.balls}볼 {atBat.strikes}스트라이크
                {canBunt && ' · 8·7·9(Shift)·길게 눌러 번트'}
                {stealableBases.includes(1) && ' · 3 도루(1루)'}
                {stealableBases.includes(2) && ' · 2 도루(2루)'}
                {stealableBases.includes(3) && ' · 1 도루(3루)'}
              </Hint>
            ) : (
              <BigResult>{bannerText}</BigResult>
            )}
          </div>

          {/* 경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0 */}
          {isOver && (
            <MissionResultBoard
              isSuccess={isSuccess}
              effectLayers={settlementLayers}
              earnedGamePoint={resultBoard?.earnedGamePoint ?? 0}
              {...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint })}
              {...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch })}
              onExit={(exit) => {
                if (resultBoard?.aceMatch === undefined && exit === '다시' && onRetry !== undefined) onRetry()
                else onFinish()
              }}
            />
          )}
        </div>
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
