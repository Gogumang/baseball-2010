import { useCallback, useEffect, useRef, useState } from 'react'
import { PressArea } from '@/shared/ui'
import { publishScenePeek } from '@/shared/lib/scenePeek/scenePeek'
import { MENU_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'
import { useGameSceneUpdateCounter } from '@/shared/lib/commonWindow/useGameSceneUpdateCounter'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { derbyDisplayDistanceAt } from '@/entities/home-run-derby/model/derbyBattedBall'
import { DerbyHud } from '@/pages/home-run-derby/ui/DerbyHud'
import { DerbyResultWindow } from '@/pages/home-run-derby/ui/DerbyResultWindow'
import { derbyMasterBatterOf } from '@/entities/home-run-derby/model/derbyLineup'
import { MatchupCards } from '@/widgets/matchup-cards/ui/MatchupCards'
import { batterCardStatsOf, batterLineOfRecord, pitcherCardStatsOf, pitcherLineOfRecord } from '@/widgets/matchup-cards/lib/matchupRecord'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import { derbyStaminaGaugeOf } from '@/pages/home-run-derby/lib/derbyStaminaGauge'
import type { StaminaGauge } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { gameSceneTickNow, gameSceneTickOf, useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

/** 더비 로딩 판 동안 받아 둘 그림 — 기다리지 않는다 */
const DERBY_PRELOADS: readonly SpriteSceneKey[] = ['homeRunDerby']

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
  /** 판 끝 누적 비거리 > 1999 의 히든 39 열기 (0x52a14 `0x62368`) — `useHomeRunDerby` 의 `onOpenHidden` */
  readonly onOpenHidden?: (id: number) => void
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
   * 저장이 없으면 0 (`DERBY_NO_BATTER_SAVE_TEAM_ID`) — 안 넘기면 그 값이다.
   */
  readonly myTeamId?: number
  /**
   * 모드 타자가 든 명부 칸 k = 0xb6394(모드 타자 기록) — 나리 팀 레코드의 내 줄 첨자, 명예 타자면 0. 첫 타순이 이 칸이고,
   * 볼넷 · 사구 뒤 0xd 를 지나면 내 팀 r7 마스터 명부의 다음 칸 타자가 친다(`derbyLineup`). 안 넘기면 0.
   */
  readonly modeBatterSlot?: number
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
  modeBatterSlot,
  onOpenHidden,
}: HomeRunDerbyScreenProps) {
  const session = useHomeRunDerby({
    bestDistance, onFinish, aceLevels, random, myTeamId, modeBatterSlot, ...(onOpenHidden === undefined ? {} : { onOpenHidden }),
  })
  const tick = useGameSceneUpdateCounter()
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  /**
   * 결과 창의 "예"(재도전)는 메인 메뉴 하위 39 를 거쳐 모드 7 장면을 **새로 세운다** — 타석 캔버스도 새로 띄운다
   * (하늘 행 굴림이 새 장면마다 한 번이다). 경기 중 메뉴의 다시하기도 같은 길(0x3c98e → 0x27)이라 캔버스를 새로 띄운다.
   */
  const [stageSerial, setStageSerial] = useState(0)
  const isResultShown = session.result !== null

  // 상태 0xe — 사람 OK 를 기다린다 (0x532b0). 경기 중 메뉴·조작방법·설정이 떠 있으면 경기 키가 안 간다(일시정지 팝업 0x754f9)
  const acceptsConfirm = session.isAwaitingConfirm && session.result === null && !isMenuOpen && overlay === null
  // 판(0x17)이 도는 동안의 키 — 0x53420 이 키마다 0x587 을 보내 홈런 뒤면 건너뛴다(0x519cc). 경기 중 메뉴 · 조작방법 · 설정이 떠 있으면 안 간다
  const isPlayRunning = session.distanceBoard !== null && session.result === null && !isMenuOpen && overlay === null
  /**
   * 0xe 의 OK · 판(0x17)의 건너뛰기 키는 받은 그 자리에서 처리하지 않고 장면 키 칸에 든다 — 원본은 키 콜백이 [+0x20] 에 적기만 하고
   * 다음 틀의 0xbca05 → 키 0x498d4(52d9e) → 0x536bc 가 그 틀의 상태로 가른다(0xe 0x532b0 · 0x17 0x53420 → 0x587 → 0x519cc).
   * 타석(`BattingStage`)이 칸을 올려 두었으면 그 틀 머리에서 꺼낸다(`pushSceneKey` — 없으면 바로). 꺼낸 틀의 상태를 다시 본다
   */
  // 장면 바로가기 · e2e 가 기다릴 자리(웹 개발 도구 — `shared/lib/scenePeek`). 스위치는 그 자리에 둬야 배포 빌드에서 접힌다
  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === 'e2e')) return
    publishScenePeek('homeRunDerby', { acceptsConfirm, isPlayRunning, isResultShown })
  }, [acceptsConfirm, isPlayRunning, isResultShown])
  useEffect(() => () => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') publishScenePeek('homeRunDerby', null)
  }, [])
  const { confirm, skipHomeRun } = session
  const sceneKeyStateRef = useRef({ acceptsConfirm, isPlayRunning })
  sceneKeyStateRef.current = { acceptsConfirm, isPlayRunning }
  const pressConfirm = useCallback(() => {
    pushSceneKey(() => {
      if (sceneKeyStateRef.current.acceptsConfirm) confirm()
    })
  }, [confirm])
  const pressSkip = useCallback(() => {
    // 처리하는 틀 = 받은 틀 + 1 — 판 시각은 그 틀(키 틱)로 센다
    const keyTick = gameSceneTickNow() + 1
    pushSceneKey(() => {
      if (sceneKeyStateRef.current.isPlayRunning) skipHomeRun(keyTick)
    })
  }, [skipHomeRun])
  useEffect(() => {
    if (!isPlayRunning) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      pressSkip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isPlayRunning, pressSkip])
  useEffect(() => {
    if (!acceptsConfirm) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !CONFIRM_KEYS.has(event.key)) return
      event.preventDefault()
      pressConfirm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsConfirm, pressConfirm])
  /**
   * 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*', 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴 0x3c02c 를 연다
   * (4991c~49922 — 모드를 안 본다). 더비(모드 7)도 경기 장면 0x104 라 그대로다. 로딩 판(7 · 9 · 8) · 판(0x17) · 결과 창(0x1a) ·
   * 벤치 클리어링(0x1e)은 범위 밖이고, 조작방법 뷰어의 키는 뷰어 0x637d0 만 받는다(0x3ca36).
   */
  const acceptsMenuKey = !isResultShown && session.loadingTip === null && !session.isBenchClearing
    && (isMenuOpen || session.distanceBoard === null) && overlay !== '조작방법'
  // '*' 는 장면 키 칸으로 — 받은 다음 틀의 키 0x498d4 '*' 가지(49918~49948, 모드를 안 본다)가 연다. 창이 서 있으면(메뉴 열림)
  // 창 키 자리(52cc6 0x754f9 → 0x3c158)에서 닫는다(`pressStar` — 앱 키 문이 다음 앱 틱에 넘긴다). 0x463ac(463e6 0x741a1)는 키가
  // 아니라 장면 vtable 0xcfa0c [6] 멈춤 콜백(0xcfa24)이 같은 메뉴를 여는 자리다
  const { pressStar } = menu
  // 단말 일시정지 0x463ac — 같은 메뉴를 연다('*' 가 받는 때 · 하위 창 없음)
  useInGameMenuOpenOnHide(menu, acceptsMenuKey && overlay === null)
  useEffect(() => {
    if (!acceptsMenuKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== '*') return
      event.preventDefault()
      pressStar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsMenuKey, pressStar])

  // 경기 장면 로딩 판 — 상태 7 진입 0x39f88(로딩 판 0x667f8 · 진행 칸 0x54120 끝 0x24 · 팁 rand(0, 73) 0x53dbc) 뒤 7 · 9 · 8 의 적재가
  // 한 단계마다 0x54128 · 0x53e04(바탕 · loadingbar 판 · StrTIP 팁 · 진행 막대 · 막대 끝 달리는 선수)를 그린다. 모드를 안 가려 더비도
  // 첫 장면 · 다시하기 · 재도전마다 선다. ⚠️ 근사(시간 · 남김 — 단말 몫 · 바이너리 밖): 원본 길이는 단말의 적재 시간 — 웹은 나리 타자편과 같은 `LoadingTip`
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} preloadScenes={DERBY_PRELOADS} />
      </RawScreen>
    )
  }

  // 사구 뒤 벤치 클리어링(상태 0x1e) — 0x12 대기 끝 0x4e74c 굴림이 들어갔다. 출구는 0xae24c(`finishBenchClearing`)
  if (session.isBenchClearing) {
    // 지금 타자의 손 0xb63c0 = 폼 & 1 — 마스터 줄이 치면 그 줄의 폼 (아래 `stageBatter` 와 같은 길)
    const benchMaster =
      session.batter.isModeBatter || session.batter.row === null ? null : derbyMasterBatterOf(session.batter.row)
    return (
      <BenchClearingScene
        // 그리기 0x43228 — 모드 7 은 내 팀이 측 0(공격) · 뽑은 상대 팀이 측 1(수비, 3a476 0xb6bd5(ctx, 1, v)) · 주자 없음
        field={benchClearingFieldOf({
          entryRolls: session.benchClearingEntryRolls,
          half: '초',
          playerSide: 0,
          ourTeamId: myTeamId ?? 0,
          opponentTeamId: session.opponentTeamId ?? 0,
          batterHand: batterSideOfForm(benchMaster?.form ?? batterForm ?? 0),
          bases: { first: false, second: false, third: false },
          grassPalette: sceneFieldPaletteOf(session.sceneStadium),
        })}
        // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
        random={random}
        onDone={session.finishBenchClearing}
      />
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && settings !== undefined && onSettingsChange !== undefined) {
    return (
      <SettingsScreen
        settings={settings}
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
  // 지금 타자 0xae89c(팀 0) — 볼넷 · 사구 뒤 0xd 를 지나 타순이 넘어갔으면 내 팀 r7 의 마스터 타자 줄이 친다. 능력치(0xab214) ·
  // 장착 스킬(실투 0x33d52 등) · 그림(타석 교대 0x47cc8 이 다시 싣는다) · 소개 판 모두 그 줄 것이다
  const masterRow = session.batter.isModeBatter ? null : session.batter.row
  const master = masterRow === null ? null : derbyMasterBatterOf(masterRow)
  const stageBatter =
    master === null
      ? { ability, form: batterForm, skinIndex: batterSkinIndex, equipmentLevels: batterEquipmentLevels, skillIds: batterSkillIds }
      : {
          ability: master.ability,
          form: master.form,
          skinIndex: master.skinIndex,
          equipmentLevels: master.equipmentLevels,
          skillIds: master.skillIds,
        }
  // 소개 판 0x44944 의 타자 판 — 타순은 팀+0x32, 모드 타자의 수비는 0xb53f0 이 남긴 옛 [k] 줄의 것.
  // 마스터 줄의 타율(0xb8e3c) · 홈런(+0x28) · 타점(+0x2a)은 그 줄의 시즌 칸 +0x20~ 이다 — 마스터 팀 적재 0x1ff98 이 팀 표 행을
  // 통째 베껴 표의 바이트 32~43 이 그대로 남는다(`RosterPlayer.recordLine`)
  const stageMatchupBatter: Omit<MatchupBatterCard, 'isComputer'> =
    master === null
      ? {
          ...matchupBatter,
          battingOrder: session.batter.order,
          ...(session.modeBatterPosition === undefined ? {} : { position: session.modeBatterPosition }),
        }
      : {
          name: master.name,
          ...(masterRow === null ? {} : batterCardStatsOf(batterLineOfRecord(masterRow.recordLine))),
          battingOrder: session.batter.order,
          ...(master.position === undefined ? {} : { position: master.position }),
        }
  // 판(0x17) 그리기 0x46c88 은 0x4c4bc(타석 화면 · HUD 0x45a54)를 안 부른다 — 판 동안은 HUD 가 없다
  const isPlayShown = session.distanceBoard !== null

  return (
    <>
      <RawScreen>
        {/* 타석 캔버스 — RawScreen 판 (0, 0) 에 맞춘다(`stageScreen.css`) */}
        <div className={stageScreen.canvasSlot}>
          <BattingStage
            // 하늘 줄 — 세션이 장면 시작 · 결과 진입 0x4f574 에 굴린 구장 +0x10
            skyRow={session.skyRow}
            // 구장 객체 둘(0x39fdc 모드 7 — 내 팀 r7) — 타석 +0x70 펜스 프레임 · +0xc 바닥 팔레트 줄
            {...(session.sceneStadium === null ? {} : { stadium: session.sceneStadium.stadium })}
            fieldPalette={sceneFieldPaletteOf(session.sceneStadium)}
            key={stageSerial}
            batterAbility={stageBatter.ability}
            batterForm={stageBatter.form}
            batterSkinIndex={stageBatter.skinIndex}
            batterEquipmentLevels={stageBatter.equipmentLevels}
            batterSkillIds={stageBatter.skillIds}
            // 투수 스킬 31 의 0xb6394 — 3a53c~3a550 이 모드 타자 P 를 칸 k(+0xa & 0x1f)에 넣고(0xb87cc → 0xb8768 다시 매김) 팀+0x32 =
            // 0xb6394(P) = k 로 선다. 그 뒤 마스터 줄도 배열 첨자 = 타순 칸이라 늘 지금 타순 팀+0x32 와 같다
            batterRecordSlot={session.batter.order}
            pitcherAbility={pitcher.ability}
            // 단계 0 마스터 줄 2 의 장비 니블 → 장비 겹 (0x47cc8 48138~4816a). 마투수 단계는 없다
            pitcherEquipmentNibbles={pitcher.equipment}
            // 마운드 바탕 벌 = 피부 × 15 + 수비 팀 v(hud 상대 팀) — 마스터 줄 2 의 +0xb (482c0~482fc → 0x793b0 의 794c2)
            pitcherSkinIndex={((pitcher.record?.profile ?? 0) >> 2) & 3}
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
            // 홈런더비는 일반 점수판을 안 그린다 (0x4c4bc 가 0x373d0 대신 0x45a54 로 간다).
            // 루상 주자(runnerAces)는 주자가 없어, 투수 체력 · 실투 "!"(pitcherStaminaPercent)는 투수 그리기 0x38d1c 가 모드 7 이면
            // 38ed6 에서 건너뛰어 넘기지 않는다
            hud={null}
            acePitcher={ace === null ? null : acePitcherFramesOf(ace)}
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
        </div>

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
              isPlayShown={isPlayShown}
              run={run}
              bestDistance={bestDistance}
              isEventZoneShown={session.isEventZoneShown}
              eventZoneRewardX={session.eventZoneRewardX}
              tick={tick}
              shownCombo={session.shownCombo}
              distanceBoardValue={
                session.distanceBoard === null
                  ? null
                  : derbyDisplayDistanceAt(
                      session.distanceBoard.batted,
                      gameSceneTickNow() - gameSceneTickOf(session.distanceBoard.startedAt),
                      session.distanceBoard.previous,
                    )
              }
              // 0x4585c 가 0xb63c1(지금 타자)로 콤보 표시 쪽을 가른다 — 타석 그림과 같은 폼(안 넘기면 0 = 우타)
              batterSide={batterSideOfForm(stageBatter.form ?? 0)}
            />
            {/* 0xe 그리기 0x4d9ec 는 타석 화면(0x4c4bc — HUD 0x45a54 포함) 다음에 0x44944 를 그린다 → HUD 위 */}
            {session.isAwaitingConfirm && (
              <DerbyMatchupCards
                batterHand={batterSideOfForm(stageBatter.form ?? 0)}
                pitcherName={pitcher.name ?? undefined}
                pitcherRecord={pitcher.record}
                isAcePitcher={pitcher.ace !== null}
                pitcherStamina={derbyStaminaGaugeOf(pitcher, session.opponentTeamId)}
                batter={stageMatchupBatter}
              />
            )}
          </>
        )}

        {/*
          웹 제목줄("홈런더비")은 걷었다 — 원본 240×320 장면 한 장뿐이고 공 번호는 HUD 0x45a54 가 그린다.
          마우스 · 터치 길 — 투명한 누름 칸: 0xe 의 OK · 판(0x17) 건너뛰기(화면 전체) · '*' 메뉴("*MENU" 자리).
          결과 창(상태 0x1a)은 키 0x40a08 이 예 · 아니오만 받는다 — 경기 중 메뉴 칸을 안 둔다.
        */}
        {!isMenuOpen && (acceptsConfirm || isPlayRunning) && (
          <PressArea label={acceptsConfirm ? '확인' : '건너뛰기'} onPress={acceptsConfirm ? pressConfirm : pressSkip} />
        )}
        {!isResultShown && <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={menu.toggle} />}

        {isMenuOpen && !isResultShown && (
          <div className={stageScreen.menuLayer}>
            <InGameMenu
              // 홈런더비 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1)
              mode={DERBY_MODE}
              cursor={menu.cursor}
              slidesIn={menu.slidesIn}
              opening={menu.opening}
              bindCloser={menu.bindCloser}
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
          </div>
        )}
      </RawScreen>
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
 * - 손: 타자 판 좌타/우타 · 판 자리 모두 0xb63c0(지금 타자 0xae89c — 볼넷 · 사구 뒤 넘어간 마스터 줄이면 그 줄) — `DerbyHud` 와 같은 폼 값.
 * - 투수 이름: 단계 ≥ 1 마투수는 0x48d50 이 마투수 기록 0x30 바이트를 통째로 복사하므로 그 기록의 이름이다
 *   — 확정: 0xb62c0 은 `0x20498 → 0xaa458(이름표, rec[0], 0xb6278(rec))` 가 null 이면 기록 +1 을 준다. 0xaa458 은 투수 id ≤ 0x4f ·
 *   타자 id ≤ 0x77 만 에디트 이름표를 주고(aa464 · aa470) 마투수 행 id 는 0xf0~0xf4(XlsACE_PIT_DATA 행 바이트 0)라 늘 null →
 *   기록 +1 = Xls 행 이름 그대로(`ACE_PLAYERS` 의 name).
 * - 단계 0 투수 이름: 상대 팀 v(장면 시작 굴림 3a454)의 마스터 투수 줄 2 (`derbyPitcherOf` · `DERBY_ORDINARY_PITCHER_ROW`).
 * - 투수 보직 · 좌우 · 방어율 · 탈삼진: 그 레코드의 +0xb · +0x20/+0x22/+0x26(`DerbyPitcher.record` — 마스터 줄 2 · 마투수 모두 Xls 행 줄,
 *   게이트 0xa56dc 는 모드 7 에서 거짓).
 * - 체력 막대: 길이 0x66e44(마스터 팀 v 레코드, 지금 투수, f = 늘 참) · % 0xaebb0 = 100 (`derbyStaminaGaugeOf`, U-133).
 */
function DerbyMatchupCards({
  batterHand, pitcherName, pitcherRecord, isAcePitcher, pitcherStamina, batter,
}: {
  readonly batterHand: number
  readonly pitcherStamina: StaminaGauge | undefined
  readonly pitcherName: string | undefined
  readonly pitcherRecord: DerbyPitcher['record']
  readonly isAcePitcher: boolean
  readonly batter: Omit<MatchupBatterCard, 'isComputer'> | undefined
}) {
  const tick = useGameSceneUpdateCounter()
  return (
    <MatchupCards
      tick={tick}
      batterHand={batterHand}
      pitcher={{
        isComputer: true,
        ...(pitcherName === undefined ? {} : { name: pitcherName }),
        ...(pitcherStamina === undefined ? {} : { stamina: pitcherStamina }),
        ...(pitcherRecord === undefined
          ? {}
          : {
              role: pitcherRecord.profile & 3,
              throwsLeft: pitcherHandOf(pitcherRecord.profile >> 4, isAcePitcher) === 1,
              ...pitcherCardStatsOf(pitcherLineOfRecord(pitcherRecord.recordLine)),
            }),
      }}
      batter={{ ...batter, isComputer: false }}
    />
  )
}
