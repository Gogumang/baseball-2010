import { useEffect, useMemo, useRef, useState } from 'react'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  closeBurstWindow,
  closeManagerHookWindow,
  confirmScene,
  giveUpPitching,
  isPitchTurn,
  pickoff,
  resolveBenchClearing,
  resolveDefensePlay,
  resolveRunnerPlay,
  returnToPitchSelection,
  startPitch,
  startPitcherGame,
  summaryOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  deepHitCheerSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  walkCheerSoundIdOf,
} from '@/features/play-at-bat/model/atBatSounds'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { GAME_INTRO_SOUND, gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
// 진행 소리(공수 교대 13 · 돌발 42/36/37)는 팀경기와 같은 자리다 — 같은 경기 장면(0x104)이라
// 규칙도 하나다. 화면 두 곳이 같은 것을 두 번 적지 않게 팀경기 쪽 것을 그대로 빌려 쓴다.
// CPU 대타 교체 소리(22 "Time!" → 들어온 타자 등판음 14/15/26)도 같은 0xf 진입 0x3d954 · 0x16 연출이라 함께 빌린다
import { pinchHitSoundIdsOf, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'
import type {
  PitchInput,
  PitcherGameOptions,
  PitcherGameProgress,
  PitcherGameSummary,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'

/**
 * 투수편 경기 한 판을 들고 있는 상태 고리.
 *
 * 진행 규칙은 전부 `features/play-pitcher-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다.
 */
export interface PitcherGameSession {
  readonly progress: PitcherGameProgress
  /** 지금 사람이 공을 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: PitcherGameSummary | null
  readonly actions: {
    /**
     * 구질·코스·게이지 칸을 정해 한 개 던진다.
     * 인플레이 타구가 되면 **거기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다.
     */
    readonly throwPitch: (input: PitchInput) => void
    /**
     * 구질 고르기(상태 0xf)에서 눌린 키 — '3'/'1'/'7' 이고 그 루에 주자가 있으면 견제 한 판을 돌린다
     * (0x53548 → 0x50f28). 아니면 아무 일도 없다.
     */
    readonly pickoff: (key: string) => void
    /** 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`) */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
    /**
     * 수비 화면이 내 수비의 주자 판(도루 · 폭투 · 견제 — `progress.pendingRunnerPlay`)을 다 돌렸다. 결과를 못 받았으면 키 없이
     * 끝까지 돌려서라도 붙든 상태를 푼다.
     */
    readonly finishRunnerPlay: (result?: DefensePlayResult) => void
    /** 상태 0xe 의 OK — 그 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 대타)을 돌린다 (`confirmScene`) */
    readonly confirmScene: () => void
    /** 조준(상태 0x10)의 CLR — 0xf 로 돌아가 0xf 진입 0x3d954 의 CPU 대타를 다시 묻는다 (`returnToPitchSelection`) */
    readonly returnToPitchSelection: () => void
    /** `#` 스스로 강판 (StrGAME[104] 에 "예") */
    readonly giveUp: () => void
    /** 감독 대사 창(0x23) 확인 */
    readonly confirmManagerHook: () => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /**
     * 벤치 클리어링 연출(상태 0x1e)이 끝났다 — 인자는 틱 10 의 갱신이 돌았는가.
     * 진행기 `resolveBenchClearing` 이 그 굴림 8 번을 내고 붙든 사구를 먹인다.
     */
    readonly finishBenchClearing: (reachedTargetTick: boolean) => void
    /**
     * 경기 끝 결과 판(상태 0x18)에서 OK — 정산(0x19)으로 넘어간다. 승리 31 · 패배 32 징글은
     * 0x19 진입(결과 적재 0x4ea0c)이 내므로 이 자리에서 낸다.
     */
    readonly enterSettlement: () => void
  }
}

export function usePitcherGame(
  options: PitcherGameOptions,
  random: RandomPort,
  /** 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 없으면 켬 (`BattingStage` 와 같다) */
  isVibrationOn?: boolean,
): PitcherGameSession {
  const [progress, setProgress] = useState<PitcherGameProgress>(() => {
    // 맨 앞은 상태 7 **진입** 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — 갱신 0x3e340 의 덱 1275 보다 먼저 (`rollSceneLoadingTip`).
    // 웹 투수편은 팁 판을 안 그려 값은 버린다
    rollSceneLoadingTip(random)
    // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 경기 장면은 배경음 없이 시작한다 (인트로 61 효과보다 먼저)
    activeSound().stop()
    // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다 (이어하기도 장면을 새로 세운다)
    startPlayClock()
    return startPitcherGame(options, random)
  })

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 내면 StrictMode 가
   * 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()
  const isVibrationOnRef = useRef(isVibrationOn)
  isVibrationOnRef.current = isVibrationOn

  /** 진행 한 걸음을 먹이고, 그 사이에 원본이 내는 소리를 울린다 (팀경기 고리와 같은 모양) */
  const step = useMemo(() => {
    return (
      next: (current: PitcherGameProgress) => PitcherGameProgress,
      soundsOf?: (
        before: PitcherGameProgress,
        after: PitcherGameProgress,
      ) => readonly (number | null)[],
    ) => {
      const current = progressRef.current
      const after = next(current)
      if (after === current) return
      progressRef.current = after
      setProgress(after)
      playSoundIds(audio, [
        ...(soundsOf === undefined ? [] : soundsOf(current, after)),
        ...stepSoundIdsOf(current, after),
        // 사람 장면 CPU 대타(0x3d954 3da70)가 교체 연출 0x16 을 지났으면 — 22(3da88) 뒤 0xe 에서 들어온 타자 등판음.
        // 다음 공을 고르기 전(0xf 진입)에 서므로 걸음 끝에 둔다 (팀경기 `useTeamGame` 과 같은 자리).
        // 투수편 사람 장면은 늘 우리 수비라 CPU 투수 교체(3da3e — 수비가 CPU 일 때)는 없고, 8회 구원 등판·강판 교체는
        // 0x21(간이 엔진) 쪽이라 0x16 을 안 지나 등판음도 없다
        ...pinchHitSoundIdsOf(current, after),
      ])
    }
  }, [audio])

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148) — 모드 3 은 적재 상태 8 끝에서 0xc 로 오므로
  // 화면(`PitcherGameScreen` 의 `GameIntro`)이 서는 자리, 곧 경기가 서는 자리다
  useEffect(() => {
    playSoundIds(audio, [GAME_INTRO_SOUND])
    // 경기 한 판에 한 번 — 고리가 살아 있는 동안 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo(
    () => ({
      throwPitch: (input: PitchInput) =>
        step(
          // 공 도착의 도루 · 폭투 판은 붙들어 수비 화면이 실시간으로 돌린다(송구 키 +0x160 — `live`)
          (current) => startPitch(current, input, random, true),
          // 투구 순간 소리 12 / 마구 28 (0x3f378) → 심판 콜(0x51a94). 통로가 하나라 뒤 소리가 앞을 끊는다.
          // 내 투수는 육성(rec+0xa 비트7)이라 0xb633d 가 거짓 — 구질 22 일 때만 28 이다
          (before, after) => {
            const releaseSound = pitchReleaseSoundIdOf({
              typeNumber: input.typeNumber,
              pitcherMagicNumber: after.lastPitch?.pitcherMagicNumber ?? 0,
              ballMagicNumber: after.lastPitch?.magicNumber ?? 0,
            })
            const resolution = after.lastResolution
            if (resolution === null) return [releaseSound]
            // 삼진 진동 100ms — 사람이 던진 공도 상태 0x12 그리기 0x4ce9c 를 지난다 (0x4d0d6, `strikeoutVibration`)
            vibrate(strikeoutVibrationMillisecondsOf(resolution, before.atBat.strikes), isVibrationOnRef.current !== false)
            // 진행기가 타석이 끝나면 볼카운트를 새 타석으로 되돌리므로, 심판 콜이 보는
            // "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
            const nextAtBat = applyPitchResolution(before.atBat, resolution)
            return [
              releaseSound,
              pitchCallSoundIdOf(resolution, nextAtBat),
              // 공 도착 0x3dfac 가 연 도루·폭투 판의 판정 콜(도루 17 · 62/20, 폭투 17) — 원본은 판 안의 그 틱에 낸다.
              // 웹은 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다 (견제와 같은 근사)
              after.lastArrivalPlay !== null && after.lastArrivalPlay !== before.lastArrivalPlay
                ? after.lastArrivalPlay.callSoundId
                : null,
              // 볼넷 뒤 관중 함성 29 (0x51afa~0x51b02) — 원본은 **공격 팀이 CPU 조작**
              // (`state[0x31 + state[9]] == 1`) 일 때만 예약한다. 투수편은 사람이 늘 수비라
              // 타석에 서는 쪽이 언제나 CPU 다 → 조건이 늘 참이다.
              // 겹치는 방식도 원본과 같다 — 0x6e498 은 큐가 아니라 지금 소리를 끊는(0x6e4b8 stop)
              // 한 칸 예약이라, 24 를 끊고 이어 트는 웹 동작이 그대로다 (1ce7ba7, soundPort.ts 머리 주석)
              walkCheerSoundIdOf(nextAtBat.outcome, true),
              // 인플레이 타구면 아웃 콜은 수비 화면이 끝난 뒤다
              after.pendingDefensePlay !== null || nextAtBat.outcome === null
                ? null
                : inPlayCallSoundIdOf(nextAtBat.outcome),
            ]
          },
        ),
      /**
       * **여기서야** 진루·아웃·실점이 경기 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
       *
       * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
       * 붙들어 둔 상태를 푼다 — 안 그러면 다음 공이 영영 나가지 않는다.
       */
      finishDefensePlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingDefensePlay
        if (pending === null) return
        // 결과를 못 받았으면 남은 틱을 여기서 끝까지 돌린다 — 붙든 상태는 반드시 푼다
        const played = result ?? runDefensePlay(pending)
        step(
          (current) => resolveDefensePlay(current, played, random),
          // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·세이프 콜(0x51c14)·홈런 함성(11)은 여기서야 난다.
          // **수비 결과를 함께 넘겨야** 원본이 보는 칸(state[0x1f])과 세이프 갈래가 열린다
          // (`atBatSounds.inPlayCallSoundIdOf` 둘째 인자). 함성 60 은 원본이 **낙구 틱**에
          // 내는 것이라 이 자리는 근사다 — 타자편(`useCareerSession`)과 같은 근사·같은 순서다
          // 파울 각 공 판은 타석 칸에 결과가 없다(타석이 아직 안 끝났다) — 파울로 닫히면 결과 코드 7 메시지 51c5c 의 25,
          // 낙구 전에 잡히면(파울 뜬공 아웃) 판 끝 정산의 아웃 콜이다(`inPlayCallSoundIdOf` 는 `played.outcome` 을 먼저 본다)
          (before) => {
            const outcome = before.atBat.outcome ?? played.outcome ?? pending.outcome
            return [
              deepHitCheerSoundIdOf({
                outcome,
                carryDistance: carryDistanceOf(pending.trajectory),
                caughtOnTheFly: played.caughtOnTheFly,
                foulEnded: played.foulEnded,
              }),
              inPlayCallSoundIdOf(outcome, played),
            ]
          },
        )
      },
      finishRunnerPlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingRunnerPlay
        if (pending == null) return
        const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
        step(
          (current) => resolveRunnerPlay(current, played, random),
          // 판정 콜 — 도루 · 폭투는 공 도착 판(`lastArrivalPlay`), 견제는 그 결과. ⚠️ 원본은 공이 잡히는 틱에 낸다(판 끝 근사)
          (before, after) => [
            after.lastArrivalPlay !== null && after.lastArrivalPlay !== before.lastArrivalPlay
              ? after.lastArrivalPlay.callSoundId
              : null,
            pending.kind === 'pickoff' && isPickoffPlayResult(played) ? pickoffCallSoundIdOf(played) : null,
          ],
        )
      },
      pickoff: (key: string) =>
        step(
          // 견제 판은 붙들어 수비 화면이 실시간으로 돌린다(송구 키 +0x160) — 콜은 판이 끝나 결과를 먹일 때(`finishRunnerPlay`)
          (current) => pickoff(current, key, random, true),
          // 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
          // ⚠️ 원본은 공이 잡히는 **틱**에 낸다. 웹은 견제 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다
          // — 홈런 비행 재생과 같은 근사다
          (before, after) =>
            after.lastDefensePlay !== before.lastDefensePlay && isPickoffPlayResult(after.lastDefensePlay)
              ? [pickoffCallSoundIdOf(after.lastDefensePlay)]
              : [],
        ),
      confirmScene: () => step((current) => confirmScene(current, random)),
      returnToPitchSelection: () => step((current) => returnToPitchSelection(current, random)),
      giveUp: () => step((current) => giveUpPitching(current, random)),
      confirmManagerHook: () => step((current) => closeManagerHookWindow(current, random)),
      closeBurst: () => step((current) => closeBurstWindow(current)),
      finishBenchClearing: (reachedTargetTick: boolean) =>
        step((current) => resolveBenchClearing(current, { reachedTargetTick }, random)),
      enterSettlement: () => {
        const finished = progressRef.current
        if (!finished.game.isFinished) return
        // 무승부는 동점이면 측 0 을 이긴 칸으로 보는 0xb6a0c 그대로 — 사람이 선공이면 31, 후공이면 32
        playSoundIds(audio, [gameResultSoundIdOf(summaryOf(finished).result, finished.game.playerSide)])
      },
    }),
    [audio, random, step],
  )

  const summary = useMemo(
    () => (progress.game.isFinished ? summaryOf(progress) : null),
    [progress],
  )

  return { progress, canPitch: isPitchTurn(progress), summary, actions }
}

/** 화면이 쓰는 타입을 한 번 더 내보낸다 — 앱이 진행기 경로를 몰라도 되게 한다 */
export type { PitchInput, PitcherGameOptions, PitcherGameProgress, PitcherGameSummary }
