import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { mountOnce } from '@/shared/lib/strictMount/strictMount'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { autoRelayModeSlotOf, autoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  availablePinchHitters,
  availablePitchers,
  canOpenPinchHit,
  canOpenPitcherChange,
  isBatterTurn,
  isPitchTurn,
  resumeTeamGame,
  startTeamGame,
  stealableBases,
  summaryOf,
} from '@/features/play-team-game/model/teamGameFlow'
import type { StealBase, TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { useBatterActions } from './teamGame/batterActions'
import { usePlayEndActions } from './teamGame/playEndActions'
import { useSceneActions } from './teamGame/sceneActions'
import { useThrowPitchAction } from './teamGame/throwPitchAction'
import { playTeamStepSounds, type TeamActionContext, type TeamGameStep } from './teamGame/teamGameStep'
import type { TeamGameActions, TeamGameSession } from './teamGame/teamGameSession'

/**
 * 팀 경기 한 판을 들고 있는 상태 고리 (일반·시즌·대전 공용) — 화면이 부르는 손잡이 묶음은 `TeamGameSession`(`teamGame/teamGameSession`).
 * 손잡이는 갈래별로 `teamGame/` 아래에 있다 — 사람 타석(`batterActions`) · 사람 투구(`throwPitchAction`) · 실시간 판 끝(`playEndActions`) ·
 * 장면 흐름(`sceneActions`). 이 고리는 칸(진행 · 최신 ref · 0x12 진입 시계)과 걸음(`step`)만 든다.
 */
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
  // 맨 앞은 상태 7 **진입** 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — 모드를 안 가려 새 경기 · 이어하기 모두
  // 경기 장면 시작마다 한 번, 갱신 0x3e340 의 덱 1275 보다 먼저다 (`rollSceneLoadingTip`). 이 칸이 아래 진행 칸보다 먼저 선다
  // 두 초기화는 마운트에 한 번 — 개발 StrictMode 의 두 번째 그림이 난수를 더 굴리지 않게(`mountOnce`)
  const [loadingTip, setLoadingTip] = useState<string | null>(() =>
    mountOnce('teamGame.loadingTip', () => LOADING_TIPS[rollSceneLoadingTip(random)] ?? null),
  )
  const [progress, setProgress] = useState<TeamGameProgress>(() =>
    mountOnce('teamGame.progress', () => {
      // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 경기 장면은 배경음 없이 시작한다. 그리는 자리라
      // 자식 화면(자동진행 중계 0x21 의 33 · 인트로 61)의 효과보다 먼저다
      activeSound().stop()
      // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다 (이어하기도 장면을 새로 세운다)
      startPlayClock()
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
      return resumeTeamGame({ ...resumeFrom, options: { ...resumeFrom.options, liveAutoRelay: true } }, random, record.read().stopped[slot])
    }),
  )

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 소리를 내면
   * StrictMode 가 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()
  const isVibrationOnRef = useRef(isVibrationOn)
  useLayoutEffect(() => {
    isVibrationOnRef.current = isVibrationOn
  })

  /** 진행 한 걸음을 먹이고, 그 사이에 원본이 내는 소리를 울린다 (`playTeamStepSounds`) */
  const step = useMemo<TeamGameStep>(
    () => (next, soundsOf, timingOf) => {
      const current = progressRef.current
      const after = next(current)
      if (after === current) return current
      progressRef.current = after
      setProgress(after)
      playTeamStepSounds(audio, current, after, soundsOf, timingOf)
      return after
    },
    [audio],
  )

  /**
   * 붙든 우리 공(`pendingPitchArrival`)의 0x12 진입 틀 시계 — 경기 화면이 내려가면 거둔다(원본도 그 틀에 닿지 않는다). 장면 시계라 공용
   * 창이 서 있으면 함께 선다
   */
  const cancelResultEntryRef = useRef<(() => void) | null>(null)
  useEffect(
    () => () => {
      cancelResultEntryRef.current?.()
      cancelResultEntryRef.current = null
    },
    [],
  )

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148) — 적재 상태 8 끝(48b20)에서 0xc 로 오는 자리, 곧 로딩 판이 끝나는 자리다.
  // 인트로는 모드 1~4 만 선다 — 대전(8·9)은 0xc 를 안 지나 이 소리도 없다
  const finishLoading = useCallback(() => {
    setLoadingTip(null)
    if (hasGameIntro(options.mode)) playSoundIds(audio, [GAME_INTRO_SOUND])
  }, [audio, options.mode])

  const context: TeamActionContext = { random, audio, step, progressRef, setProgress, isVibrationOnRef, cancelResultEntryRef }
  const batterActions = useBatterActions(context)
  const throwPitch = useThrowPitchAction(context)
  const playEndActions = usePlayEndActions(context)
  const sceneActions = useSceneActions(context)
  const actions = useMemo(
    (): TeamGameActions => ({ ...batterActions, throwPitch, ...playEndActions, ...sceneActions }),
    [batterActions, throwPitch, playEndActions, sceneActions],
  )

  const summary = useMemo(() => (progress.game.isFinished ? summaryOf(progress) : null), [progress])

  return {
    progress,
    loadingTip,
    finishLoading,
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

export type { StealBase, TeamGameOptions, TeamGameProgress, TeamGameSession }
