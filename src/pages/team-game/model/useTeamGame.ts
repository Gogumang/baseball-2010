import { useEffect, useMemo, useRef, useState } from 'react'
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
  isBatterTurn,
  isPitchTurn,
  pinchHit,
  resolveDefensePlay,
  runAutoProgress,
  startBatterOutcome,
  startBatterPitch,
  startTeamGame,
  startThrowPitch,
  stealableBases,
  stealBase,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import type {
  PendingDefensePlay,
  StealBase,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
} from '@/features/play-team-game/model/teamGameFlow'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import {
  deepHitCheerSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  walkCheerSoundIdOf,
  PITCH_RELEASE_SOUND,
} from '@/features/play-at-bat/model/atBatSounds'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { GAME_INTRO_SOUND, gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
import { pitcherEntrySoundIdOf, stepSoundIdsOf } from '@/pages/team-game/model/teamGameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'

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
  /** 지금 도루를 걸 수 있는 루 ('3' 1루 · '2' 2루) */
  readonly stealableBases: readonly StealBase[]
  /**
   * **지금 실시간으로 돌려야 하는 타구** (원본 경기 상태 0x17). 차 있으면 화면은 타석·투구 대신
   * 수비 화면을 그리고, 다 돌면 `actions.finishDefensePlay` 로 결과를 넘긴다.
   * 이 칸이 차 있는 동안 `canBat`·`canPitch` 는 둘 다 거짓이라 다음 투구가 나가지 않는다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly actions: {
    /** 타석 화면이 판정한 공 하나 */
    readonly resolvePitch: (detail: PitchOutcomeDetail) => void
    /** 타석 결과를 통째로 (자동 소화·테스트용) */
    readonly applyOutcome: (outcome: AtBatOutcome) => void
    /** 구질·코스·게이지 칸을 정해 한 개 던진다 */
    readonly throwPitch: (input: TeamPitchInput) => void
    /** 돌발 창 닫기 */
    readonly closeBurst: () => void
    /** `#` 교체 화면에서 벤치 투수 칸을 고른다 (R4 1a·1c) */
    readonly changePitcher: (benchIndex: number) => void
    /** `#` 대타 화면에서 벤치 타자 칸을 고른다 (0xaf06c → 0xaebe4) */
    readonly pinchHit: (benchIndex: number) => void
    /** 도루 (메시지 0x583) — 대상 주자가 선 루 */
    readonly steal: (base: StealBase) => void
    /** 경기 중 메뉴 '*' 의 자동진행 — **비용 검사는 화면이 먼저 한다** */
    readonly autoProgress: () => void
    /**
     * 수비 화면이 한 타구를 다 돌렸다 (`DefensePlayback` 의 `onDone`).
     * **여기서야** 진루·아웃·득점이 경기 상태가 된다.
     *
     * 화면이 결과를 안 넘겨 주는 경우(재생 갈래로 잘못 들어간 때)는 여기서 끝까지 돌려서라도
     * 붙들어 둔 상태를 푼다 — 안 그러면 다음 타석이 영영 시작되지 않는다.
     */
    readonly finishDefensePlay: (result?: DefensePlayResult) => void
  }
}

