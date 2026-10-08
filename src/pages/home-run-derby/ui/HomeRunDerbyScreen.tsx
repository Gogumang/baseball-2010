import { useEffect, useState } from 'react'
import { BigResult, Hint, PixelScreen } from '@/shared/ui'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import { derbyBallCountOf, derbyBallNumberOf } from '@/entities/home-run-derby/model/derbyRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { derbyDisplayDistanceAt } from '@/entities/home-run-derby/model/derbyBattedBall'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import * as styles from '@/pages/home-run-derby/ui/HomeRunDerbyScreen.css'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'

interface HomeRunDerbyScreenProps {
  /**
   * 치는 선수의 능력치. 원본은 모드 7 로 들어갈 때 `0x213c0(앱, 4, 0)` 으로 **나리 타자편 저장**을
   * 올린다 — 선수 고르기 창 결과 2 = 육성 타자 · 4 = 명예 타자다(H-2, Q2 확정).
   * 웹에는 아직 명예의 전당 선수를 경기에 넣는 길이 없어 부르는 쪽이 육성 선수를 넘긴다.
   */
  readonly ability: BatterAbility
  /**
   * 치는 선수의 겉모습 — 원본이 나리 타자편 저장을 올리므로 **그 선수의 피부·폼·장비**가 그대로 나온다.
   * 안 넘기면 구운 벌(피부 0)과 맨몸으로 그려진다.
   */
  readonly batterForm?: number
  readonly batterSkinIndex?: number
  readonly batterEquipmentLevels?: BatterAbility
  /**
   * 치는 선수의 **장착** 스킬 (0xb62b4 — 선수 기록 +0x14). 같은 저장을 올리니 그 선수 것이다.
   * 압도 22 면 CPU 실투율 +5 (0x33d52). 안 넘기면 스킬 없음.
   */
  readonly batterSkillIds?: readonly number[]
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`, 격자 칸 → 0~4). 난입 마투수 능력치 배율
   * 0xd88aa(0xb6414)·마구 횟수 0xd8509(0xaebe4)가 본다. 안 넘기면 배율 없이 날 값 · 마구 Lv1.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  readonly random: RandomPort
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 보유 G (app+0x64) — 결과 화면 "보유 GP" 칸 */
  readonly gamePoint: number
  /** 한 판이 끝났을 때. 최고 기록 갱신과 G 지급은 부르는 쪽이 한다 */
  readonly onFinish?: (result: DerbyResult) => void
  /** 결과 화면에서 "아니오" — 메인 메뉴로 (전역 0x140006c = 4) */
  readonly onExit: () => void
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정. 안 넘기면 칸이 잠긴다 */
  readonly settings?: GameSettings
  readonly onSettingsChange?: (settings: GameSettings) => void
  /**
   * 상태 0xe 소개 판(0x44944)의 타자 판 칸 — 모드 타자 기록(0x1fc20)의 이름(0xb62c0) · 수비(+0x1c & 0xf) ·
   * 타율(0xb8e3c) · 홈런(+0x28) · 타점(+0x2a) · 타순(팀 +0x32 = 0xb6394(기록) = +0xa & 0x1f) · 오늘 타석 기록.
   * 앱(`EntryRoutes` 의 `derbyMatchupBatterOf`)이 넘긴다 — 안 넘긴 칸은 비워 둔다.
   */
  readonly matchupBatter?: Omit<MatchupBatterCard, 'isComputer'>
  /**
   * 내 타자편 팀 — 나리 타자편 저장의 팀(0x1f8d5(저장, 4) +1). 상대 팀 굴림 3a454 가 이 팀을 피한다 (`rollDerbySceneStart`).
   */
  readonly myTeamId?: number
}

/** 홈런더비 = 원본 전역 모드 7 — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(자동진행 자리에 다시하기) */
const DERBY_MODE = 7
type MenuOverlay = '조작방법' | '설정'
/** 상태 0xe 의 OK — 원본 키 −5(OK)·'5'(0x35) (0x532b0). 웹은 Enter·스페이스를 OK 로 받는다 (스윙 키와 같은 묶음) */
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])

/**
 * 홈런더비 (게임 모드 7) — `docs/re/H-modes.md` H-2 절의 규칙 전체를 옮긴 화면이다.
 *
 * 10구(+보너스) 동안 타석만 치고, 결과는 `entities/home-run-derby` 의 순수 모델이 센다.
 * 타석 연출은 다른 모드와 똑같이 `widgets/batting-stage` 를 쓰되 **일반 점수판 대신
 * 홈런더비 HUD(0x45a54)** 를 겹친다 — 원본도 `0x4c4bc` 에서 그렇게 갈린다.
 *
 * 판정 모드는 `'홈런더비'` 다: `0xab214` 는 모드 7(sp44)이면 contact·B·C 를 보정 없는 능력치로 세는
 * 다른 갈래(0xab69a)로 가고, 18 자리에서 24 를 한 번 더 굴린다 (`entities/batting/model/swingResult` 머리말).
 */
export function HomeRunDerbyScreen({
  ability,
  batterForm,
  batterSkinIndex,
  batterEquipmentLevels,
  batterSkillIds,
  aceLevels,
  random,
  bestDistance,
  gamePoint,
  onFinish,
  onExit,
  settings,
  onSettingsChange,
  matchupBatter,
  myTeamId,
}: HomeRunDerbyScreenProps) {
  const session = useHomeRunDerby({ bestDistance, onFinish, aceLevels, random, myTeamId })
  const tick = useUpdateCounter()
  const menu = useInGameMenuState()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  /**
   * 결과 창의 "예"(재도전)는 메인 메뉴 하위 39 를 거쳐 모드 7 장면을 **새로 세운다** — 타석 캔버스도 새로 띄운다
   * (하늘 행 굴림이 새 장면마다 한 번이다). 경기 중 메뉴의 다시하기도 같은 길(0x3c98e → 0x27)이라 캔버스를 새로 띄운다.
   */
  const [stageSerial, setStageSerial] = useState(0)
  const isResultShown = session.result !== null

  // 상태 0xe — 사람 OK 를 기다린다 (0x532b0). 경기 중 메뉴·조작방법·설정이 떠 있으면 경기 키가 안 간다(일시정지 팝업 0x754f9)
  const acceptsConfirm = session.isAwaitingConfirm && session.result === null && !isMenuOpen && overlay === null
  const { confirm } = session
  // 판(0x17)이 도는 동안의 키 — 0x53420 이 키마다 0x587 을 보내 홈런 뒤면 건너뛴다(0x519cc). 경기 중 메뉴 · 조작방법 · 설정이 떠 있으면 안 간다
  const isPlayRunning = session.distanceBoard !== null && session.result === null && !isMenuOpen && overlay === null
  const { skipHomeRun } = session
  useEffect(() => {
    if (!isPlayRunning) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      skipHomeRun()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlayRunning, skipHomeRun])
  useEffect(() => {
    if (!acceptsConfirm) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !CONFIRM_KEYS.has(event.key)) return
      event.preventDefault()
      confirm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsConfirm, confirm])

  // 경기 장면 로딩 판 — 상태 7 진입 0x39f88(로딩 판 0x667f8 · 진행 칸 0x54120 끝 0x24 · 팁 rand(0, 73) 0x53dbc) 뒤 7 · 9 · 8 의 적재가
  // 한 단계마다 0x54128 · 0x53e04(바탕 · loadingbar 판 · StrTIP 팁 · 진행 막대 · 막대 끝 달리는 선수)를 그린다. 모드를 안 가려 더비도
  // 첫 장면 · 다시하기 · 재도전마다 선다. ⚠️ 근사(시간): 원본 길이는 단말의 적재 시간 — 웹은 나리 타자편과 같은 `LoadingTip`
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} />
      </RawScreen>
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

  const { run, pitcher } = session
  const ace = pitcher.ace

  return (
    <>
      <PixelScreen
        title="홈런더비"
        badge={
          isResultShown ? undefined : `${derbyBallNumberOf(run)} / ${derbyBallCountOf(run)}구${run.isBonusGame ? ' · 보너스' : ''}`
        }
        // 결과 창(상태 0x1a)은 키 0x40a08 이 예·아니오만 받는다 — 경기 중 메뉴를 안 띄운다
        rightKey={
          isResultShown
            ? undefined
            : {
                label: isMenuOpen ? '닫기' : '메뉴',
                onPress: menu.toggle,
              }
        }
      >
        {isMenuOpen && !isResultShown && (
          <InGameMenu
            // 홈런더비 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
            mode={DERBY_MODE}
            cursor={menu.cursor}
            onCursorChange={menu.setCursor}
            onContinue={menu.close}
            onQuit={onExit}
            onRestart={() => {
              menu.close()
              // 다시하기도 결과 창 [예]와 같이 경기 장면 0x104 를 새로 세운다(0x3c9d8 → 0x27) — 타석 캔버스도 새로 띄운다
              setStageSerial((serial) => serial + 1)
              session.restart()
            }}
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
        <div
          className={styles.stageArea}
          // 판이 도는 동안 화면을 누르면 키로 본다(터치용 웹판 편의 — 0xe 의 OK 와 같은 자리)
          onClick={acceptsConfirm ? confirm : isPlayRunning ? skipHomeRun : undefined}
        >
          <BattingStage
            // 하늘 줄 — 세션이 장면 시작 · 결과 진입 0x4f574 에 굴린 구장 +0x10
            skyRow={session.skyRow}
            key={stageSerial}
            batterAbility={ability}
            batterForm={batterForm}
            batterSkinIndex={batterSkinIndex}
            batterEquipmentLevels={batterEquipmentLevels}
            batterSkillIds={batterSkillIds}
            pitcherAbility={pitcher.ability}
            aceLevels={aceLevels}
            swingMode="홈런더비"
            // 번트 '7'/'8'/'9' — 0x535a4 → 0x6a7 → 0x51e48 은 모드 7 도 막지 않는다(모드 갈림 없음). 내 선수가 쳐서 마선수가 아니다
            canBunt
            gameMode={DERBY_MODE}
            // 0x344ea 모드 7 갈래 — 단계 0 은 구질 1, 마투수가 나온 뒤로는 22(마구)만, 굴림 없음
            derbyPitchType={pitcher.pitchType}
            // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726)
            isScoreboardOn={settings?.isScoreboardOn}
            // 환경설정 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
            isVibrationOn={settings?.isVibrationOn}
            isEagleEyeEnabled={false}
            // 홈런더비는 일반 점수판을 안 그린다 (0x4c4bc 가 0x373d0 대신 0x45a54 로 간다)
            hud={null}
            acePitcher={
              ace === null
                ? null
                : { framesUrl: ace.framesUrl, frameCount: ace.frameCount, stillUrl: ace.stillUrl }
            }
            // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9)
            isPaused={session.isPaused || overlay !== null}
            // 결과 창(0x45c18)은 창 뒤에 구름·구장(+0x17e2 만큼 가라앉는다)만 그린다
            isResultBackdrop={isResultShown}
            // HOMERUN 글자는 판의 홈런 틱에 더비 칸(0x5279a — 단계만 0)으로 켠다. 타석 임시 결과로는 안 켠다
            homeRunText={session.homeRunText}
            // 키 건너뛰기 0x519cc · 판 끝 0x35108 이 파티클을 치운다 — 홈런 효과 굴림은 타석 화면이 글자 창대로 돈다
            effectsClearedAt={session.effectsClearedAt}
            random={random}
            onPitchResolved={(detail) => session.onPitchResolved(detail)}
          />

          {session.result !== null ? (
            <DerbyResultWindow
              result={session.result}
              heldGamePoint={gamePoint}
              onRetry={() => {
                setStageSerial((serial) => serial + 1)
                session.retryFromResult()
              }}
              onExit={onExit}
            />
          ) : (
            <>
              <DerbyHud
                run={run}
                bestDistance={bestDistance}
                isEventZoneShown={session.isEventZoneShown}
                tick={tick}
                shownCombo={session.shownCombo}
                distanceBoardValue={
                  session.distanceBoard === null
                    ? null
                    : derbyDisplayDistanceAt(
                        session.distanceBoard.batted,
                        Math.floor((performance.now() - session.distanceBoard.startedAt) / millisecondsPerFrame()),
                        session.distanceBoard.previous,
                      )
                }
                // 0x4585c 가 0xb63c1(지금 타자)로 콤보 표시 쪽을 가른다 — 타석 그림과 같은 폼(안 넘기면 0 = 우타)
                batterSide={batterSideOfForm(batterForm ?? 0)}
              />
              {/* 0xe 그리기 0x4d9ec 는 타석 화면(0x4c4bc — HUD 0x45a54 포함) 다음에 0x44944 를 그린다 → HUD 위 */}
              {session.isAwaitingConfirm && (
                <DerbyMatchupCards
                  batterHand={batterSideOfForm(batterForm ?? 0)}
                  pitcherName={pitcher.name ?? undefined}
                  batter={matchupBatter}
                />
              )}

              <div className={styles.overlay}>
                {session.banner === '' ? (
                  <Hint>
                    {run.isBonusGame ? '보너스 게임' : '10구 안에 멀리 쳐라'} · 누적 {run.totalDistance}M
                  </Hint>
                ) : (
                  <BigResult>{session.banner}</BigResult>
                )}
              </div>
            </>
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

/**
 * 상태 0xe 의 소개 판 (0x4d9ec → 0x44944) — 0xe 에 들어설 때마다 새로 띄워 틱 0 부터 센다.
 * 홈런더비에서 원본이 채우는 값 중 웹이 아는 것만 넣는다:
 * - 팀 글자: 0x39fdc 모드 7 갈래가 `0xb6c19(st, 0, 0)` · `0xb6c19(st, 1, 1)`(3a4a6~3a4bc) — 내 타자편 팀 0 은 PLAYER,
 *   상대 팀 1 은 COM 이다. 타자 판(st[9])이 모드 타자가 든 팀 0, 투수 판(st[0xa])이 팀 1 이다.
 * - 손: 타자 판 좌타/우타 · 판 자리 모두 0xb63c0(모드 타자) — `DerbyHud` 와 같은 폼 값.
 * - 투수 이름: 단계 ≥ 1 마투수는 0x48d50 이 마투수 기록 0x30 바이트를 통째로 복사하므로 그 기록의 이름이다
 *   (⚠️ 유력 — 0xb62c0 이 마선수 기록에서 `ACE_PLAYERS` 이름을 내는지는 0x20498 을 안 봤다).
 * - 단계 0 투수 이름: 상대 팀 v(장면 시작 굴림 3a454)의 마스터 투수 줄 2 (`derbyPitcherOf` · `DERBY_ORDINARY_PITCHER_ROW`).
 * ⚠️ 비운 칸: 투수 보직·좌우·방어율·탈삼진·체력 막대
 *   (기록 +0xb · +0x20/+0x22/+0x26, 0x66e44 · 0xb8680 — 웹에 마투수·상대 투수 기록이 없다).
 */
function DerbyMatchupCards({
  batterHand, pitcherName, batter,
}: {
  readonly batterHand: number
  readonly pitcherName: string | undefined
  readonly batter: Omit<MatchupBatterCard, 'isComputer'> | undefined
}) {
  const tick = useUpdateCounter()
  return (
    <MatchupCards
      tick={tick}
      batterHand={batterHand}
      pitcher={{ isComputer: true, ...(pitcherName === undefined ? {} : { name: pitcherName }) }}
      batter={{ ...batter, isComputer: false }}
    />
  )
}
