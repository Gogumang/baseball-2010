import { useEffect, useMemo, useRef, useState } from 'react'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { autoRelayModeSlotOf, autoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  availablePinchHitters,
  availablePitchers,
  canOpenPinchHit,
  canOpenPitcherChange,
  changePitcher,
  closeBurstWindow,
  cpuPickoff,
  isBatterTurn,
  isPitchTurn,
  pickoff,
  pinchHit,
  cancelSubstitution,
  confirmScene,
  returnToPitchSelection,
  resolveBenchClearing,
  resolveDefensePlay,
  resolveRunnerPlay,
  resumeTeamGame,
  runAutoProgress,
  stepAutoRelay,
  stopAutoRelay,
  spendOurSpecialSwing,
  startBatterOutcome,
  startBatterPitch,
  startTeamGame,
  startThrowPitch,
  stealableBases,
  startSteal,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  PendingDefensePlay,
  StealBase,
  TeamAutoRelay,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
} from '@/features/play-team-game/model/teamGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isPickoffPlayResult, pickoffCallSoundIdOf } from '@/features/defense-play/model/pickoffPlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  deepHitCheerSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  walkCheerSoundIdOf,
} from '@/features/play-at-bat/model/atBatSounds'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { GAME_INTRO_SOUND, gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
import {
  pinchHitSoundIdsOf,
  scenePitcherChangeSoundIdsOf,
  stepSoundIdsOf,
} from '@/pages/team-game/model/teamGameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'

/**
 * 팀 경기 한 판을 들고 있는 상태 고리 (일반·시즌·대전 공용).
 *
 * 진행 규칙은 전부 `features/play-team-game` 에 있고, 여기서는 화면이 부르는 손잡이만 묶는다.
 * 앱이 진행 상태를 직접 들고 싶으면 이 고리를 쓰지 말고 진행기 함수를 그대로 불러도 된다
 * (시즌 세션이 그렇게 쓴다 — `TeamGameScreen` 주석 참고).
 */
export interface TeamGameSession {
  readonly progress: TeamGameProgress
  /** 사람이 칠 차례인가 */
  readonly canBat: boolean
  /** 사람이 던질 차례인가 */
  readonly canPitch: boolean
  /** 경기가 끝났으면 요약, 아니면 null */
  readonly summary: TeamGameSummary | null
  /** `#` 로 투수 교체 화면(상태 0xb)을 열 수 있는가 — 벤치 투수가 있고 투구 전일 때만 */
  readonly canChangePitcher: boolean
  /** 지금 벤치에서 올릴 수 있는 우리 투수 칸 */
  readonly benchPitchers: readonly number[]
  /** `#` 로 대타 화면(상태 0xb)을 열 수 있는가 — 우리 공격 차례이고 벤치 타자가 있을 때 */
  readonly canPinchHit: boolean
  /** 지금 대타로 낼 수 있는 우리 명단 칸 (9번부터가 벤치다) */
  readonly benchBatters: readonly number[]
  /** 지금 도루를 출발시킬 수 있는 루 ('3' 1루 · '2' 2루 · '1' 3루) */
  readonly stealableBases: readonly StealBase[]
  /**
   * **지금 실시간으로 돌려야 하는 타구** (원본 경기 상태 0x17). 차 있으면 화면은 타석·투구 대신
   * 수비 화면을 그리고, 다 돌면 `actions.finishDefensePlay` 로 결과를 넘긴다.
   * 이 칸이 차 있는 동안 `canBat`·`canPitch` 는 둘 다 거짓이라 다음 투구가 나가지 않는다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly actions: {
    /**
     * 타석 화면이 판정한 공 하나. `isUncatchable` 은 필살타법이 성공한 타구(0x517e6 → 0x51800)인가 —
     * 수비 화면의 야수가 쥐지 못한다.
     */
    readonly resolvePitch: (detail: PitchOutcomeDetail, isUncatchable?: boolean, buntKind?: number) => void
    /**
     * 사람 타석의 필살 스윙이 나갔다 (0x4e136) — `BattingStage` 의 `onSpecialSwingUsed` 를 그대로 잇는다.
     * 인자는 줄인 뒤 남은 횟수다.
     */
    readonly specialSwingUsed: (remaining: number) => void
    /** 타석 결과를 통째로 (자동 소화·테스트용) */
    readonly applyOutcome: (outcome: AtBatOutcome) => void
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: TeamPitchInput) => void
    /**
     * 구질 고르기(상태 0xf)에서 눌린 키 — '3'/'1'/'7' 이고 그 루에 주자가 있으면 견제 한 판을 돌린다
     * (0x53548 → 0x50f28). 아니면 아무 일도 없다.
     */
    readonly pickoff: (key: string) => void
    /**
     * CPU 투수가 견제를 걸었다 (0x34848 이 고른 루로 메시지 0x10). 사람이 칠 차례에만 먹는다.
     * 타석 화면(`widgets/batting-stage`)이 CPU 투구를 고르며 견제를 뽑으면 `onPickoff` 로 알려 주고
     * `TeamGameScreen` 이 여기로 넘긴다.
     */
    readonly cpuPickoff: (base: PickoffBase) => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /** `#` 교체 화면에서 벤치 투수 칸을 고른다 (R4 1a·1c) */
    readonly changePitcher: (benchIndex: number) => void
    /** `#` 대타 화면에서 벤치 타자 칸을 고른다 (0xaf06c → 0xaebe4) */
    readonly pinchHit: (benchIndex: number) => void
    /** 상태 0xe 의 OK — 그 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)을 돌린다 (`confirmScene`) */
    readonly confirmScene: () => void
    /** `#` 교체 화면을 '#'·CLR 로 닫는다 — 상태 0xe 로 (0x495fc) */
    readonly cancelSubstitution: () => void
    /** 투구 코스 단계에서 CLR — 구질 고르기(상태 0xf)로 되돌린다 (0x50ee6) */
    readonly returnToPitchSelection: () => void
    /** 도루 출발 (메시지 0x583 → 0xa9bd4) — 대상 주자가 선 루. 판정은 공이 도착할 때 도루 판이 한다 */
    readonly steal: (base: StealBase) => void
    /** 경기 중 메뉴 '*' 의 자동진행 — **비용 검사는 화면이 먼저 한다** */
    readonly autoProgress: () => void
    /**
     * 자동진행 중계(상태 0x21) 갱신 한 번 — 0xc2198 → 0xc262c (`stepAutoRelay`). 굴린 걸음의 중계 칸을 돌려준다 —
     * null 이면 0xc2198 이 거짓이라 중계가 끝났다(+0x1784 = 0, 상태 0x18).
     */
    readonly stepAutoRelay: () => TeamAutoRelay | null
    /** CLR 중단 질문(StrGAME[6])에 예 — sim+0xa0 = 0 · sim+0x9f = 1 (`stopAutoRelay`) */
    readonly stopAutoRelay: () => void
    /**
     * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
     * **여기서야** 진루·아웃·득점이 경기 상태가 된다.
     *
     * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
     * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
     */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
    /**
     * 수비 화면이 사람 수비의 주자 판(도루 · 폭투 · 견제 — `progress.pendingRunnerPlay`)을 다 돌렸다. 결과를 못 받았으면
     * 키 없이 끝까지 돌려서라도 붙든 상태를 푼다.
     */
    readonly finishRunnerPlay: (result?: DefensePlayResult) => void
    /**
     * 벤치 클리어링 연출(상태 0x1e)이 끝났다 (`BenchClearingScene` 의 `onDone`) — 출구 0xae24c 뒤 사구를 먹인다.
     * `reachedTargetTick` 이면 틱 10 의 굴림 8 번을 진행기가 먼저 낸다.
     */
    readonly finishBenchClearing: (reachedTargetTick: boolean) => void
    /**
     * 경기 끝 결과 판(상태 0x18)에서 OK — 정산(0x19)으로 넘어간다. 승리 31 · 패배 32 징글은 경기가 끝나는 자리가
     * 아니라 **0x19 진입(결과 적재 0x4ea0c)** 이 내므로 이 자리에서 낸다 (투수편 c016ab0 과 같은 자리).
     */
    readonly enterSettlement: () => void
  }
}

