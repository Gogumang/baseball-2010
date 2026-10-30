import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { DERBY_HOME_RUN_SOUND, skipDerbyBattedBall, type DerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { FOUL_CALL_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { playSoundIds, type SoundPort } from '@/shared/api/audio/soundPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { derbyFieldTimelineOf } from '@/pages/home-run-derby/lib/derbyField'
import { HOME_RUN_TEXT_SCENE_START, type HomeRunTextState, type HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import {
  clearGameSceneTimeout,
  gameSceneNow,
  gameSceneTickNow,
  gameSceneTickOf,
  gameSceneTickStartTime,
  setGameSceneTimeout,
} from '@/shared/lib/commonWindow/commonWindow'
import { derbyHomeRunTextOf, type DerbyDistanceBoard, type DerbyFieldPlay } from './derbyPlayView'

/** 지금 도는 판 — 키 건너뛰기가 다시 셈하는 재료 */
export interface DerbyPlay {
  /** 판을 넘겨받은 시각(공 틱 0) */
  readonly startedAt: number
  readonly batted: DerbyBattedBall
  readonly runBefore: DerbyRun
  readonly isEventZoneHit: boolean
  readonly textSceneBefore: HomeRunTextState
  readonly field: DerbyFieldPlay
}

/** 판 안 소리(홈런 11 · 파울 25)와 그 공 틱 — `fromTick` 앞의 틱은 이미 지났다 */
function playSoundTicksOf(batted: DerbyBattedBall, fromTick: number) {
  return [
    ...batted.homeRunTicks.map((tick) => ({ tick, soundId: DERBY_HOME_RUN_SOUND })),
    ...(batted.foulCallTick === null ? [] : [{ tick: batted.foulCallTick, soundId: FOUL_CALL_SOUND }]),
  ].filter(({ tick }) => tick >= fromTick)
}

/**
 * **더비 판(0x17)의 그림 칸** — HOMERUN 글자 창 · 비거리 판 · 이벤트 존 · 효과를 치운 시각 · 판 안 소리.
 * 판 시각은 공 틱 0 의 머리라 판 안의 틱(소리 · 글자 창 · 키 틱 · 판 끝)이 모두 경기 장면 틱 격자에 선다.
 */
export function useDerbyPlayShow(audioRef: RefObject<SoundPort>) {
  const [isEventZoneShown, setIsEventZoneShown] = useState(false)
  const [isPlayHeld, setIsPlayHeld] = useState(false)
  const [eventZoneRewardX, setEventZoneRewardX] = useState<number | null>(null)
  const [homeRunText, setHomeRunText] = useState<HomeRunTextWindow | null>(null)
  const [effectsClearedAt, setEffectsClearedAt] = useState<number | null>(null)
  const [distanceBoard, setDistanceBoard] = useState<DerbyDistanceBoard | null>(null)
  /** 장면의 글자 칸(+0x1961~+0x196a) — 더비는 앞 연출이 남긴 셈에서 이어 센다. 장면을 새로 세우면(다시하기) 0 */
  const homeRunTextSceneRef = useRef<HomeRunTextState>(HOME_RUN_TEXT_SCENE_START)
  const playRef = useRef<DerbyPlay | null>(null)
  /** 판 안 소리를 그 공 틱에 내는 시계들 */
  const playSoundTimersRef = useRef<number[]>([])
  const clearPlaySoundTimers = useCallback(() => {
    for (const timer of playSoundTimersRef.current) clearGameSceneTimeout(timer)
    playSoundTimersRef.current = []
  }, [])
  useEffect(() => clearPlaySoundTimers, [clearPlaySoundTimers])

  const schedulePlaySounds = useCallback(
    (batted: DerbyBattedBall, startedAt: number, fromTick: number) => {
      const elapsed = gameSceneNow() - startedAt
      for (const { tick, soundId } of playSoundTicksOf(batted, fromTick)) {
        playSoundTimersRef.current.push(
          setGameSceneTimeout(() => playSoundIds(audioRef.current, [soundId]), Math.max(0, tick * millisecondsPerFrame() - elapsed)),
        )
      }
    },
    [audioRef],
  )

  /** HOMERUN 글자 창 · 비거리 판을 이 판으로 — 글자 칸은 판 앞에 남은 칸에서 셈한다 */
  const showPlay = useCallback((play: DerbyPlay) => {
    const text = derbyHomeRunTextOf(play.batted, play.startedAt, play.textSceneBefore, millisecondsPerFrame())
    homeRunTextSceneRef.current = text.after
    setHomeRunText(text.window)
    setDistanceBoard({ startedAt: play.startedAt, batted: play.batted, previous: play.runBefore.lastDistance, field: play.field })
  }, [])

  /**
   * 판을 세운다 — 맞은 공이면 판 안 소리를 걸고 글자 창 · 비거리 판을 띄운다. 맞지 않은 공(`batted` null)은 판이 없다.
   * `rewardX` = 존을 놓은 공의 "200G" 애니 자리(0x41098), 존이 없으면 null
   */
  const startPlay = useCallback(
    (batted: DerbyBattedBall | null, field: DerbyFieldPlay | null, startedAt: number, runBefore: DerbyRun, rewardX: number | null) => {
      clearPlaySoundTimers()
      const zoneHit = field?.timeline.zone != null
      if (batted !== null && field !== null) {
        schedulePlaySounds(batted, startedAt, 0)
        const play = { startedAt, batted, runBefore, isEventZoneHit: zoneHit, textSceneBefore: homeRunTextSceneRef.current, field }
        playRef.current = play
        showPlay(play)
      } else {
        playRef.current = null
        setHomeRunText(null)
        setDistanceBoard(null)
      }
      setIsEventZoneShown(zoneHit)
      setEventZoneRewardX(rewardX)
    },
    [clearPlaySoundTimers, schedulePlaySounds, showPlay],
  )

  /**
   * 판(0x17) 동안 받은 키 0x519cc — 공 틱이 끝으로 넘어가고 관문이 일찍 닫힌다. 필드 화면(공 · 카메라)과 그 뒤 그림의 이벤트 존 셈도
   * 다시 한다. 건너뛸 것이 없으면(홈런 틱 앞 · 판 끝 뒤 · 이미 건너뜀) null, 건너뛰었으면 앞 판과 새 판
   */
  const skipPlay = useCallback(
    (keySceneTick: number) => {
      const before = playRef.current
      if (before === null) return null
      // 키는 그 그림의 갱신(공 틱 +1)보다 먼저 돈다 — 받은 틱 다음 틱이 키를 처리하는 틱이다 (판 시각은 공 틱 0 의 머리)
      const startTick = gameSceneTickOf(before.startedAt)
      const keyTick = keySceneTick - startTick
      const skipped = skipDerbyBattedBall(before.batted, keyTick)
      if (skipped === before.batted) return null
      const input = { ...before.field.input, batted: skipped }
      const field: DerbyFieldPlay = { input, timeline: derbyFieldTimelineOf(input) }
      const after: DerbyPlay = { ...before, batted: skipped, field, isEventZoneHit: field.timeline.zone !== null }
      playRef.current = after
      // 0x519cc 의 0x519fe — 울리던 소리를 끊는다(0x6e418). 키 틱의 홈런 소리는 그 뒤에 난다
      audioRef.current.stop()
      // 0x519cc — 키 틱 프레임 머리에서 효과 객체 칸을 버리고(0x8fc70) 파티클을 치운다(0x6dee4)
      setEffectsClearedAt(before.startedAt + keyTick * millisecondsPerFrame())
      // 키 틱의 홈런 갈래(폴 뒤 담장선)는 그대로 돌고, 그 뒤 틱의 소리는 없다
      clearPlaySoundTimers()
      schedulePlaySounds(skipped, before.startedAt, keyTick)
      showPlay(after)
      if (after.isEventZoneHit !== before.isEventZoneHit) {
        setIsEventZoneShown(after.isEventZoneHit)
        if (!after.isEventZoneHit) setEventZoneRewardX(null)
      }
      return { before, after, endTick: startTick + skipped.endTicks }
    },
    [audioRef, clearPlaySoundTimers, schedulePlaySounds, showPlay],
  )

  /** 판(0x17) 그리기를 내린다 — 비거리 판 · 필드 화면 · 존은 더는 안 돈다 */
  const leavePlay = useCallback(() => {
    setIsPlayHeld(false)
    setIsEventZoneShown(false)
    setEventZoneRewardX(null)
    setDistanceBoard(null)
  }, [])

  /**
   * 판 끝 — 판정 B 0xae3e8 의 모드 7 갈래 머리 ae40e~ae41a 가 이 판에 홈런(state[0x1d])이 났으면 소리를 끊고(0x6e418), 히든 39 창이
   * 서면(`openHidden` 참 — 맞은 공만) 판의 필드 화면을 창 뒤에 남긴다(`isPlayHeld`). 0x17 끝 0x35108 이 파티클을 치우고(0x351e2 → 0x6dee4)
   * HOMERUN 글자를 끈다(0x351d0 +0x1960 = 0 · 0x351d6 [0x1552d0c]+0x1d = 0). 창이 서면 참
   */
  const endPlay = useCallback(
    (openHidden: () => boolean) => {
      if (playRef.current?.batted.isHomeRun === true) audioRef.current.stop()
      const isHiddenShown = playRef.current !== null && openHidden()
      if (playRef.current !== null) setEffectsClearedAt(gameSceneTickStartTime(gameSceneTickNow()))
      playRef.current = null
      setHomeRunText(null)
      if (isHiddenShown) setIsPlayHeld(true)
      else leavePlay()
      return isHiddenShown
    },
    [audioRef, leavePlay],
  )

  /** 새 장면 — 글자 칸(+0x1961~)은 new 의 0 이다 */
  const resetPlay = useCallback(() => {
    clearPlaySoundTimers()
    playRef.current = null
    homeRunTextSceneRef.current = HOME_RUN_TEXT_SCENE_START
    setHomeRunText(null)
    setDistanceBoard(null)
    setIsEventZoneShown(false)
    setEventZoneRewardX(null)
  }, [clearPlaySoundTimers])

  const view = { isEventZoneShown, isPlayHeld, eventZoneRewardX, homeRunText, effectsClearedAt, distanceBoard }
  return { view, startPlay, skipPlay, endPlay, leavePlay, resetPlay }
}
