import { useCallback, useEffect, useRef, useState } from 'react'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollsIntoBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import { derbyNoContactWaitFramesOf, derbyPitchCallOf } from '@/pages/home-run-derby/lib/derbyPitchCall'
import {
  DERBY_HOME_RUN_SOUND,
  derbyBattedBallOf,
  skipDerbyBattedBall,
  type DerbyBattedBall,
} from '@/entities/home-run-derby/model/derbyBattedBall'
import { derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import { DERBY_NO_BATTER_SAVE_TEAM_ID } from '@/entities/home-run-derby/model/derbyRules'
import {
  confirmDerbyNextBatter,
  createDerbyLineup,
  derbyLineupBatterOf,
  derbyModeBatterPositionOf,
  reserveDerbyNextBatter,
} from '@/entities/home-run-derby/model/derbyLineup'
import type { DerbyLineup, DerbyLineupBatter } from '@/entities/home-run-derby/model/derbyLineup'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import {
  COMBO_DISPLAY_FRAMES,
  applyDerbyPitch,
  createDerbyRun,
  derbyResultOf,
  derbySceneStateAfter,
  endComboDisplay,
  shouldShowComboAtNextPitch,
} from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyResult, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { eventZoneRewardXOf, isEventZoneHit } from '@/entities/home-run-derby/model/eventZone'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { FOUL_CALL_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { rollDerbySceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { SKY_ROW_COUNT } from '@/widgets/batting-stage/lib/stageScenery'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { leaveGameSceneObject } from '@/widgets/game-scene/model/gameSceneObject'
import {
  HOME_RUN_TEXT_SCENE_START,
  derbyHomeRunTextOn,
  homeRunTextAfterDraws,
  type HomeRunTextState,
  type HomeRunTextWindow,
} from '@/widgets/batting-stage/lib/homeRunBanner'
import {
  clearGameSceneTimeout, createGameSceneDrawGate, gameSceneNow, gameSceneTickNow, gameSceneTickOf, gameSceneTickStartTime,
  setGameSceneTickInterval, setGameSceneTickTimeout, setGameSceneTimeout,
} from '@/shared/lib/commonWindow/commonWindow'

/**
 * 결과 연출로 붙잡는 시간 — 맞은 공(패턴이 실려 온 공)은 원본 판 끝(공.vt18 멈춤 + 10틱, `derbyBattedBallOf` 의 endTicks)까지,
 * 안 맞은 공은 상태 0x12 의 대기(`derbyNoContactWaitFramesOf` — 15틱, 볼넷 · 사구면 31틱, 0x4e6de~0x4e730).
 * `balls` = 이 공 앞의 볼 수 st[5] (볼넷 판정에 쓴다). 난수를 안 쓰는 미리 보기다 — 폴에 맞는 공은 판 시작 굴림으로
 * 다시 깐 궤적의 끝을 쓴다(`onPitchResolved`).
 */
export function resultHoldMillisecondsOf(detail: PitchOutcomeDetail, balls = 0): number {
  if (detail.pattern === undefined) {
    return derbyNoContactWaitFramesOf(derbyPitchCallOf(detail.resolution, balls).judgment) * millisecondsPerFrame()
  }
  return derbyBattedBallOf(detail.pattern).endTicks * millisecondsPerFrame()
}

/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱이 0 이라 틱 0·1·2 셋을 거른다 (확정: 상태 기계 0xbc9c8 이 상태를 바꾸는 그림에서 +0x14(= 장면+0x2c) = 0,
 * 그대로면 +0x14++ — 매 그림 0x52c50 이 0xbc9c8 → 진입 → 키 0x498d4 → 갱신 → 그리기 차례로 부른다).
 */
export const CONFIRM_LOCK_FRAMES = 3

/**
 * 상태 0xd 가 머무는 갱신 수 — 갱신 0x39e14 는 `[점수판 +0xf10]+0x6c ≠ 1 && 틱 > 0` 이면 0xe 를 예약한다.
 * 점수판 +0x6c 는 1 이 되는 일이 없다: 쓰는 곳이 만들기 0x76b16(0) · 0xd 진입 0x48f42(2, +0x61 == 0 일 때) ·
 * 점수판 갱신 0x785a8(1 → 2 0x785c8 · 2·3 → 0 0x78626 · 4·5 → 0 0x78650) 뿐이다(전체 디스어셈 `str …, #0x6c]` 전수,
 * 0x785a8 이 받는 객체는 0x41230 의 [장면+0xf10]). 그래서 늘 **틱 0(진입)·틱 1(예약)** 두 그림 뒤 0xe 다.
 */
export const SCENE_D_FRAMES = 2

/** 0xd 진입의 타석 등장음 — 메시지 0xbc1 → 0x522d2 의 "그 밖" 14 (더비 타자는 마선수가 아니고 주자가 없다) */
export const DERBY_AT_BAT_ENTRY_SOUND = 14

/**
 * **더비 홈런의 HOMERUN 글자 창** — 홈런 갈래 0x5279a~0x527ac 는 +0x1961(단계) = 0 · +0x1960 = 1 만 쓴다(`derbyHomeRunTextOn`).
 * 글자는 0x17 그리기 0x46c88 이 `관문 0xb0d28 열림 && state[0x1d]` 일 때 부르는 0x40b18 이 그리므로 **홈런 틱 h … 관문이 닫히기 전 틱**에만
 * 보이고(그 뒤 10틱은 안 그림), 키 건너뛰기(0x519cc)는 그 그림의 갱신보다 먼저 +0x1960 = 0 이라 키 틱 k 의 그림부터 없다.
 * 폴 뒤 담장선에서 홈런 갈래를 한 번 더 지나면 그 틱에 단계가 다시 0 이다. `scene` = 앞 연출이 남긴 칸(+0x1963 · +0x1962 · 글자 칸).
 * `startedAt` = 판을 넘겨받은 시각(공 틱 0). 홈런이 아니면 창이 없고 칸도 그대로다.
 */
export function derbyHomeRunTextOf(
  batted: DerbyBattedBall,
  startedAt: number,
  scene: HomeRunTextState,
  millisecondsPerTick: number,
): { readonly window: HomeRunTextWindow | null; readonly after: HomeRunTextState } {
  const homeRunTick = batted.homeRunTicks[0]
  if (homeRunTick === undefined) return { window: null, after: scene }
  const lastDrawTick = (batted.skippedAtTick ?? batted.closeTick) - 1
  const draws = Math.max(0, lastDrawTick - homeRunTick + 1)
  const restartDraws = batted.homeRunTicks
    .slice(1)
    .filter((tick) => tick <= lastDrawTick)
    .map((tick) => tick - homeRunTick + 1)
  const on = derbyHomeRunTextOn(scene)
  return {
    window: {
      startedAt: startedAt + homeRunTick * millisecondsPerTick,
      endsAt: startedAt + (lastDrawTick + 1) * millisecondsPerTick,
      on,
      restartDraws,
    },
    after: homeRunTextAfterDraws(on, draws, restartDraws).state,
  }
}

/**
 * **비거리 판 0x36cd4** 이 지금 보는 판 — 0x17 그리기 0x46c88(0x46cb6)이 플레이+0x118 == 8(더비 판) 이면 판 내내 그린다.
 * 숫자는 표시 비거리 +0x36 이라 공이 나는 동안 틱마다 따라 오른다(`derbyDisplayDistanceAt`, `previous` = 앞 공이 남긴 값).
 */
export interface DerbyDistanceBoard {
  /** 판을 넘겨받은 시각(공 틱 0) — `gameSceneNow()` 기준 ms */
  readonly startedAt: number
  readonly batted: DerbyBattedBall
  /** 이 판이 다시 쓰기 전의 +0x36 */
  readonly previous: number
}

export interface HomeRunDerbyOptions {
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 10구(+보너스)가 다 끝났을 때 한 번 불린다 — 최고 기록·G 를 저장할 곳에 알린다 */
  readonly onFinish?: (result: DerbyResult) => void
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`). 단계 1~4 난입 마투수가 능력치 배율
   * 0xd88aa(0xb6414) 로 이 칸을 본다 — `derbyPitcherOf` 머리말.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 경기 장면 시작 굴림을 낼 난수 (`rollDerbySceneStart`). 안 넘기면 굴리지 않는다 (예전 시험용).
   */
  readonly random?: RandomPort
  /**
   * 내 타자편 팀 r7 = (s8) `0x1f8d5(저장, 4)` +1 바이트 — 나리 타자편 저장의 팀(웹 `career.teamId`, 마선수 대결의
   * 사람 칸 팀과 같은 칸 — `missionHumanTeamIdOf`). 상대 팀 굴림 3a454 가 이 팀을 피한다. 저장이 없으면 그 바이트는 0 이다
   * (`DERBY_NO_BATTER_SAVE_TEAM_ID` — 0x213c0 이 새 버퍼를 0 으로 세우고 0x20ac4 는 파일이 없으면 안 쓴다). 안 넘기면 그 값이다.
   * 공격 팀(팀 0)도 이 팀의 마스터 명부다 — 볼넷 · 사구 뒤 타순 다음 칸 타자가 이 팀의 줄이다(`derbyLineup`).
   */
  readonly myTeamId?: number
  /**
   * 모드 타자가 든 명부 칸 k = 0xb6394(0x1fc20(앱)) — 나리 저장 선수면 나리 팀 레코드의 내 줄 첨자, 명예 타자면 0
   * (`DERBY_HALL_OF_FAME_BATTER_SLOT`). 경기를 세울 때 팀+0x32 가 이 칸이다(3a550). 안 넘기면 0.
   */
  readonly modeBatterSlot?: number
  /**
   * **히든 39 열기** `0x62368(ui, 0x27 = 39, 0)` — 0x17 갱신이 관문이 닫힌 뒤 11 번째 갱신(529f0 `+0x1094 > 10`)에
   * 0xae3e8 로 가기 **앞**(52a00~52a16)에서 누적 비거리 st+0x34(s16) > 1999 면 부른다. 이미 열렸는지는 받는 쪽이 본다.
   * 그 검사는 모드를 안 가리지만 st+0x34 를 더하는 0xa600c 는 모드 7 갈래(0x52794 · 0x52828)만 불러 더비에서만 닿는다
   */
  readonly onOpenHidden?: (id: number) => void
}

/** 52a08 `cmp r2, 0x7cf; ble` — 누적 비거리가 1999 를 넘으면 */
const DERBY_DISTANCE_HIDDEN_THRESHOLD = 1999
const DERBY_DISTANCE_HIDDEN_ID = 39

/**
 * **홈런더비 경기 시작 굴림** — 상태 7 진입 0x39f88 의 로딩 팁 rand(0, 73)(`rollSceneLoadingTip`) · 상태 7 갱신 0x3e340 의 덱 1275 ·
 * 효과 객체 1202(`openScenePatternDeck`) 뒤, 상태 9 갱신 0x3f584 의 공통 꼬리 차례 그대로:
 * ```
 * 3f856  0x39fdc(scene, 7)  → 모드 7 갈래 3a43e:
 *          3a44e  r7 = (s8) 0x1f8d5(저장, 4)+1          ; 내 타자편 팀 — 저장이 없으면 0 (`DERBY_NO_BATTER_SAVE_TEAM_ID`)
 *          3a454  v = rand(0, 9) → sp+0x18 ; v == r7 이면 9   ; 상대 팀 — 0xb6bd5(ctx, 1, v) · 팀 객체 0xb891c
 *          3a476  0x78664(타석 구장, r7) · 3a496 0x788d4(수비 구장, r7) ; r7 > 9 면 rand(0, 10) 둘 (`rollDerbySceneStadium`)
 * 3fa0e  0xc0dac 시뮬 초기화 → c0df6 rand(0, 2)          ; `rollSimulatorInit` (dcfcef7)
 * ```
 * 그 **뒤** 상태 8 경기 적재(0x48658 의 48774 → 구장 준비 0x352e8(354d2) → 0x783b0)가 하늘 줄 rand(0, 6) 을 굴린다 — 모드 7 은 0x783b0 의
 * 그 밖 갈래다(`stadiumSkyRowOf`). 돌려주는 값이 이 장면의 하늘 줄(구장 +0x10 = 값 mod 6)이다.
 * 차례: 갱신 표 0x52e2a 7 → 0x3e340 · 0x52e3a 9 → 0x3f584 · 0x52e32 8 → 0x48658, 예약 3efe6(상태 7 끝) → 9 · 3fa5e(상태 9 끝) → 8.
 * 뽑은 상대 팀 v(`opponentTeamId`)는 수비 팀이다 — 단계 0 투수가 그 마스터 팀의 투수 줄 2 다(`derbyPitcherOf` · `DERBY_ORDINARY_PITCHER_ROW`).
 * 돌려주는 `loadingTipIndex` 는 로딩 판이 그릴 팁 칸(`LOADING_TIPS` — StrTIP[1 + +0x315]), `skyRow` 는 하늘 줄이다.
 * `stadium` 은 두 구장 객체다 — 타석 +0x70 이 펜스 프레임, +0xc 가 바닥 팔레트 줄(0x352e8 모드 7 은 그 밖 갈래라 안 덮는다).
 */
export function rollDerbySceneStart(
  random: RandomPort,
  myTeamId: number = DERBY_NO_BATTER_SAVE_TEAM_ID,
): {
  readonly loadingTipIndex: number
  readonly skyRow: number
  readonly opponentTeamId: number
  readonly stadium: SceneStadium
} {
  // 상태 7 진입 0x39f88 → 0x53dbc — 로딩 팁 rand(0, 73). 모드를 안 가려 더비도 장면마다 맨 앞에 한 번 (`rollSceneLoadingTip`)
  const loadingTipIndex = rollSceneLoadingTip(random)
  // 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 이 장면의 패턴 덱을 섞는다(상태 9 의 3a454 보다 앞)
  openScenePatternDeck(random)
  // 3a454 v = rand(0, 9) (0~8) — 3a45a `cmp r7, r0` 내 팀과 같으면 9
  const rolledTeam = random.rand(0, 9)
  const opponentTeamId = rolledTeam === myTeamId ? 9 : rolledTeam
  // 3a476 · 3a496 — 내 팀 r7 로 두 구장 (팀 > 9 면 rand(0, 10) 둘, 0~9 면 굴림 없음)
  const stadium = rollDerbySceneStadium(random, myTeamId)
  rollSimulatorInit(random)
  // 상태 9 끝 3fa5e 가 예약한 상태 8 경기 적재 — 하늘 줄 rand(0, 6)
  return { loadingTipIndex, skyRow: random.rand(0, SKY_ROW_COUNT), opponentTeamId, stadium }
}

export interface HomeRunDerbySession {
  /**
   * HUD(0x45a54)가 그리는 진행 칸. 원본은 공 하나의 셈(0xae3e8 · 0xae24c)을 **판(0x17) 끝 · 상태 0x12 대기 끝**에서 하므로
   * 기회 · 공 번호 · 누적 · 콤보 칸은 그때 바뀐다 — 공이 맞은 순간이 아니다. 판 동안은 HUD 를 아예 안 그린다(`DerbyHud` 의 `isPlayShown`).
   */
  readonly run: DerbyRun
  /** 이 장면의 하늘 줄 (구장 +0x10 — 장면 시작 · 결과 진입에 굴린 rand(0, 6)). 난수가 없으면 undefined */
  readonly skyRow: number | undefined
  /** 이 장면의 두 구장 객체 (장면 시작 0x39fdc 모드 7 — 내 팀 r7). 난수가 없으면 null(0번 구장 · 기본색) */
  readonly sceneStadium: SceneStadium | null
  /** 마운드의 투수 — 마투수 복사는 상태 0xd 진입 0x48d50(48d8e~48dd4)이 한다. 단계가 오른 공의 판 동안은 앞 투수 그대로다 */
  readonly pitcher: DerbyPitcher
  /**
   * 지금 타자 0xae89c(팀 0) — 모드 타자 칸이면 `isModeBatter`, 아니면 내 팀 r7 의 마스터 타자 줄(`derbyLineup`).
   * 볼넷 · 사구가 예약한 다음 타순은 상태 0xd 진입(48ddc 0xaebe4)에서만 넘어간다.
   */
  readonly batter: DerbyLineupBatter
  /** 모드 타자 사본의 수비 위치 — 0xb53f0 이 옛 [k] 마스터 줄의 +0x1c 를 남긴다(`derbyModeBatterPositionOf`) */
  readonly modeBatterPosition: number | undefined
  /**
   * **벤치 클리어링(상태 0x1e) 중** — 사구 뒤 0x12 대기 끝 0x4e74c 굴림이 들어갔다. 화면이 `BenchClearingScene` 을 띄우고
   * 끝나면 `finishBenchClearing` 을 부른다(출구 0xae24c).
   */
  readonly isBenchClearing: boolean
  /** 벤치 클리어링 진입 굴림 45 번 (`rollBenchClearingEntry`) — 운동장 그림 재료. 안 섰으면 null */
  readonly benchClearingEntryRolls: readonly BenchClearingEntryRoll[] | null
  /** 상대(수비, 측 1) 팀 — 장면 셋업 0x39fdc 모드 7 의 rand(0, 9). 아직 안 뽑았으면 undefined */
  readonly opponentTeamId: number | undefined
  /** 벤치 클리어링 연출이 끝났다 — `reachedTargetTick` = 틱 10 의 수비 목표 굴림 8 번(0x401d4)이 돌았는가 */
  readonly finishBenchClearing: (reachedTargetTick: boolean) => void
  /** 결과를 보여 주는 동안·상태 0xe 에서 OK 를 기다리는 동안은 새 공을 안 던진다 */
  readonly isPaused: boolean
  /**
   * **상태 0xe — 사람 OK 를 기다리는 중**. 경기 첫 공 앞(적재 8 → 0xd, 0x3fa50)·단계가 올라 새 마투수가 설 때·보너스 게임을
   * 열 때(0xae3e8/0xae24c → 0xd) 0xd 를 지나 0xe 로 온다. 0xe 는 시간 제한·자동 진행이 없다 — 갱신 0x39bd4 는 모드 7 이면
   * 아무것도 안 하고(0x39bde `cmp r3,#7`), CPU 조작 객체 0x53874 는 0xf·0x10·0x11 만 본다.
   */
  readonly isAwaitingConfirm: boolean
  /**
   * 0xe 의 OK — 사람 조작 객체 키 0x532b0: 키 == −5(OK) 또는 '5'(0x35) 이면 메시지 1(인자 = 지금 상태 0xe) →
   * 0x50c18 이 상태 0xf 를 예약한다. 다른 키는 아무 일도 안 한다. 0xe 에 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신 안에는 무시한다.
   */
  readonly confirm: () => void
  /** 이번 공이 이벤트 존을 얻었나 — 존 그림을 띄우는 동안만 참이다 */
  readonly isEventZoneShown: boolean
  /**
   * 이벤트 존 보상 "200G"(trainning 애니 3)의 x — 존이 서 있는 동안만 값, 아니면 null (`EVENT_ZONE_REWARD` · 0x41098)
   */
  readonly eventZoneRewardX: number | null
  /**
   * HUD 콤보 표시(장면 +0x1b60)가 켜져 있으면 그리는 값(+0x84), 아니면 null.
   * 다음 공 준비(상태 0xf)에서 켜져 `COMBO_DISPLAY_FRAMES` 갱신 뒤 꺼진다 (`0x3dbf8` · `0x4585c`).
   */
  readonly shownCombo: number | null
  /** 판이 끝났으면 결과, 아니면 null */
  readonly result: DerbyResult | null
  /** 타석 화면에 넘길 HOMERUN 글자 창 (`BattingStage` 의 `homeRunText`) — 더비 판의 홈런 틱에 켠다. 없으면 null */
  readonly homeRunText: HomeRunTextWindow | null
  /** 지금 돌고 있는 더비 판의 비거리 판(0x36cd4). 판이 없으면 null */
  readonly distanceBoard: DerbyDistanceBoard | null
  /**
   * 타석 화면에 넘길 **효과를 치운 시각**(`BattingStage` 의 `effectsClearedAt`) — 키 건너뛰기 0x519cc(효과 객체 칸 0x8fc70 ·
   * 파티클 0x6dee4)의 키 틱, 0x17 끝 0x35108(0x351e2 의 0x6dee4)의 판 끝. 없으면 null
   */
  readonly effectsClearedAt: number | null
  /**
   * 판(0x17)이 도는 동안 받은 키 — 0x17 키 처리 0x53420 이 키마다 보내는 메시지 0x587 → 0x519cc (`skipDerbyBattedBall` 머리말).
   * 홈런 틱 다음부터 판 끝 전까지만 효과가 있다: 공 틱을 끝으로 넘겨 다음 틱에 관문을 닫고(판 끝 = 키 틱 + 1 + 10),
   * HOMERUN 글자를 끄고, 울리던 소리를 끊는다(0x519fe 의 0x6e418 — 소리 포트 `stop`).
   */
  readonly skipHomeRun: () => void
  /**
   * **경기 장면 로딩 판의 팁 글** (StrTIP[1 + rand(0, 73)]) — 상태 7 진입 0x39f88 이 세운 로딩 판이 7 · 9 · 8 적재 내내 선다.
   * 서 있으면 화면이 로딩 판(`LoadingTip`)을 그리고 다 그리면 `finishLoading`. 난수가 없으면(예전 시험) 늘 null
   */
  readonly loadingTip: string | null
  /** 로딩 판을 다 그렸다 — 적재 8 끝이 모드 7 이면 0xd(0x3fa4c~0x3fa50) → 두 그림 뒤 0xe. 굴림 없음 */
  readonly finishLoading: () => void

  readonly onPitchResolved: (detail: PitchOutcomeDetail) => void
  /** 경기 중 메뉴 [다시하기] 예 — 새 경기 장면 (0x3c98e 모드 7 갈래, `restart` 머리말) */
  readonly restart: () => void
  /** 결과 창 [예] — 단계 > 0 이면 rand(1, 4) 를 하나 더 굴린 뒤 `restart` 와 같다 (0x40a08) */
  readonly retryFromResult: () => void
}

/**
 * 홈런더비 한 판의 진행 (H-2).
 *
 * 원본은 공 하나가 끝날 때마다 0xae24c(맞지 않은 공 — 상태 0x12 끝 0x4e78c)·0xae3e8(맞은 공 — 인플레이 0x17 끝 0x52a52)
 * 로 들어가 기회를 하나 쓴다 — 두 함수의 모드 7 갈래는 볼카운트를 건드리지 않으므로(0xae26a · 0xae408 에서 일반 갈래로 안 간다)
 * **던진 공은 무엇이든 기회 한 번**이다. 다만 판정 스위치 0x3dfac 는 볼 수 st[5] 를 그대로 올려(스트라이크만 모드 7 이면 안 센다)
 * 심판 콜이 그 칸을 본다 — `derbyPitchCallOf`.
 *
 * **볼넷 · 사구 뒤 다음 타자** — v3 · v4(0x3e1ae · 0x3e1b4)가 `0xaf020(공격 팀, 0)` 으로 다음 타순을 예약하고 다음 0xd 진입
 * 0x48d50 의 48ddc `0xaebe4(팀, 0)` 이 타순 +0x32 를 넘긴다. 모드 7 은 타순을 되돌리지 않아 그 뒤로는 **내 팀 r7 마스터 명부의
 * 다음 칸 타자**가 친다(`derbyLineup` 머리말 — 원본 그대로). 화면이 `batter` 로 능력치 · 스킬 · 그림 · 소개 판을 그 줄로 바꾼다.
 *
 * **번트**도 같다 (90408d8 로 키가 열렸다): 번트 판정 0x51226(0x51108 안)·타구 시작 0x51408 에 모드 갈림이 없고,
 * 맞은 번트(파울 포함)는 인플레이 끝에서 0xae3e8 로 와 "홈런 아닌 공" 하나가 된다 — 기회 −1 · 직전 홈런이면 콤보 0(페어 번트는 판이 낙구 비거리를 더한다).
 * 맞지 않은 번트는 0xae24c 로 같은 셈이다. 번트를 따로 다루는 갈래는 없다. 그래서 여기서도 `detail.isBunt` 를 보지 않는다.
 *
 * 맞은 공(파울 · 번트 포함)은 **홈런더비 판(플레이 종류 8)** 을 돈다 — 타석(`resolvePitch`)이 실제로 뽑은 패턴(`detail.pattern`)으로
 * `derbyBattedBallOf` 가 판을 돌려 홈런(슬롯 2 모드 7 갈래 0x52720) · 비거리(0xa600c) · 판 끝(공 멈춤 + 10틱)을 낸다(그 파일 머리말).
 * 판 안 굴림은 폴 충돌 rand(−25, 25) 하나뿐이다 — 야수는 쫓지도 쥐지도 않는다(공 틱 vt48 · 플레이 틱 vt4c 가 종류 8 이면 안 돈다).
 */
export function useHomeRunDerby({
  bestDistance,
  onFinish,
  aceLevels,
  random,
  myTeamId = DERBY_NO_BATTER_SAVE_TEAM_ID,
  modeBatterSlot = 0,
  onOpenHidden,
}: HomeRunDerbyOptions): HomeRunDerbySession {
  /** HUD 가 그리는 진행 — 셈(`runRef`)은 공이 맞은 순간 하고, 이 칸은 판 끝 · 0x12 대기 끝에 따라 맞춘다 */
  const [run, setRun] = useState<DerbyRun>(createDerbyRun)
  const [isPaused, setIsPaused] = useState(false)
  /** 상대 팀 v (장면 시작 굴림 3a454) — 난수가 없으면 undefined */
  const [opponentTeamId, setOpponentTeamId] = useState<number | undefined>(undefined)
  /** 마운드에 선 투수의 단계 — 상태 0xd 진입 0x48d50 이 마투수를 복사할 때만 바뀐다 */
  const [moundStage, setMoundStage] = useState(0)
  /** 볼 수 st[5] — 0xd 진입 0x48e9c(0xb6764)만 지운다 (`derbyPitchCallOf`) */
  const ballsRef = useRef(0)
  /** 벤치 클리어링(상태 0x1e) 중인가 */
  const [isBenchClearing, setIsBenchClearing] = useState(false)
  /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 */
  const [benchClearingEntryRolls, setBenchClearingEntryRolls] = useState<readonly BenchClearingEntryRoll[] | null>(null)
  const isBenchClearingRef = useRef(false)
  const myTeamIdRef = useRef(myTeamId)
  myTeamIdRef.current = myTeamId
  const modeBatterSlotRef = useRef(modeBatterSlot)
  modeBatterSlotRef.current = modeBatterSlot
  /** 공격 팀 타순 — 셈(예약 포함)은 ref, 화면 칸은 0xd 에서 타순이 넘어갈 때 맞춘다 */
  const lineupRef = useRef<DerbyLineup>(createDerbyLineup(myTeamId, modeBatterSlot))
  const [lineup, setLineup] = useState<DerbyLineup>(lineupRef.current)
  /** 경기 초기화 0x39fdc 모드 7 — 팀 0 을 새로 세워 타순을 모드 타자 칸 k 로 */
  const startLineup = () => {
    const fresh = createDerbyLineup(myTeamIdRef.current, modeBatterSlotRef.current)
    lineupRef.current = fresh
    setLineup(fresh)
  }
  // 경기 시작: 적재 상태 8 끝이 모드 7 이면 미리 넣어 둔 0xd 로 간다(0x3fa4c~0x3fa50 · R10 0x48b20) → 0x39e14 → 0xe
  const [isPreparing, setIsPreparing] = useState(true)
  const [isAwaitingConfirm, setIsAwaitingConfirm] = useState(false)
  const [isEventZoneShown, setIsEventZoneShown] = useState(false)
  const [eventZoneRewardX, setEventZoneRewardX] = useState<number | null>(null)
  const [shownCombo, setShownCombo] = useState<number | null>(null)
  const [result, setResult] = useState<DerbyResult | null>(null)
  const [homeRunText, setHomeRunText] = useState<HomeRunTextWindow | null>(null)
  const [effectsClearedAt, setEffectsClearedAt] = useState<number | null>(null)
  const [distanceBoard, setDistanceBoard] = useState<DerbyDistanceBoard | null>(null)
  /** 장면의 글자 칸(+0x1961~+0x196a) — 더비는 앞 연출이 남긴 셈에서 이어 센다. 장면을 새로 세우면(다시하기) 0 */
  const homeRunTextSceneRef = useRef<HomeRunTextState>(HOME_RUN_TEXT_SCENE_START)
  /** 지금 도는 판 — 키 건너뛰기가 다시 셈하는 재료 */
  const playRef = useRef<{
    readonly startedAt: number
    readonly batted: DerbyBattedBall
    readonly runBefore: DerbyRun
    readonly isEventZoneHit: boolean
    readonly textSceneBefore: HomeRunTextState
  } | null>(null)

  // 캔버스 루프에서 불리는 콜백이라 최신 값은 전부 ref 로 읽는다 (StrictMode 가 업데이터를 두 번 돌린다).
  // `runRef` 가 셈의 원본이다 — 화면 칸 `run` 은 판 끝에야 따라오므로 그림마다 되덮지 않는다
  const runRef = useRef(run)
  const bestRef = useRef(bestDistance)
  bestRef.current = bestDistance
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const onOpenHiddenRef = useRef(onOpenHidden)
  onOpenHiddenRef.current = onOpenHidden
  const randomRef = useRef(random)
  randomRef.current = random

  // 장면에 들어선 첫 그림 뒤 한 번 — 첫 공(상태 0xd → 투구)보다 앞이다. StrictMode 의 효과 두 번 돌기에도 한 번만
  const isSceneStartRolledRef = useRef(false)
  /** 하늘 줄 — 구장 +0x10 (`rollDerbySceneStart` · 결과 진입 0x4f574). 굴리기 전(난수 없음)엔 undefined — 타석 그림이 굴린다 */
  const [skyRow, setSkyRow] = useState<number | undefined>(undefined)
  /** 두 구장 객체 — 장면 시작마다 새로 (`rollDerbySceneStart`) */
  const [sceneStadium, setSceneStadium] = useState<SceneStadium | null>(null)
  /** 로딩 판의 팁 글 — 서 있는 동안 0xd 시계를 안 건다 (`finishLoading` 이 건다) */
  const [loadingTip, setLoadingTip] = useState<string | null>(null)
  const isLoadingRef = useRef(false)
  /** 새 경기 장면의 시작 굴림 — 하늘 줄과 로딩 판 팁을 세운다. 난수가 없으면 아무것도 안 한다 */
  const startScene = () => {
    if (randomRef.current === undefined) return
    const started = rollDerbySceneStart(randomRef.current, myTeamIdRef.current)
    setOpponentTeamId(started.opponentTeamId)
    // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 첫 장면 · 다시하기 · 재도전마다 새 장면이다
    activeSound().stop()
    // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다
    startPlayClock()
    setSkyRow(started.skyRow)
    setSceneStadium(started.stadium)
    isLoadingRef.current = true
    setLoadingTip(LOADING_TIPS[started.loadingTipIndex] ?? null)
  }
  useEffect(() => {
    if (isSceneStartRolledRef.current) return
    isSceneStartRolledRef.current = true
    // 0x39fdc 모드 7 갈래 3a49c — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`). 더비는 한 공 끝 판정 A 가 0x18 로
    // 안 가(모드 7 → 0xd / 0x1a) 이닝 넘김 0xb6b6c 를 안 지나므로 그대로 0 이 남는다
    resetLiveGameState()
    startScene()
  }, [])

  // 아래 시계는 모두 경기 장면 시계로 잰다(`setGameSceneTimeout`) — 더비도 경기 장면 0x104(모드 7)라 공용 창이 서 있으면 0x52c50 이
  // 52cc6 에서 장면 틱 · 진입 · 갱신을, 53086 에서 공 틱 0x3f378 을 건너뛴다. 판 끝 · 0xd 두 그림 · 0xe 잠금 · 판 안 소리가 그동안 서고
  // 닫히면 남은 만큼 이어 센다. 콤보 표시만은 그리기 셈이다 — HUD 그리기 0x45a54 → 0x4585c 가 [+0x19ec] 를 그릴 때마다 +1 하고
  // 0x14 를 넘으면(45a00~45a0a) 끈다. 52efe 가 창이 선 첫 그림([창+0x250])은 그리기를 한 번 더 돌리므로 그 한 그림도 센다(확정 r166 —
  // `createGameSceneDrawGate`)
  const timerRef = useRef<number | null>(null)
  /** 판 안 소리(홈런 11 · 파울 25)를 그 공 틱에 내는 시계들 */
  const playSoundTimersRef = useRef<number[]>([])
  const clearTimer = () => {
    if (timerRef.current !== null) clearGameSceneTimeout(timerRef.current)
    timerRef.current = null
  }
  const clearPlaySoundTimers = () => {
    for (const timer of playSoundTimersRef.current) clearGameSceneTimeout(timer)
    playSoundTimersRef.current = []
  }
  /** HUD 콤보 표시(+0x1b60)가 꺼질 때 — 상태 0xf 에서 켠 뒤 21 번 그리면 끈다 */
  const comboTimerRef = useRef<(() => void) | null>(null)
  const clearComboTimer = () => {
    comboTimerRef.current?.()
    comboTimerRef.current = null
  }
  /** 상태 0xe 의 키 잠금(틱 ≤ 2)이 풀렸나 */
  const isConfirmUnlockedRef = useRef(false)
  const confirmLockTimerRef = useRef<number | null>(null)
  const clearConfirmLockTimer = () => {
    if (confirmLockTimerRef.current !== null) clearGameSceneTimeout(confirmLockTimerRef.current)
    confirmLockTimerRef.current = null
  }
  /** 0xe 의 키 잠금 시계 — 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신이 지나야 OK 를 받는다 */
  const armConfirmLock = () => {
    clearConfirmLockTimer()
    isConfirmUnlockedRef.current = false
    confirmLockTimerRef.current = setGameSceneTickTimeout(() => {
      confirmLockTimerRef.current = null
      isConfirmUnlockedRef.current = true
    }, CONFIRM_LOCK_FRAMES)
  }
  /** 상태 0xd → 0xe 로 들어선다 — OK 를 기다린다 */
  const enterConfirmWait = () => {
    isAwaitingConfirmRef.current = true
    setIsAwaitingConfirm(true)
    armConfirmLock()
  }
  const isAwaitingConfirmRef = useRef(isAwaitingConfirm)

  /**
   * 상태 0xd 진입 0x48d50 이 진행에 하는 일 — 모드 7 · 단계 > 0 이면 마투수 표 0xcfce8[단계 − 1] 레코드를 지금 투수에
   * 0x30 바이트 복사(48d8e~48dd4), 볼카운트 지우기 0x48e9c(`0xb6764`). 첫 공 앞의 0xd 도 같은 진입이다.
   */
  const enterSceneD = () => {
    // 48ef8~48f04 — 이전 상태가 0x16 이 아니면 파티클 관리자를 비운다(0x6dee4). 더비의 0xd 는 0x16 을 안 거친다
    clearSceneParticles()
    setMoundStage(runRef.current.stage)
    // 48ddc 0xaebe4(공격 팀, 0) — 볼넷 · 사구가 예약한 다음 타순(+0x291 · +0x293)을 여기서 확정한다. 모드 7 도 되돌리지 않는다
    const confirmed = confirmDerbyNextBatter(lineupRef.current)
    if (confirmed !== lineupRef.current) {
      lineupRef.current = confirmed
      setLineup(confirmed)
    }
    ballsRef.current = 0
  }

  /** 상태 0xd — `SCENE_D_FRAMES` 갱신 뒤 0xe 로 간다 (0x39e14) */
  const prepareTimerRef = useRef<number | null>(null)
  const clearPrepareTimer = () => {
    if (prepareTimerRef.current !== null) clearGameSceneTimeout(prepareTimerRef.current)
    prepareTimerRef.current = null
  }
  const armScenePrepare = () => {
    clearPrepareTimer()
    // 0xd 첫 그림 — 0x48d50 의 48ecc 메시지 0xbc1 → 0x522d2 의 타석 등장음(모드 갈림 없음). 더비의 0xd 는 첫 공 앞 ·
    // 단계가 오를 때 · 보너스를 열 때뿐이라 교체 연출 0x16 을 안 거친다. 타자는 모드 타자(나리 · 명전 기록 — 마선수 비트 0x40 없음)라
    // 26 이 아니고, 주자를 두는 판이 없어 14 다.
    // 볼넷 · 사구 뒤에도 주자가 안 선다 (2026-10-14 직접 떴다): 판정 v3 · v4(0x3e1ae · 0x3e1b4)는 플레이 종류만 2 로 두고
    // (0xb0cb8(플레이, 2)), 주자를 루에 세우는 것은 0x12 끝 0xae24c 의 일반 갈래 ae344~ae35c(st[0xb] 3 · 4 → 상태 0x17)다.
    // 모드 7 은 ae270 `cmp 7` 에서 ae274~ae336(기회 셈 → 0xd 또는 0x1a)으로 갈라 0x17 을 안 지난다 → 0xa97a1(2·3루)이 늘 거짓이라
    // 15 가 아니라 늘 14 다. 웹 더비에 주자 칸이 없는 것도 원본 그대로다
    playSoundIds(audioRef.current, [DERBY_AT_BAT_ENTRY_SOUND])
    prepareTimerRef.current = setGameSceneTickTimeout(() => {
      prepareTimerRef.current = null
      setIsPreparing(false)
      enterConfirmWait()
    }, SCENE_D_FRAMES)
  }
  /** 상태 0xd 로 들어선다 — 아직 OK 를 받지 않는다. 로딩 판이 서 있으면 시계는 `finishLoading` 이 건다 */
  const enterScenePrepare = () => {
    enterSceneD()
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    setIsPreparing(true)
    if (isLoadingRef.current) clearPrepareTimer()
    else armScenePrepare()
  }

  // 첫 공 앞의 0xd — 시계만 건다 (StrictMode 의 효과 두 번 돌기에도 같은 결과다). 로딩 판이 서 있으면 다 그린 뒤
  useEffect(() => {
    if (!isLoadingRef.current) armScenePrepare()
  }, [])

  /** 로딩 판(상태 7 · 9 · 8)을 다 그렸다 — 적재 8 끝이 모드 7 이면 0xd 로 → 두 그림 뒤 0xe */
  const finishLoading = useCallback(() => {
    if (!isLoadingRef.current) return
    isLoadingRef.current = false
    setLoadingTip(null)
    armScenePrepare()
  }, [])

  useEffect(() => () => {
    clearTimer()
    clearPlaySoundTimers()
    clearComboTimer()
    clearConfirmLockTimer()
    clearPrepareTimer()
  }, [])

  const audio = activeSound()
  const audioRef = useRef(audio)
  audioRef.current = audio

  /** 0x45a0c~0x45a18 — 콤보 표시를 끄고 +0x84 = 0 */
  const endShownCombo = () => {
    clearComboTimer()
    const ended = endComboDisplay(runRef.current)
    runRef.current = ended
    setRun(ended)
    setShownCombo(null)
  }

  /**
   * 다음 공 준비(상태 0xf) 진입 0x3d954 — 0x3dbf8: +0x84 > 0 이면 HUD 콤보 표시를 켠다(+0x1b60 = 1 · +0x19ec = 0).
   * 0x3db92~0x3dbf2(모드 7 애니 되돌리기)는 `DerbyHud` 가 표시를 켤 때 첫 칸부터 그리는 것으로 갈음한다.
   */
  const enterNextPitch = () => {
    if (shouldShowComboAtNextPitch(runRef.current)) {
      setShownCombo(runRef.current.comboDisplay)
      clearComboTimer()
      // 그린 수 [+0x19ec] — 장면 틱마다 한 그림, 창이 서 있으면 첫 그림만 (0x4585c 45a00~45a0a)
      const drawGate = createGameSceneDrawGate()
      let draws = 0
      comboTimerRef.current = setGameSceneTickInterval(() => {
        if (!drawGate.allowsDraw()) return
        draws += 1
        if (draws >= COMBO_DISPLAY_FRAMES) endShownCombo()
      })
    }
  }

  const confirm = useCallback(() => {
    if (!isAwaitingConfirmRef.current || !isConfirmUnlockedRef.current) return
    // 메시지 1 → 0x50c18: 인자 0xe 면 0xf 예약. 돌발 객체 +0xf28 은 홈런더비에 없어(돌발미션은 모드 1·2·4 — `gameFlow`) 0x1b 로 안 샌다
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    enterNextPitch()
  }, [])

  const onPitchResolved = useCallback((detail: PitchOutcomeDetail) => {
    // 원본은 공 하나가 상태 0xf 에서 21 갱신 안에 끝날 수 없어 표시는 늘 그 전에 꺼진다 — 웹 타이머가 늦으면 여기서 먼저 끈다
    if (comboTimerRef.current !== null) endShownCombo()
    const current = runRef.current
    if (current.isFinished) return

    // 상대 투수 투구 소모(0x3dec6 → 0xa5e14)는 모드를 가리지 않아 홈런더비에서도 돌지만 **결과에 닿지 않는다** —
    // 체력%를 읽는 0xaebb0 이 모드 7 이면 늘 100 을 돌려준다 (0xaebbc `cmp r3,#7` → `movs r0,#0x64`).
    // 그래서 CPU 제구 등급(0x4dbac)·피로(0xb58e6)·교체(0xac428) 모두 지치지 않은 투수로 본다.
    // `detail.pitchTypeNumber` 로 깎을 칸을 두지 않는다.

    // **타구 순간 소리** (0x515de~0x5164a) — 강 5 · 보통 6 · 약 59 · 큰 타구 7 · 헛스윙 8.
    // 고르는 것은 `features/play-at-bat/model/atBatSounds` 가 이미 했고 여기는 울리기만 한다.
    // **심판 콜** — 판정 스위치 0x3dfac · 화면 0x51a56 은 모드를 안 가린다: 스트라이크 · 헛스윙 18, 볼 16, 0xd 뒤 넷째 볼부터 24,
    // 사구 23 (`derbyPitchCallOf` 머리말). 볼 수 st[5] 는 0xd 진입만 지운다
    const call = derbyPitchCallOf(detail.resolution, ballsRef.current)
    ballsRef.current = call.balls
    // 볼넷 v3 → 사구 v4 0x3e1b4 `0xaf020(공격 팀, 0)` — 다음 타순 예약. 확정은 다음 0xd 진입(`enterSceneD`)
    if (call.judgment === 3 || call.judgment === 4) lineupRef.current = reserveDerbyNextBatter(lineupRef.current)
    playSoundIds(audioRef.current, [detail.contactSoundId, call.soundId])

    // **맞은 공은 홈런더비 판(종류 8)을 돈다** (2026-10-07 직접 뜸 — `derbyBattedBall` 머리말). 원본은 모드 7 도 맞은 공이면
    // 각과 무관하게(파울 · 번트 포함) 판(상태 0x17)을 돌고 그 끝 0x52a52 → 0xae3e8 모드 7 갈래로 간다(H-2). 판 시작은 폴 충돌
    // rand(−25, 25)(쏘기 · 세계 51172~511a4 안 — 필살수비 굴림은 0x50fba 가 모드 7 이면 없다)와 [경기+0xf2c] 공의 같은 굴림만 돈다. 공 틱 0xb401c 가
    // 안 돌아 포구 · 쥐기(b2766) · 펌블 · 판 끝 결과 코드 · 메시지 0xbba 가 없다 — **파울 뜬공 아웃도 없다**.
    // 필살타법은 더비 타석에 번호가 없어(`HomeRunDerbyScreen` 이 `specialSwingNumber` 를 안 넘김) 0x517e6 굴림 차례 문제가 없다.
    // 홈런 = 땅에 닿기 전에 담장선 · 폴을 넘은 페어 공(0x52720). 예전 웹은 타석의 임시 결과(`provisionalOutcomeOf`)로 정했다
    // 이어 [경기+0xf2c] 공(수평각 d)의 점 깔기 — 폴에 맞으면 굴림이 하나 더 (`derbyBattedBallOf` 머리말)
    const batted = detail.pattern === undefined ? null : derbyBattedBallOf(detail.pattern, randomRef.current, detail.batterHand)
    // 판 안 소리 — 홈런 갈래 0x527c4 의 11 · 파울 공 낙구 0x5284a 의 25 "Foul!"(즉시, 그 공 틱에)
    // 공 틱 0 = 이 자리(타석 화면이 상태 0x13 을 지나 판을 넘긴 틀)의 장면 틱 — 판 시각은 그 틱의 머리라 판 안의 틱(소리 · 글자 창 ·
    // 키 틱 · 판 끝)이 모두 경기 장면 틱 격자에 선다. ⚠️ 근사(때): 판을 넘긴 틀의 틱을 `gameSceneTickNow()` 로 다시 읽는다 —
    // rAF 틀 머리와 이 자리 사이에 틱 머리가 지나면 한 틱 늦게 선다
    // HOMERUN 글자(0x5279a~0x527ac)는 판의 홈런 틱에 켜고(`derbyHomeRunTextOf`), 비거리 판(0x36cd4)은 판 내내 띄운다.
    // 0x90191(…, 2, 1) 홈런 효과 객체(알갱이 7 · 난수)는 글자 창의 첫 그림(홈런 틱)에 타석 화면이 깔고, 유지 단계 그림마다 굴린다
    // (widgets/batting-stage `homeRunEffects`). ⚠️ 근사(때): 파티클 · 효과 틱은 타석 화면이 rAF 로 도는 틱이라 탭이 쉬면 밀린다
    clearPlaySoundTimers()
    const startedAt = gameSceneTickStartTime(gameSceneTickNow())
    if (batted !== null) {
      schedulePlaySounds(batted, startedAt, 0)
      playRef.current = {
        startedAt,
        batted,
        runBefore: current,
        isEventZoneHit: isEventZoneHit({ pattern: detail.pattern ?? null }),
        textSceneBefore: homeRunTextSceneRef.current,
      }
      showPlay(batted)
    } else {
      playRef.current = null
      setHomeRunText(null)
      setDistanceBoard(null)
    }
    // 이벤트 존은 "공이 날아가는 중" 조건이라 배트에 맞은 공에서만 본다 (0x36dfc) — 패턴 플래그 & 2 (+0x127)
    const zoneHit = isEventZoneHit({ pattern: detail.pattern ?? null })
    applyPlayResult(current, batted, zoneHit)
    setIsEventZoneShown(zoneHit)
    // 존을 놓은 공의 "200G" 애니 자리 — 0x41098 4111c 가 +0xfcc(판정 수평각)로 가른다
    setEventZoneRewardX(zoneHit && detail.pattern != null ? eventZoneRewardXOf(detail.pattern[0]) : null)
    setIsPaused(true)
    // 맞지 않은 공은 상태 0x12 — 15틱(볼넷 · 사구면 31틱) 뒤 0x4e740: 사구(st[0xb] == 4)면 벤치 클리어링 굴림
    isHitByPitchRef.current = call.judgment === 4
    armPlayEnd(batted === null ? derbyNoContactWaitFramesOf(call.judgment) : batted.endTicks)
  }, [])

  /** 이번 공이 사구(판정 v4)였나 — 0x12 대기 끝의 벤치 클리어링 굴림 조건 */
  const isHitByPitchRef = useRef(false)

  /** 판 안 소리를 공 틱에 맞춰 건다 — `fromTick` 앞의 틱은 이미 지났다 */
  const schedulePlaySounds = (batted: DerbyBattedBall, startedAt: number, fromTick: number) => {
    const soundTicks = [
      ...batted.homeRunTicks.map((tick) => ({ tick, soundId: DERBY_HOME_RUN_SOUND })),
      ...(batted.foulCallTick === null ? [] : [{ tick: batted.foulCallTick, soundId: FOUL_CALL_SOUND }]),
    ].filter(({ tick }) => tick >= fromTick)
    const elapsed = gameSceneNow() - startedAt
    for (const { tick, soundId } of soundTicks) {
      playSoundTimersRef.current.push(
        setGameSceneTimeout(
          () => playSoundIds(audioRef.current, [soundId]),
          Math.max(0, tick * millisecondsPerFrame() - elapsed),
        ),
      )
    }
  }

  /** HOMERUN 글자 창 · 비거리 판을 이 판으로 — 글자 칸은 판 앞에 남은 칸에서 셈한다 */
  const showPlay = (batted: DerbyBattedBall) => {
    const play = playRef.current
    if (play === null) return
    const text = derbyHomeRunTextOf(batted, play.startedAt, play.textSceneBefore, millisecondsPerFrame())
    homeRunTextSceneRef.current = text.after
    setHomeRunText(text.window)
    setDistanceBoard({ startedAt: play.startedAt, batted, previous: play.runBefore.lastDistance })
  }

  /**
   * 0xae3e8/0xae24c 모드 7 갈래 — 이 판의 홈런 · 비거리로 진행을 셈한다. 셈은 판 시작에 미리 해 두고(난수를 안 쓴다)
   * 화면 칸(`run`)은 판 끝 `armPlayEnd` 에서 맞춘다.
   */
  const nextSceneStateRef = useRef<number>(0xf)
  const applyPlayResult = (
    before: DerbyRun,
    batted: DerbyBattedBall | null,
    zoneHit: boolean,
  ) => {
    const isHomeRun = batted?.isHomeRun ?? false
    const next = applyDerbyPitch(before, {
      isHomeRun,
      distance: batted?.distance ?? 0,
      displayDistance: batted?.displayDistance ?? null,
      isEventZoneHit: zoneHit,
    })
    // 0xae3e8/0xae24c 가 돌려주는 다음 상태 — 0xd(→ 0xe OK 대기) · 0xf · 0x1a
    nextSceneStateRef.current = derbySceneStateAfter(before, next)
    runRef.current = next
  }

  /** 판 끝(관문이 닫힌 뒤 10틱 → 0xbb9 → 0xae3e8) · 0x12 대기 끝 시계 — 지금 장면 틱에서 `ticks` 틱 뒤 틀 머리 */
  const armPlayEnd = (ticks: number) => {
    clearTimer()
    timerRef.current = setGameSceneTickTimeout(() => {
      timerRef.current = null
      // 판정 B 0xae3e8 의 모드 7 갈래 머리 ae40e~ae41a — 이 판에 홈런(state[0x1d])이 났으면 소리를 끊는다(0x6e418).
      // 맞지 않은 공(0xae24c)은 이 갈래가 없다
      if (playRef.current?.batted.isHomeRun === true) audioRef.current.stop()
      // 52a00~52a16 — 판(0x17) 끝, 0x35108 · 0xae3e8 앞에서 누적 비거리 st+0x34 > 1999 면 히든 39. 누적은 판 안 0xa600c 가
      // 이미 더했다(웹은 판 시작에 셈해 둔 `runRef`). 맞지 않은 공(0x12)은 이 갈래를 안 지난다
      if (playRef.current !== null && runRef.current.totalDistance > DERBY_DISTANCE_HIDDEN_THRESHOLD) {
        onOpenHiddenRef.current?.(DERBY_DISTANCE_HIDDEN_ID)
      }
      // 0x17 끝 0x35108 — 판(맞은 공)이었으면 파티클을 치운다(0x351e2 → 0x6dee4). 맞지 않은 공(0x12)은 0x17 을 안 지난다
      if (playRef.current !== null) setEffectsClearedAt(gameSceneTickStartTime(gameSceneTickNow()))
      playRef.current = null
      setIsEventZoneShown(false)
      setEventZoneRewardX(null)
      // 0x17 끝 0x35108 — HOMERUN 글자를 끄고(0x351d0) 0x17 그리기(비거리 판)도 더는 안 돈다
      setHomeRunText(null)
      setDistanceBoard(null)
      // 0x12 갱신 0x4e740~0x4e776 — 사구(st[0xb] == 4)면 플레이 종류 [+0x118] 은 v4 의 0xb0cb8(플레이, 2) 가 쓴 2 라
      // 8(더비 판) 검사에 안 걸린다 → 더비도 rand(0, 99) ≤ 19 면 벤치 클리어링(0x1e). 돌발 객체는 더비에 없다
      if (isHitByPitchRef.current) {
        isHitByPitchRef.current = false
        const scene = randomRef.current
        if (
          scene !== undefined &&
          rollsIntoBenchClearing({ isHitByPitch: true, isHomeRunDerby: false, burstInProgress: false }, scene)
        ) {
          // 진입 0x3a5f0 — 공격 9명 굴림 45 번 (`rollBenchClearingEntry`). 꼬리 0x3ab4a~ 의 수비 CPU 투구 수 +10 · 평판 0xa755c 는
          // 더비에 보이는 곳이 없다(체력% 0xaebb0 은 모드 7 이면 늘 100 · 기록은 a780a 가 막는다)
          setBenchClearingEntryRolls(rollBenchClearingEntry(scene))
          isBenchClearingRef.current = true
          setIsBenchClearing(true)
          return
        }
      }
      finishPitch()
    }, ticks)
  }

  /** 0xae3e8 · 0xae24c 를 지난 뒤 — 화면 칸을 셈에 맞추고 다음 상태(0xf · 0xd · 0x1a)로 */
  const finishPitch = () => {
    // 0xae3e8 · 0xae24c — 기회 · 공 번호 · 누적 · 콤보 칸이 여기서 바뀐다
    setRun(runRef.current)
    if (runRef.current.isFinished) {
      const finished = derbyResultOf(runRef.current, bestRef.current)
      setResult(finished)
      // 결과 창 진입 0x4f574 의 4f6b0 — 구장 준비 0x352e8 을 다시 불러 하늘 줄 rand(0, 6) 을 한 번 더 굴린다(결과 배경이 이 줄)
      if (randomRef.current !== undefined) setSkyRow(randomRef.current.rand(0, SKY_ROW_COUNT))
      // 결과 창(상태 0x1a) 진입 0x4f574 — 누적 > 저장 +0x5c 면 신기록 0x1f(31), 아니면 0x20(32)
      // 을 예약한다 (R14 1-2 · L 1-F). 승패 징글과 **같은 번호를 나눠 쓰는 자리**다
      playSoundIds(audioRef.current, [finished.isNewRecord ? WIN_SOUND : LOSE_SOUND])
      // 결과에는 기록달성 목록이 없다: 0x4f710 `0x22e10` 은 나리 타자편 버퍼(0x328c8 0x213c0(mgr, 4, 0))의 이번 경기 칸을
      // 더하는데, 더비 중엔 a780a(state[1] = 7)가 기록을 막고 game_br.sav 의 그 칸은 늘 0 이라 0 마흔이다 (annalsStats 머리말)
      onFinishRef.current?.(finished)
      return
    }
    setIsPaused(false)
    // 단계가 오르거나 보너스 게임을 열 때(0xae3e8 → 상태 0xd)는 0xe 에서 **사람 OK 를 기다린 뒤** 0xf 를 지난다 (확정, U-89):
    //   0xd 갱신 0x39e14 — 틱 > 0 이고 점수판 [+0xf10]+0x6c ≠ 1 이면 0xe (모드 갈림 없음)
    //   0xe 진입 0x50674 — 강판 0x504cc 는 모드 3 이 아니면 늘 0(0x504de) → 0x23 으로 안 샌다
    //   0xe 갱신 0x39bd4 — 모드 7 이면 아무것도 안 한다 (시간 제한·자동 진행 없음)
    //   0xe 키 0x532b0 — OK(−5·'5') → 메시지 1 → 0x50c18: 인자 0xe 면 상태 0xf (돌발 객체 +0xf28 이 있고 0x8f158 참일 때만 0x1b → 0xf)
    //   0xf 진입 0x3d954 → 0x3db92~0x3dbf2(모드 7 애니 되돌리기) · 0x3dbf8(+0x84 > 0 → 표시 켜기)
    // (예전 근거 "0x48d50 의 0x49846" 은 0x49846 이 교체 화면 키 0x495fc 안이라 틀린 주소였다.)
    //   0xd 는 늘 두 그림(`SCENE_D_FRAMES`) 머문다 — 점수판 +0x6c 는 1 이 되는 일이 없다.
    // 0xe 그리기 0x4d9ec 는 0xd 그리기에 0x44944(투수·타자 소개 판)를 더 그린다 — 화면이 `isAwaitingConfirm` 동안 띄운다.
    if (nextSceneStateRef.current === 0xd) {
      enterScenePrepare()
      return
    }
    // 보통 공(0xf)은 곧바로 다음 공 준비다
    enterNextPitch()
  }

  const skipHomeRun = useCallback(() => {
    const play = playRef.current
    if (play === null) return
    // 키는 그 그림의 갱신(공 틱 +1)보다 먼저 돈다 — 지금 흐르는 틱 다음 틱이 키를 받은 틱이다 (판 시각은 공 틱 0 의 머리)
    const elapsedTicks = gameSceneTickNow() - gameSceneTickOf(play.startedAt)
    const keyTick = elapsedTicks + 1
    const skipped = skipDerbyBattedBall(play.batted, keyTick)
    if (skipped === play.batted) return
    playRef.current = { ...play, batted: skipped }
    // 0x519cc 의 0x519fe — 울리던 소리를 끊는다(0x6e418). 키 틱의 홈런 소리는 그 뒤에 난다
    audioRef.current.stop()
    // 0x519cc — 키 틱 프레임 머리에서 효과 객체 칸을 버리고(0x8fc70) 파티클을 치운다(0x6dee4)
    setEffectsClearedAt(play.startedAt + keyTick * millisecondsPerFrame())
    // 키 틱의 홈런 갈래(폴 뒤 담장선)는 그대로 돌고, 그 뒤 틱의 소리는 없다
    clearPlaySoundTimers()
    schedulePlaySounds(skipped, play.startedAt, keyTick)
    showPlay(skipped)
    // 두 번 더할 갈래가 키 뒤였으면 비거리가 달라진다 — 판 앞 진행에서 다시 셈한다(원본도 0xae3e8 은 판 끝에서 돈다)
    if (skipped.distance !== play.batted.distance || skipped.displayDistance !== play.batted.displayDistance) {
      applyPlayResult(play.runBefore, skipped, play.isEventZoneHit)
    }
    armPlayEnd(Math.max(0, skipped.endTicks - elapsedTicks))
  }, [])

  /**
   * **다시하기 = 경기 장면을 새로 세운다 (확정)**. 경기 중 메뉴 [다시하기](0x3c706 → StrGAME[7] 질문 → 하위 3) 의 예
   * 처리 0x3c98e: `0x20094(앱, 5)` · 장면+0x17f9 = 1 → 모드 7 이면(0x3c9d2) 전역 0x140006c = 0x27 · `0xbc291(…, 0x103)`
   * (0x3c9d8~0x3c9e8) — 결과 창 [예](0x40a98) 와 같은 길이다. 메인 메뉴 하위 0x27 → 0x32988 → 0x327b8(this, 7) →
   * 경기 장면 0x104 를 새로 만들고, 그 초기화 0x3301c 가 `0xbcb49(장면+0x18, 7)`(0x330fe)로 **상태 7 → 9 → 8 → 0xd** 를
   * 처음부터 탄다 — 시작 굴림 rand(0, 9) · rand(0, 2) 도 다시 돈다(U-79 확정). 0x20094 모드 5 갈래(0x1ff98)에는 굴림이 없다.
   */
  const restart = useCallback(() => {
    // 장면을 나간다 — 결과 창이면 0x3c0b8 의 3c11c, 어느 길이든 소멸 0x332b8 의 332e0 이 파티클 관리자를 비우고(0x6dee4)
    // 새 장면 객체는 0 채움이다(+0xfd4 = 0)
    leaveGameSceneObject()
    clearTimer()
    clearPlaySoundTimers()
    // 경기 시작 상태 9 의 0x39868 이 +0x84 · 표시(+0x1b60) · +0x19ec 를 지운다
    clearComboTimer()
    // 새 장면 — 벤치 클리어링 연출도 버린다
    isHitByPitchRef.current = false
    isBenchClearingRef.current = false
    setIsBenchClearing(false)
    // 새 장면 — 글자 칸(+0x1961~)은 new 의 0 이다
    playRef.current = null
    homeRunTextSceneRef.current = HOME_RUN_TEXT_SCENE_START
    setHomeRunText(null)
    setDistanceBoard(null)
    setShownCombo(null)
    // 새 경기 장면의 상태 7 · 9 · 8 — 같은 시작 굴림 (0x39fdc 모드 7 의 +0x6b = 0 도 다시) · 로딩 판
    resetLiveGameState()
    startScene()
    // 0x39fdc 가 팀 0 도 새로 세운다 — 타순은 다시 모드 타자 칸
    startLineup()
    const fresh = createDerbyRun()
    runRef.current = fresh
    setRun(fresh)
    // 경기 시작과 같이 적재 8 → 0xd → 0xe 로 와서 OK 를 기다린다 (로딩 판이 서 있으면 다 그린 뒤 0xd 시계)
    enterScenePrepare()
    setIsPaused(false)
    setIsEventZoneShown(false)
    setEventZoneRewardX(null)
    setResult(null)
  }, [])

  /**
   * 결과 창 [예] 0x40a08 (0x40a54~0x40a98): +0x17f9(예) 이고 단계 state+0x38 > 0 이면
   * `r = rand(1, 4)` → `0xb89dc([장면+0x224], r)` 기록 0x30 바이트를 지금 투수 `0xae83c([장면+0x224])` 에 복사한 뒤 0x27.
   * ⚠️ 복사는 웹에 상대 팀 기록이 없어 굴림 차례만 맞춘다 (뜻 확정 U-102 — 난입 0x48d50 48d9c~48dca 가 덮은 상대 투수 칸을 40a68~40a94 가 같은 팀 r 번째 투수 사본으로 되돌린다. 모드 7 레코드는 마스터
   * 명부(0xb8728 → 0x1f8c1)이고 결과 진입 0x4f574 4f696 `0x20094(g, 5)` 가 [예] 앞에서 마스터를 다시 지어 화면에 드러나지 않는다).
   */
  const retryFromResult = useCallback(() => {
    if (runRef.current.stage > 0 && randomRef.current !== undefined) randomRef.current.rand(1, 4)
    restart()
  }, [restart])

  /** 벤치 클리어링 출구 0xae24c — 틱 10 이 돌았으면 수비 목표 굴림 8 번(0x401d4)을 낸 뒤 보통 길(0xae24c)을 간다 */
  const finishBenchClearing = useCallback((reachedTargetTick: boolean) => {
    if (!isBenchClearingRef.current) return
    isBenchClearingRef.current = false
    setIsBenchClearing(false)
    if (reachedTargetTick && randomRef.current !== undefined) rollBenchClearingTargets(randomRef.current)
    finishPitch()
  }, [])

  return {
    run,
    skyRow,
    sceneStadium,
    pitcher: derbyPitcherOf(moundStage, aceLevels, opponentTeamId),
    batter: derbyLineupBatterOf(lineup),
    modeBatterPosition: derbyModeBatterPositionOf(lineup),
    isBenchClearing,
    benchClearingEntryRolls,
    opponentTeamId,
    finishBenchClearing,
    isPaused: isPaused || isPreparing || isAwaitingConfirm || loadingTip !== null,
    isAwaitingConfirm,
    confirm,
    isEventZoneShown,
    eventZoneRewardX,
    shownCombo,
    result,
    homeRunText,
    distanceBoard,
    effectsClearedAt,
    skipHomeRun,
    loadingTip,
    finishLoading,
    onPitchResolved,
    restart,
    retryFromResult,
  }
}