export function useTeamGame(
  options: TeamGameOptions,
  random: RandomPort,
  /** 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 없으면 켬 (`BattingStage` 와 같다) */
  isVibrationOn?: boolean,
  /**
   * **이어하기** — 저장된 진행(`halfInningSave`)이 있으면 새로 세우지 않고 그 자리에서 다시 세운다
   * (0x213c0(앱, 1, 0) → 장면 0x104, `resumeTeamGame`). 없으면 새 경기다.
   */
  resumeFrom?: TeamGameProgress,
): TeamGameSession {
  const [progress, setProgress] = useState<TeamGameProgress>(() => {
    // 맨 앞은 상태 7 **진입** 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — 모드를 안 가려 새 경기 · 이어하기 모두
    // 경기 장면 시작마다 한 번, 갱신 0x3e340 의 덱 1275 보다 먼저다 (`rollSceneLoadingTip`). 웹 팀경기는 팁 판을 안 그려 값은 버린다
    rollSceneLoadingTip(random)
    // 자동진행 중계(0x21)는 화면이 한 틱씩 돌린다 — 그 사이 CLR 중단 · 속도 키를 받는다
    const live: TeamGameOptions = { ...options, liveAutoRelay: true }
    const record = autoRelayRecordPort()
    const slot = autoRelayModeSlotOf(options.mode)
    if (resumeFrom === undefined) {
      // 새 경기 — 경기를 여는 키(일반 · 대전 경기정보 OK +0x14d · +0x14f, 시즌 0x847e +0x14e)가 그 모드 칸을 0 으로 쓴 뒤
      // 장면 초기화 0xc0e60 이 그 0 을 sim+0x9f 로 읽는다
      record.setStopped(slot, false)
      return startTeamGame(live, random)
    }
    // 이어하기 — 0xc0e60 이 전역기록 +0x14d + m 에서 sim+0x9f 를 되살린다
    return resumeTeamGame({ ...resumeFrom, options: { ...resumeFrom.options, liveAutoRelay: true } }, random,
      record.read().stopped[slot])
  })

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 소리를 내면
   * StrictMode 가 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()
  const isVibrationOnRef = useRef(isVibrationOn)
  isVibrationOnRef.current = isVibrationOn

  /** 진행 한 걸음을 먹이고, 그 사이에 원본이 내는 소리를 울린다 */
  const step = useMemo(() => {
    return (
      next: (current: TeamGameProgress) => TeamGameProgress,
      soundsOf?: (before: TeamGameProgress, after: TeamGameProgress) => readonly (number | null)[],
    ) => {
      const current = progressRef.current
      const after = next(current)
      if (after === current) return current
      progressRef.current = after
      setProgress(after)
      playSoundIds(audio, [
        ...(soundsOf === undefined ? [] : soundsOf(current, after)),
        ...stepSoundIdsOf(current, after),
        // 대타 교체 연출(상태 0x16)을 지났으면 — CPU 대타는 다음 타석 준비(0xf 진입)에서 서므로 걸음 끝에 둔다
        ...pinchHitSoundIdsOf(current, after),
        // 사람 장면 CPU 투수 교체(0x3d954 → 0xac428)도 같은 0x16 연출 — 22 뒤 올라온 투수 등판음
        ...scenePitcherChangeSoundIdsOf(current, after),
      ])
      return after
    }
  }, [audio])

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148) — 화면(`TeamGameScreen` 의 `GameIntro`)이 서는 자리다.
  // 인트로는 모드 1~4 만 선다(적재 상태 8 끝 0x48b20) — 대전(8·9)은 0xc 를 안 지나 이 소리도 없다
  useEffect(() => {
    if (hasGameIntro(options.mode)) playSoundIds(audio, [GAME_INTRO_SOUND])
    // 경기 한 판에 한 번 — 고리가 살아 있는 동안 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo(
    () => ({
      // 인플레이 타구가 나오면 **여기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다 (상태 0x17)
      resolvePitch: (detail: PitchOutcomeDetail, isUncatchable?: boolean, buntKind?: number) =>
        step(
          // 판정 11(2스트라이크 번트 파울)은 파울 각 공 판이 판 끝 결과 코드 11 로 낸다(콜 62 는 판 결과 `played.buntFoulOut`).
          // 번트 종류(장면 +0xfdc)는 타구 판 리드(0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더하는 데 쓴다
          (current) =>
            startBatterPitch(current, detail, random, {
              isUncatchable: isUncatchable === true,
              buntKind: buntKind ?? 0,
            }),
          // 타구음(0x515de~) → 심판 콜(0x51a94) 순서. 통로가 하나라 뒤 소리가 앞 소리를 끊는다.
          // 인플레이 타구면 아웃 콜은 여기서 안 난다 — 수비 화면이 끝난 뒤(`finishDefensePlay`)다
          (before, after) => {
            // 진행기가 타석이 끝나면 볼카운트를 바로 새 타석으로 되돌리므로(`finishBatterOutcome`),
            // 심판 콜이 보는 "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
            const nextAtBat = applyPitchResolution(before.atBat, detail.resolution)
            return [
              detail.contactSoundId ?? null,
              pitchCallSoundIdOf(detail.resolution, nextAtBat),
              // 공 도착 0x3dfac 가 연 도루·폭투 판의 판정 콜(도루 17 · 62/20, 폭투 17) — 원본은 판 안의 그 틱에 낸다.
              // 웹은 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다 (견제와 같은 근사)
              arrivalCallSoundIdOf(before, after),
              after.pendingDefensePlay !== null || nextAtBat.outcome === null
                ? null
                : inPlayCallSoundIdOf(nextAtBat.outcome),
            ]
          },
        ),
      applyOutcome: (outcome: AtBatOutcome) =>
        step(
          (current) => startBatterOutcome(current, outcome, random),
          (_before, after) => (after.pendingDefensePlay !== null ? [] : [inPlayCallSoundIdOf(outcome)]),
        ),
      throwPitch: (input: TeamPitchInput) =>
        step(
          (current) => startThrowPitch(current, input, random),
          // 투구 순간 소리 12 / 마구 28 (0x3f378) — 구질 22, 또는 마투수(rec+0xa 비트6)의 공+0x10 ≠ 0.
          // 공+0x10 은 안 지워져(H2 3-4) 마투수는 첫 마구 뒤로 모든 공이 28 이다 (원본 그대로).
          // ⚠️ **근사**: 웹은 던지는 순간에 판정까지 다 나와 투구음과 심판 콜이 붙는다 (통로가 하나라
          //    뒤 소리가 앞 소리를 끊는다). 원본은 공이 날아가는 동안이 사이에 있다
          (before, after) => {
            const releaseSound = pitchReleaseSoundIdOf({
              typeNumber: input.typeNumber,
              pitcherMagicNumber: after.lastPitch?.pitcherMagicNumber ?? 0,
              ballMagicNumber: after.lastPitch?.magicNumber ?? 0,
            })
            const resolution = after.lastResolution
            if (resolution === null) return [releaseSound]
            // 삼진 진동 100ms — 사람이 던진 공도 상태 0x12 그리기 0x4ce9c 를 지난다 (0x4d0d6, `strikeoutVibration`).
            // 우리 공격 반쪽의 삼진은 `BattingStage` 가 울린다
            vibrate(strikeoutVibrationMillisecondsOf(resolution, before.atBat.strikes), isVibrationOnRef.current !== false)
            const nextAtBat = applyPitchResolution(before.atBat, resolution)
            return [
              releaseSound,
              pitchCallSoundIdOf(resolution, nextAtBat),
              // CPU 가 건 도루·폭투 판의 판정 콜 — 판을 연 자리에서 낸다 (견제와 같은 근사)
              arrivalCallSoundIdOf(before, after),
              // 볼넷 뒤 관중 함성 29 (0x51afa~0x51b02) — 원본은 **공격 팀이 CPU 조작**
              // (`state[0x31 + state[9]] == 1`, 0x51adc~0x51af8) 일 때만 예약한다.
              // 이 자리는 사람이 던지는 타석이라 **타석에 선 쪽이 언제나 상대(CPU) 팀**이다.
              // 우리 공격 반쪽에서는 공격이 사람이라 원본에서도 안 난다 — 그래서 여기에만 있다.
              walkCheerSoundIdOf(nextAtBat.outcome, true),
              after.pendingDefensePlay !== null || nextAtBat.outcome === null
                ? null
                : inPlayCallSoundIdOf(nextAtBat.outcome),
            ]
          },
        ),
      // 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
      // ⚠️ 원본은 공이 잡히는 **틱**에 낸다. 웹은 견제 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다
      // — 투수편(`usePitcherGame.pickoff`)과 같은 근사다
      // 사람 견제는 판을 붙들고 수비 화면이 실시간으로 돌린다(송구 키 +0x160) — 콜은 판이 끝나 결과를 먹일 때 낸다
      pickoff: (key: string) => step((current) => pickoff(current, key, random, true), pickoffCallSoundsOf),
      cpuPickoff: (base: PickoffBase) =>
        step((current) => cpuPickoff(current, base, random), pickoffCallSoundsOf),
      closeBurst: () => step((current) => closeBurstWindow(current)),
      specialSwingUsed: (remaining: number) => step((current) => spendOurSpecialSwing(current, remaining)),
      // 교체 연출(상태 0x16)을 지나 상태 0xe 로 오면 등판음이 예약된다 (0x38b64 → 0x38c34) — 화면이 "CHANGE" 애니를 다 그린 뒤
      // `substitutionScene.entrySoundId`(마투수 26 · 2·3루 주자 15 · 그 밖 14)로 낸다 (`useSubstitutionScene`)
      changePitcher: (benchIndex: number) => step((current) => changePitcher(current, benchIndex)),
      pinchHit: (benchIndex: number) => step((current) => pinchHit(current, benchIndex)),
      // 0xe 의 OK → 메시지 1(돌발 0x8f158) → 0xf 진입 0x3d954 (CPU 교체면 22 → 0x16 → 0xe 등판음 — `step` 이 낸다)
      confirmScene: () => step((current) => confirmScene(current, random)),
      // 교체 창 취소('#'·CLR → 상태 0xe) — 다시 선 0xe 의 OK 뒤에 돌발 굴림과 0xf 진입 0x3d954 가 돈다
      cancelSubstitution: () => step((current) => cancelSubstitution(current)),
      // 코스 고르기(0x10)의 CLR → 0xf (0x50ee6) — 0xf 진입 0x3d954 가 다시 돈다
      returnToPitchSelection: () => step((current) => returnToPitchSelection(current, random)),
      // 도루 출발 — 주자를 출발만 시킨다(난수·소리 없음). 판정은 공이 도착할 때 도루 판(종류 5)이 한다
      steal: (base: StealBase) => step((current) => startSteal(current, base)),
      autoProgress: () => {
        // 3c94a 0xc0ea8(sim, 0) — sim+0x9f = 0 을 전역기록 +0x14d + m 에도 쓴다
        const after = step((current) => runAutoProgress(current, random))
        if (after.autoProgressFlag === 'running') autoRelayRecordPort().setStopped(autoRelayModeSlotOf(after.options.mode), false)
      },
      stepAutoRelay: () => step((current) => stepAutoRelay(current, random)).autoRelay ?? null,
      stopAutoRelay: () => {
        // 52cac 0xc0ea8(sim, 1) — sim+0x9f = 1 을 전역기록 +0x14d + m 에도 쓴다
        const after = step((current) => stopAutoRelay(current))
        if (after.autoProgressFlag === 'stopped') autoRelayRecordPort().setStopped(autoRelayModeSlotOf(after.options.mode), true)
      },
      finishBenchClearing: (reachedTargetTick: boolean) =>
        step((current) => resolveBenchClearing(current, { reachedTargetTick }, random)),
      finishRunnerPlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingRunnerPlay
        if (pending == null) return
        const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
        step(
          (current) => resolveRunnerPlay(current, played, random),
          // 판정 콜 — 도루 · 폭투는 공 도착 판(`lastArrivalPlay`), 견제는 그 결과. ⚠️ 원본은 공이 잡히는 틱에 낸다(판 끝 근사)
          (before, after) => [
            arrivalCallSoundIdOf(before, after),
            pending.kind === 'pickoff' && isPickoffPlayResult(played) ? pickoffCallSoundIdOf(played) : null,
          ],
        )
      },
      finishDefensePlay: (result?: DefensePlayResult) => {
        const pending = progressRef.current.pendingDefensePlay
        if (pending === null) return
        // 결과를 못 받았으면 남은 틱을 여기서 끝까지 돌린다 — 붙든 상태는 반드시 푼다
        const played = result ?? runDefensePlay(pending.input)
        step(
          (current) => resolveDefensePlay(current, played, random),
          // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·세이프 콜(0x51c14)·홈런 함성(11)은 여기서야 난다.
          // **수비 결과를 함께 넘겨야** 원본이 보는 칸(state[0x1f])과 세이프 갈래가 열린다
          // (`atBatSounds.inPlayCallSoundIdOf` 둘째 인자). 함성 60 은 원본이 **낙구 틱**에
          // 내는 것이라 이 자리는 근사다 — 타자편(`useCareerSession`)과 같은 근사·같은 순서다
          () => [
            deepHitCheerSoundIdOf({
              outcome: pending.outcome,
              carryDistance: carryDistanceOf(pending.input.trajectory),
              caughtOnTheFly: played.caughtOnTheFly,
              // 파울로 닫힌 판에는 60 이 없다 — 콜은 결과 코드 7 메시지 51c5c 의 25 하나(`inPlayCallSoundIdOf` 의 `foulEnded`)
              foulEnded: played.foulEnded,
            }),
            // 판정 11(2스트라이크 번트 파울) — 판 끝 결과 코드가 낸다(`played.buntFoulOut`). 아웃 콜은 조건 없이 62 (0x51b20)
            inPlayCallSoundIdOf(pending.outcome, played),
          ],
        )
      },
      enterSettlement: () => {
        const finished = progressRef.current
        if (!finished.game.isFinished) return
        // 무승부는 원본이 어느 쪽을 내는지 문서에 없어 `gameResultSoundIdOf` 가 비워 둔다
        playSoundIds(audio, [gameResultSoundIdOf(summaryOf(finished).result)])
      },
    }),
    [audio, random, step],
  )

  const summary = useMemo(
    () => (progress.game.isFinished ? summaryOf(progress) : null),
    [progress],
  )

  return {
    progress,
    canBat: isBatterTurn(progress),
    canPitch: isPitchTurn(progress),
    summary,
    canChangePitcher: canOpenPitcherChange(progress),
    benchPitchers: availablePitchers(progress),
    canPinchHit: canOpenPinchHit(progress),
    benchBatters: availablePinchHitters(progress),
    stealableBases: stealableBases(progress),
    pendingDefensePlay: progress.pendingDefensePlay,
    actions,
  }
}

/** 이번 걸음에 공 도착 판(0x3dfac — 종류 9·5)이 새로 열렸으면 그 판정 콜 */
function arrivalCallSoundIdOf(before: TeamGameProgress, after: TeamGameProgress): number | null {
  const play = after.lastArrivalPlay
  return play !== null && play !== before.lastArrivalPlay ? play.callSoundId : null
}

/** 견제 판이 새로 열렸으면 그 판정 콜 하나 */
function pickoffCallSoundsOf(before: TeamGameProgress, after: TeamGameProgress): readonly (number | null)[] {
  return after.lastDefensePlay !== before.lastDefensePlay && isPickoffPlayResult(after.lastDefensePlay)
    ? [pickoffCallSoundIdOf(after.lastDefensePlay)]
    : []
}

export type {
  PendingDefensePlay,
  StealBase,
  TeamAutoRelay,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
}
