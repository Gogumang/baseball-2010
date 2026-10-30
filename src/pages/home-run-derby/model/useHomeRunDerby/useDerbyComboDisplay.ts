import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { COMBO_DISPLAY_FRAMES, endComboDisplay, shouldShowComboAtNextPitch } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { createGameSceneDrawGate, setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **HUD 콤보 표시** (장면 +0x1b60) — 다음 공 준비(상태 0xf)에서 켜져 `COMBO_DISPLAY_FRAMES` 번 그린 뒤 꺼진다 (`0x3dbf8` · `0x4585c`).
 * 콤보 표시만은 그리기 셈이다 — HUD 그리기 0x45a54 → 0x4585c 가 [+0x19ec] 를 그릴 때마다 +1 하고 0x14 를 넘으면(45a00~45a0a) 끈다.
 * 52efe 가 창이 선 첫 그림([창+0x250])은 그리기를 한 번 더 돌리므로 그 한 그림도 센다(확정 r166 — `createGameSceneDrawGate`)
 */
export function useDerbyComboDisplay(runRef: RefObject<DerbyRun>, setRun: Dispatch<SetStateAction<DerbyRun>>) {
  /** 켜져 있으면 그리는 값(+0x84), 아니면 null */
  const [shownCombo, setShownCombo] = useState<number | null>(null)
  /** 표시를 끄는 시계를 멈춘다 — 켜져 있을 때만 있다 */
  const comboTimerRef = useRef<(() => void) | null>(null)
  const clearComboTimer = useCallback(() => {
    comboTimerRef.current?.()
    comboTimerRef.current = null
  }, [])
  useEffect(() => clearComboTimer, [clearComboTimer])

  /** 0x45a0c~0x45a18 — 콤보 표시를 끄고 +0x84 = 0 */
  const endShownCombo = useCallback(() => {
    clearComboTimer()
    const ended = endComboDisplay(runRef.current)
    runRef.current = ended
    setRun(ended)
    setShownCombo(null)
  }, [clearComboTimer, runRef, setRun])

  /** 원본은 공 하나가 상태 0xf 에서 21 갱신 안에 끝날 수 없어 표시는 늘 그 전에 꺼진다 — 웹 타이머가 늦으면 공 끝에서 먼저 끈다 */
  const endShownComboIfOn = useCallback(() => {
    if (comboTimerRef.current !== null) endShownCombo()
  }, [endShownCombo])

  /**
   * 다음 공 준비(상태 0xf) 진입 0x3d954 — 0x3dbf8: +0x84 > 0 이면 HUD 콤보 표시를 켠다(+0x1b60 = 1 · +0x19ec = 0).
   * 0x3db92~0x3dbf2(모드 7 애니 되돌리기)는 `DerbyHud` 가 표시를 켤 때 첫 칸부터 그리는 것으로 갈음한다.
   */
  const enterNextPitch = useCallback(() => {
    if (!shouldShowComboAtNextPitch(runRef.current)) return
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
  }, [clearComboTimer, endShownCombo, runRef])

  /** 경기 시작 상태 9 의 0x39868 이 +0x84 · 표시(+0x1b60) · +0x19ec 를 지운다 */
  const resetCombo = useCallback(() => {
    clearComboTimer()
    setShownCombo(null)
  }, [clearComboTimer])

  return { shownCombo, enterNextPitch, endShownComboIfOn, resetCombo }
}
