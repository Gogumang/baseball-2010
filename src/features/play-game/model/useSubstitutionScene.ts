import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { confirmedCountOf, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm'

export interface SubstitutionScenePlayback {
  /** 지금 0x16 — "CHANGE" 애니(`SubstitutionSceneOverlay`)를 그리고 0xe 대기를 세지 않는다 */
  readonly isShown: boolean
  /** 연출을 세운 진행기의 번호 — 겹치는 판의 `key` */
  readonly serial: number
  /** 들어온 선수가 마선수인가 — 0x4da30 이 컷인 0x473f0 을 그린다 */
  readonly incomingIsAce: boolean
  /** 화면이 연출을 다 그렸다(메시지 0xd) — 0xd 두 그림 뒤 0xe 그리기가 등판음을 낸다 */
  readonly finish: () => void
}

/**
 * **교체 연출 0x16 을 경기 화면에 세운다** — 진행기(나리 타자편 · 투수편 · 팀경기)가 실은 `SubstitutionScene` 을 본다.
 *
 * - 0xe 대기가 `confirmsBefore` 번 OK 를 받은 뒤(없으면 곧장), `canRun`(덮개 · 팝업 · 결과 띠가 없을 때)이면 선다.
 * - 선 첫 그림에 `timeSoundId`(CPU 교체의 "Time!" 22 — 진행기가 안 낸 경우)를 낸다.
 * - 다 그리면(`finish`) 0xd 두 그림 뒤 0xe 그리기 0x38d1c(38dc2) → 0x38b64 가 등판음(26 · 15 · 14)을 낸다.
 *   ⚠️ 근사: 0xd 두 그림을 타이머로 센다 — 화면의 0xe 대기도 같은 때부터 0xd 두 그림을 센다(`useSceneConfirm`).
 * 한 번 다 본 번호는 다시 세우지 않는다(화면이 다시 서도 — 진행 상태가 같은 객체를 들고 있는 동안).
 */
export function useSubstitutionScene(
  scene: SubstitutionScene | null | undefined,
  wait: SceneConfirmWait | null | undefined,
  canRun: boolean,
): SubstitutionScenePlayback {
  const [, setVersion] = useState(0)
  const isDone = scene == null || seenSerials.has(scene)
  const confirmed = confirmedCountOf(wait)
  const isShown = !isDone && canRun && confirmed >= (scene?.confirmsBefore ?? 0)

  // 3da88 — 0x16 에 들어서기 전 "Time!" 22 (진행기가 안 냈을 때만 실려 온다)
  const timePlayedRef = useRef<SubstitutionScene | null>(null)
  useEffect(() => {
    if (!isShown || scene == null || timePlayedRef.current === scene) return
    timePlayedRef.current = scene
    if (scene.timeSoundId !== undefined) activeSound().play(scene.timeSoundId)
  }, [isShown, scene])

  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const finish = useCallback(() => {
    const current = sceneRef.current
    if (current == null || seenSerials.has(current)) return
    seenSerials.add(current)
    setVersion((version) => version + 1)
    const entry = current.entrySoundId
    window.setTimeout(() => activeSound().play(entry), SCENE_PREPARE_FRAMES * millisecondsPerFrame())
  }, [])

  return { isShown, serial: scene?.serial ?? 0, incomingIsAce: scene?.incomingIsAce ?? false, finish }
}

/** 다 그린 연출 — 화면이 다시 서도(수비 화면을 갔다 와도) 같은 연출을 두 번 안 그린다 */
const seenSerials = new WeakSet<SubstitutionScene>()