export function useTeamGame(options: TeamGameOptions, random: RandomPort): TeamGameSession {
  const [progress, setProgress] = useState<TeamGameProgress>(() => startTeamGame(options, random))

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 소리를 내면
   * StrictMode 가 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()

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
        // 경기 결과 징글 31/32 — 상태 0x19(결과 적재 0x4ea0c)에서 난다.
        // 무승부는 원본이 어느 쪽을 내는지 문서에 없어 `gameResultSoundIdOf` 가 비워 둔다
        ...(after.game.isFinished && !current.game.isFinished
          ? [gameResultSoundIdOf(summaryOf(after).result)]
          : []),
      ])
      return after
    }
  }, [audio])

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148).
  // ⚠️ 웹에는 인트로 화면(270→0 을 5씩 54틱)이 없어 **경기가 서는 자리**에 둔다 — 근사다
  useEffect(() => {
    playSoundIds(audio, [GAME_INTRO_SOUND])
    // 경기 한 판에 한 번 — 고리가 살아 있는 동안 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo(
    () => ({
      // 인플레이 타구가 나오면 **여기서 멈춘다** — 주자 처리는 수비 화면이 끝난 뒤다 (상태 0x17)
      resolvePitch: (detail: PitchOutcomeDetail) =>
        step(
          // 판정 11(2스트라이크 번트 파울 아웃)이면 아웃 콜이 조건 없이 62 다 — 플레이 끝까지 간다
          (current) =>
            startBatterPitch(current, detail, random, { buntFoulOut: detail.isBuntFoulOut }),
          // 타구음(0x515de~) → 심판 콜(0x51a94) 순서. 통로가 하나라 뒤 소리가 앞 소리를 끊는다.
          // 인플레이 타구면 아웃 콜은 여기서 안 난다 — 수비 화면이 끝난 뒤(`finishDefensePlay`)다
          (before, after) => {
            // 진행기가 타석이 끝나면 볼카운트를 바로 새 타석으로 되돌리므로(`finishBatterOutcome`),
            // 심판 콜이 보는 "이 공을 먹인 뒤" 의 카운트는 여기서 따로 만든다
            const nextAtBat = applyPitchResolution(before.atBat, detail.resolution)
            return [
              detail.contactSoundId ?? null,
              pitchCallSoundIdOf(detail.resolution, nextAtBat),
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
          // 투구 순간 소리 12 (0x3f378). ⚠️ 마구 갈래 28 은 안 이었다 — 이 자리가 마구인지 못 가른다.
          // ⚠️ **근사**: 웹은 던지는 순간에 판정까지 다 나와 투구음과 심판 콜이 붙는다 (통로가 하나라
          //    뒤 소리가 앞 소리를 끊는다). 원본은 공이 날아가는 동안이 사이에 있다
          (before, after) => {
            const resolution = after.lastResolution
            if (resolution === null) return [PITCH_RELEASE_SOUND]
            const nextAtBat = applyPitchResolution(before.atBat, resolution)
            return [
              PITCH_RELEASE_SOUND,
              pitchCallSoundIdOf(resolution, nextAtBat),
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
      closeBurst: () => step((current) => closeBurstWindow(current)),
      changePitcher: (benchIndex: number) =>
        step(
          (current) => changePitcher(current, benchIndex),
          // 교체 연출(상태 0x16)을 지나 상태 0xe 로 오면 등판음이 예약된다 (0x38b64 → 0x38c34).
          // 올라온 투수가 마투수면 26, 2·3루에 주자가 있으면 15, 그 밖은 14 다
          (_before, after) => [
            pitcherEntrySoundIdOf({
              isAce: (after.ourPitcherEntry[after.ourPitcherIndex]?.aceIndex ?? -1) >= 0,
              bases: after.game.bases,
            }),
          ],
        ),
      pinchHit: (benchIndex: number) => step((current) => pinchHit(current, benchIndex)),
      // 도루 실패로 이닝이 끝나면 공수 교대 징글이 난다. 세이프 콜(17)은 잇지 않았다 —
      // 원본 판정 v9 가 어떤 플레이에서 나는지 미해결이다
      steal: (base: StealBase) => step((current) => stealBase(current, base, random)),
      autoProgress: () => step((current) => runAutoProgress(current, random)),
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
            }),
            inPlayCallSoundIdOf(pending.outcome, {
              ...played,
              // 진행기 입력에 실어 온 판정 11 표 — 아웃 콜을 조건 없이 62 로 만든다
              buntFoulOut: pending.input.buntFoulOut,
            }),
          ],
        )
      },
    }),
    [random, step],
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

export type {
  PendingDefensePlay,
  StealBase,
  TeamGameOptions,
  TeamGameProgress,
  TeamGameSummary,
  TeamPitchInput,
}
