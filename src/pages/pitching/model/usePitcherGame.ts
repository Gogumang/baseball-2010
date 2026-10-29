import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mountOnce } from '@/shared/lib/strictMount/strictMount'
import { startPlayClock } from '@/entities/collection/model/playClock'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPitchTurn, startPitcherGame, summaryOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { GAME_INTRO_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { usePlayEndActions } from './pitcherGame/playEndActions'
import { useSceneActions } from './pitcherGame/sceneActions'
import { useThrowPitchAction } from './pitcherGame/throwPitchAction'
import { playPitcherStepSounds, type PitcherActionContext, type PitcherGameStep } from './pitcherGame/pitcherGameStep'
import type { PitcherGameActions, PitcherGameSession } from './pitcherGame/pitcherGameSession'

/**
 * 투수편 경기 한 판을 들고 있는 상태 고리 — 화면이 부르는 손잡이 묶음은 `PitcherGameSession`(`pitcherGame/pitcherGameSession`).
 * 손잡이는 갈래별로 `pitcherGame/` 아래에 있다 — 공 던지기(`throwPitchAction`) · 실시간 판 끝(`playEndActions`) · 장면 흐름(`sceneActions`).
 * 이 고리는 칸(진행 · 최신 ref · 0x12 진입 시계)과 걸음(`step`)만 든다. 진행 규칙은 전부 `features/play-pitcher-game` 에 있다.
 */
export function usePitcherGame(
  options: PitcherGameOptions,
  random: RandomPort,
  /** 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 없으면 켬 (`BattingStage` 와 같다) */
  isVibrationOn?: boolean,
): PitcherGameSession {
  // 맨 앞은 상태 7 **진입** 0x39f88 → 0x53dbc 의 로딩 팁 rand(0, 73) — 갱신 0x3e340 의 덱 1275 보다 먼저 (`rollSceneLoadingTip`).
  // 이 칸이 아래 진행 칸보다 먼저 선다
  // 두 초기화는 마운트에 한 번 — 개발 StrictMode 의 두 번째 그림이 난수를 더 굴리지 않게(`mountOnce`)
  const [loadingTip, setLoadingTip] = useState<string | null>(() =>
    mountOnce('pitcherGame.loadingTip', () => LOADING_TIPS[rollSceneLoadingTip(random)] ?? null),
  )
  const [progress, setProgress] = useState<PitcherGameProgress>(() =>
    mountOnce('pitcherGame.progress', () => {
      // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 경기 장면은 배경음 없이 시작한다 (인트로 61 효과보다 먼저)
      activeSound().stop()
      // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다 (이어하기도 장면을 새로 세운다)
      startPlayClock()
      return startPitcherGame(options, random)
    }),
  )

  /**
   * 최신 진행 상태. 소리는 **업데이터 밖에서** 골라야 한다 — 업데이터 안에서 내면 StrictMode 가
   * 업데이터를 두 번 돌리며 같은 소리를 두 번 낸다 (`useAtBatRunner` 주석과 같은 까닭).
   */
  const progressRef = useRef(progress)
  const audio = activeSound()
  const isVibrationOnRef = useRef(isVibrationOn)
  useLayoutEffect(() => {
    isVibrationOnRef.current = isVibrationOn
  })

  /** 진행 한 걸음을 먹이고, 그 사이에 원본이 내는 소리를 울린다 (`playPitcherStepSounds` — 팀경기 고리와 같은 모양) */
  const step = useMemo<PitcherGameStep>(
    () => (next, soundsOf, timingOf) => {
      const current = progressRef.current
      const after = next(current)
      if (after === current) return current
      progressRef.current = after
      setProgress(after)
      playPitcherStepSounds(audio, current, after, soundsOf, timingOf)
      return after
    },
    [audio],
  )

  /**
   * 붙든 공(`pendingPitchArrival`)의 0x12 진입 틀 시계 — 경기 화면이 내려가면 거둔다(원본도 그 틀에 닿지 않는다). 장면 시계라 공용 창이
   * 서 있으면 함께 선다
   */
  const cancelResultEntryRef = useRef<(() => void) | null>(null)
  useEffect(
    () => () => {
      cancelResultEntryRef.current?.()
      cancelResultEntryRef.current = null
    },
    [],
  )

  // 경기 시작 인트로 예약음 61 (상태 0xc 진입 0x3b148) — 모드 3 은 적재 상태 8 끝(48b20)에서 0xc 로 오므로 로딩 판이 끝나는 자리다
  const finishLoading = useCallback(() => {
    setLoadingTip(null)
    playSoundIds(audio, [GAME_INTRO_SOUND])
  }, [audio])

  const context: PitcherActionContext = { random, audio, step, progressRef, setProgress, isVibrationOnRef, cancelResultEntryRef }
  const throwPitch = useThrowPitchAction(context)
  const playEndActions = usePlayEndActions(context)
  const sceneActions = useSceneActions(context)
  const actions = useMemo((): PitcherGameActions => ({ throwPitch, ...playEndActions, ...sceneActions }), [throwPitch, playEndActions, sceneActions])

  const summary = useMemo(() => (progress.game.isFinished ? summaryOf(progress) : null), [progress])

  return { progress, loadingTip, finishLoading, canPitch: isPitchTurn(progress), summary, actions }
}

/** 화면이 쓰는 타입을 한 번 더 내보낸다 — 앱이 진행기 경로를 몰라도 되게 한다 */
export type { PitcherGameOptions, PitcherGameSession }
