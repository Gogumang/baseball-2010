import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { startPlayClock } from '@/entities/collection/model/playClock'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { activeSound } from '@/shared/api/audio/soundPort'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import type { HomeRunDerbyOptions } from './homeRunDerbyTypes'
import { rollDerbySceneStart } from './rollDerbySceneStart'

/**
 * **경기 장면 시작** — 상대 팀 · 하늘 줄 · 두 구장 · 로딩 판 팁을 세운다(`rollDerbySceneStart`). 첫 장면은 들어선 첫 그림 뒤 한 번
 * (첫 공 — 상태 0xd → 투구보다 앞, StrictMode 의 효과 두 번 돌기에도 한 번), 다시하기 · 재도전은 `startScene` 으로.
 */
export function useDerbySceneStart(optionsRef: RefObject<HomeRunDerbyOptions>, myTeamIdRef: RefObject<number>) {
  /** 상대 팀 v (장면 시작 굴림 3a454) — 난수가 없으면 undefined */
  const [opponentTeamId, setOpponentTeamId] = useState<number | undefined>(undefined)
  const isSceneStartRolledRef = useRef(false)
  /** 하늘 줄 — 구장 +0x10 (`rollDerbySceneStart` · 결과 진입 0x4f574). 굴리기 전(첫 장면 시작 효과 앞 · 난수 없음)엔 undefined — 타석 그림은 0 줄로 그리고 굴리지 않는다 */
  const [skyRow, setSkyRow] = useState<number | undefined>(undefined)
  /** 두 구장 객체 — 장면 시작마다 새로 (`rollDerbySceneStart`) */
  const [sceneStadium, setSceneStadium] = useState<SceneStadium | null>(null)
  /** 로딩 판의 팁 글 — 서 있는 동안 0xd 시계를 안 건다 (`finishLoading` 이 건다) */
  const [loadingTip, setLoadingTip] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  /** 새 경기 장면의 시작 굴림 — 하늘 줄과 로딩 판 팁을 세운다. 난수가 없으면 아무것도 안 한다 */
  const startScene = useCallback(() => {
    const random = optionsRef.current.random
    if (random === undefined) return
    const started = rollDerbySceneStart(random, myTeamIdRef.current)
    setOpponentTeamId(started.opponentTeamId)
    // 상태 7 갱신 0x3e340 의 맨 앞 0x3e350 이 울리던 소리를 끊는다(0x6e418) — 첫 장면 · 다시하기 · 재도전마다 새 장면이다
    activeSound().stop()
    // 경기 장면 적재 0x3f584 의 0x3fa3e `0x3f554` — 플레이 시간 시계를 이때부터 잰다
    startPlayClock()
    setSkyRow(started.skyRow)
    setSceneStadium(started.stadium)
    isLoadingRef.current = true
    setLoadingTip(LOADING_TIPS[started.loadingTipIndex] ?? null)
  }, [optionsRef, myTeamIdRef])

  useEffect(() => {
    if (isSceneStartRolledRef.current) return
    isSceneStartRolledRef.current = true
    // 0x39fdc 모드 7 갈래 3a49c — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`). 더비는 한 공 끝 판정 A 가 0x18 로
    // 안 가(모드 7 → 0xd / 0x1a) 이닝 넘김 0xb6b6c 를 안 지나므로 그대로 0 이 남는다
    resetLiveGameState()
    startScene()
  }, [startScene])

  /** 로딩 판(상태 7 · 9 · 8)을 다 그렸으면 내린다 — 서 있었으면 참 */
  const closeLoading = useCallback(() => {
    if (!isLoadingRef.current) return false
    isLoadingRef.current = false
    setLoadingTip(null)
    return true
  }, [])

  return { opponentTeamId, skyRow, setSkyRow, sceneStadium, loadingTip, isLoadingRef, startScene, closeLoading }
}
