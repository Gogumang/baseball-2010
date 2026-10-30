import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { DERBY_NO_BATTER_SAVE_TEAM_ID } from '@/entities/home-run-derby/model/derbyRules'
import { derbyLineupBatterOf, derbyModeBatterPositionOf } from '@/entities/home-run-derby/model/derbyLineup'
import { derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import { createDerbyRun, type DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { activeSound } from '@/shared/api/audio/soundPort'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { leaveGameSceneObject } from '@/widgets/game-scene/model/gameSceneObject'
import type { HomeRunDerbyOptions, HomeRunDerbySession } from './useHomeRunDerby/homeRunDerbyTypes'
import { useDerbyComboDisplay } from './useHomeRunDerby/useDerbyComboDisplay'
import { useDerbyConfirmWait } from './useHomeRunDerby/useDerbyConfirmWait'
import { useDerbyLineup } from './useHomeRunDerby/useDerbyLineup'
import { useDerbyPitchEnd } from './useHomeRunDerby/useDerbyPitchEnd'
import { useDerbyPitchResolve } from './useHomeRunDerby/useDerbyPitchResolve'
import { useDerbyPlayShow } from './useHomeRunDerby/useDerbyPlayShow'
import { useDerbySceneStart } from './useHomeRunDerby/useDerbySceneStart'

export { CONFIRM_LOCK_FRAMES, resultHoldMillisecondsOf, SCENE_D_FRAMES } from './useHomeRunDerby/derbySceneFrames'
export type { DerbyFieldPlay } from './useHomeRunDerby/derbyPlayView'
export { rollDerbySceneStart } from './useHomeRunDerby/rollDerbySceneStart'

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
 *
 * 캔버스 루프에서 불리는 콜백이라 최신 값은 전부 ref 로 읽는다 (StrictMode 가 업데이터를 두 번 돌린다). `runRef` 가 셈의 원본이다 —
 * 화면 칸 `run` 은 판 끝 · 0x12 대기 끝에야 따라오므로 그림마다 되덮지 않는다. 시계는 모두 경기 장면 시계로 잰다(`setGameSceneTimeout`) —
 * 더비도 경기 장면 0x104(모드 7)라 공용 창이 서 있으면 0x52c50 이 52cc6 에서 장면 틱 · 진입 · 갱신을, 53086 에서 공 틱 0x3f378 을
 * 건너뛴다. 판 끝 · 0xd 두 그림 · 0xe 잠금 · 판 안 소리가 그동안 서고 닫히면 남은 만큼 이어 센다.
 */
export function useHomeRunDerby(options: HomeRunDerbyOptions): HomeRunDerbySession {
  const { aceLevels, myTeamId = DERBY_NO_BATTER_SAVE_TEAM_ID, modeBatterSlot = 0 } = options
  const optionsRef = useRef(options)
  const audio = activeSound()
  const audioRef = useRef(audio)
  useLayoutEffect(() => {
    optionsRef.current = options
    audioRef.current = audio
  })
  /** HUD 가 그리는 진행 — 셈(`runRef`)은 공이 맞은 순간 하고, 이 칸은 판 끝 · 0x12 대기 끝에 따라 맞춘다 */
  const [run, setRun] = useState<DerbyRun>(createDerbyRun)
  const runRef = useRef(run)
  const lineup = useDerbyLineup(myTeamId, modeBatterSlot)
  const scene = useDerbySceneStart(optionsRef, lineup.myTeamIdRef)
  const combo = useDerbyComboDisplay(runRef, setRun)
  const { enterNextPitch, resetCombo } = combo
  const wait = useDerbyConfirmWait(run.stage, runRef, audioRef, scene.isLoadingRef, scene.closeLoading, lineup.confirmNextBatter, enterNextPitch)
  const play = useDerbyPlayShow(audioRef)
  const { enterScenePrepare } = wait
  const end = useDerbyPitchEnd(optionsRef, audioRef, runRef, setRun, scene.setSkyRow, enterScenePrepare, enterNextPitch, play.endPlay, play.leavePlay)
  const { applyPlayResult, awaitPitchEnd, armPlayEnd, resetPitchEnd } = end
  const resolve = useDerbyPitchResolve(
    optionsRef,
    audioRef,
    runRef,
    wait.ballsRef,
    lineup.reserveNextBatter,
    combo.endShownComboIfOn,
    play.startPlay,
    play.skipPlay,
    applyPlayResult,
    awaitPitchEnd,
    armPlayEnd,
  )

  const { startScene } = scene
  const { startLineup } = lineup
  const { resetPlay } = play
  /**
   * **다시하기 = 경기 장면을 새로 세운다 (확정)**. 경기 중 메뉴 [다시하기](0x3c706 → StrGAME[7] 질문 → 하위 3) 의 예
   * 처리 0x3c98e: `0x20094(앱, 5)` · 장면+0x17f9 = 1 → 모드 7 이면(0x3c9d2) 전역 0x140006c = 0x27 · `0xbc291(…, 0x103)`
   * (0x3c9d8~0x3c9e8) — 결과 창 [예](0x40a98) 와 같은 길이다. 메인 메뉴 하위 0x27 → 0x32988 → 0x327b8(this, 7) →
   * 경기 장면 0x104 를 새로 만들고, 그 초기화 0x3301c 가 `0xbcb49(장면+0x18, 7)`(0x330fe)로 **상태 7 → 9 → 8 → 0xd** 를
   * 처음부터 탄다 — 시작 굴림 rand(0, 9) · rand(0, 2) 도 다시 돈다(U-79 확정). 0x20094 모드 5 갈래(0x1ff98)에는 굴림이 없다.
   */
  const restart = useCallback(() => {
    // 장면을 나간다 — 결과 창이면 0x3c0b8 의 3c11c, 어느 길이든 소멸 0x332b8 의 332e0 이 파티클 관리자를 비우고(0x6dee4)
    // 새 장면 객체는 0 채움이다(+0xfd4 = 0). 벤치 클리어링 연출 · 판 · 콤보 표시(0x39868)도 버린다
    leaveGameSceneObject()
    resetPitchEnd()
    resetPlay()
    resetCombo()
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
  }, [enterScenePrepare, resetCombo, resetPitchEnd, resetPlay, startLineup, startScene])

  /**
   * 결과 창 [예] 0x40a08 (0x40a54~0x40a98): +0x17f9(예) 이고 단계 state+0x38 > 0 이면
   * `r = rand(1, 4)` → `0xb89dc([장면+0x224], r)` 기록 0x30 바이트를 지금 투수 `0xae83c([장면+0x224])` 에 복사한 뒤 0x27.
   * ⚠️ 복사는 웹에 상대 팀 기록이 없어 굴림 차례만 맞춘다 (뜻 확정 U-102 — 난입 0x48d50 48d9c~48dca 가 덮은 상대 투수 칸을 40a68~40a94 가 같은 팀 r 번째 투수 사본으로 되돌린다. 모드 7 레코드는 마스터
   * 명부(0xb8728 → 0x1f8c1)이고 결과 진입 0x4f574 4f696 `0x20094(g, 5)` 가 [예] 앞에서 마스터를 다시 지어 화면에 드러나지 않는다).
   */
  const retryFromResult = useCallback(() => {
    const random = optionsRef.current.random
    if (runRef.current.stage > 0 && random !== undefined) random.rand(1, 4)
    restart()
  }, [restart])

  return {
    run,
    skyRow: scene.skyRow,
    sceneStadium: scene.sceneStadium,
    pitcher: derbyPitcherOf(wait.moundStage, aceLevels, scene.opponentTeamId),
    batter: derbyLineupBatterOf(lineup.lineup),
    modeBatterPosition: derbyModeBatterPositionOf(lineup.lineup),
    isBenchClearing: end.state.isBenchClearing,
    benchClearingEntryRolls: end.state.benchClearingEntryRolls,
    opponentTeamId: scene.opponentTeamId,
    finishBenchClearing: end.finishBenchClearing,
    isPaused: end.state.isPaused || wait.isPreparing || wait.isAwaitingConfirm || scene.loadingTip !== null,
    sceneDSerial: wait.sceneDSerial,
    isAwaitingConfirm: wait.isAwaitingConfirm,
    confirm: wait.confirm,
    isEventZoneShown: play.view.isEventZoneShown,
    isPlayHeld: play.view.isPlayHeld,
    eventZoneRewardX: play.view.eventZoneRewardX,
    shownCombo: combo.shownCombo,
    result: end.state.result,
    homeRunText: play.view.homeRunText,
    distanceBoard: play.view.distanceBoard,
    effectsClearedAt: play.view.effectsClearedAt,
    skipHomeRun: resolve.skipHomeRun,
    loadingTip: scene.loadingTip,
    finishLoading: wait.finishLoading,
    onPitchResolved: resolve.onPitchResolved,
    preRollContact: resolve.preRollContact,
    restart,
    retryFromResult,
  }
}
