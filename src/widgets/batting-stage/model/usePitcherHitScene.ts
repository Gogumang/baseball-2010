import { useCallback, useRef, useState } from 'react'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { preRollContactMessage, type DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { pitchHitSceneTicksOf, pitcherHitSceneOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'

export interface PitcherHitSceneState {
  /** 지금 사람 투구 장면(`PitcherSideStage`)이 그릴 맞은 공 재료 — 그리는 동안만. 아니면 null */
  readonly hitScene: PitcherHitScene | null
  /** 0x11 끝 · 0x13 을 그리는 중이다 — 이 동안은 수비 판(0x17)을 아직 안 띄운다 */
  readonly isShowing: boolean
  /** 장면이 0x17 이 선 틀에 부른다(`PitcherSideStage.onHitSceneEnd`) */
  readonly end: () => void
  /**
   * 장면이 **판정 틀**(0x6aa → 0x51408)에 부른다(`PitcherSideStage.onHitJudged`) — 메시지 0x11 굴림 묶음(필살수비 · 표시 패턴 · 두 공 폴 ·
   * 필살타법)을 판 입력으로 미리 굴려(`preRollContactMessage`) 쏜 공에 묶고, 표시 패턴으로 다시 만든 0x13 재료를 돌려준다(A-37)
   */
  readonly judge: () => PitcherHitScene | null
}

interface HitSceneInput {
  readonly play: DefensePlayInput | null
  readonly pitch: Pitch | null
  readonly mountedPlay: DefensePlayInput | null
  readonly cpuSwing: CpuSwingPose | null
  readonly batterHand: number
}

/** 판 · 공이 바뀐 그림에서만 0x13 재료를 다시 만든다 — 그 밖의 그림은 앞 재료 그대로 */
function advanceHitScene(
  previous: { readonly input: HitSceneInput; readonly scene: PitcherHitScene | null } | null,
  input: HitSceneInput,
): { readonly input: HitSceneInput; readonly scene: PitcherHitScene | null } {
  const isSame =
    previous !== null &&
    previous.input.play === input.play &&
    previous.input.pitch === input.pitch &&
    previous.input.mountedPlay === input.mountedPlay
  if (isSame) return previous
  return { input, scene: hitSceneOf(input) }
}

function hitSceneOf({ play, pitch, mountedPlay, cpuSwing, batterHand }: HitSceneInput): PitcherHitScene | null {
  if (play === null || play === mountedPlay || pitch === null) return null
  const contact = contactOfOutcome(play.outcome)
  return contact === undefined ? null : pitcherHitSceneOf(contact, cpuSwing, pitch.frameCount, batterHand)
}

/**
 * **사람이 던진 공을 CPU 타자가 맞혔을 때 수비 판(0x17)을 0x13 끝까지 미룬다.**
 *
 * 웹 진행기는 공을 놓는 순간(0x11 틱 10) 판정까지 내고 수비 판(`pendingDefensePlay`)을 세운다. 원본은 그 공이 판정 틀(스윙 F + 1 ·
 * 번트 N − 1)까지 0x11 을 날고, 0x13(맞은 직후 — 큰 타구면 문턱 + 7 틱)을 지나 0x17 로 간다(`pitcherSideStage.pitcherHitSceneOf`).
 * 이 훅은 새 수비 판이 쏜 공(`contactOfOutcome`)을 들고 있으면 그 판을 붙들어 두고, 장면이 0x17 이 선 틀을 알리면 놓는다.
 * 수비 판 입력은 굴림 없이 세운 값이다. 메시지 0x11 굴림 묶음은 장면이 판정 틀에 `judge` 로 굴리고(0x13 그림의 파티클 굴림보다 앞 —
 * 원본 차례), 나머지 판 굴림은 `DefensePlayback` 이 판이 설 때 한다. 장면이 판정 틀을 못 알리면 판 시작이 묶음까지 굴린다.
 * 화면이 설 때 이미 떠 있던 판(이어하기 따위)은 붙들지 않는다 — 그 공은 장면이 다시 날리지 않는다.
 * 장면이 못 알리는 자리(캔버스가 없는 시험 · 장면이 내려간 동안)를 위해 화면 쪽도 장면 틱으로 0x17 틱(`pitchHitSceneTicksOf`)을 세어
 * 한 틱 늦게 놓는다(웹 전용 안전판 — 장면의 알림이 먼저 온다).
 */
export function usePitcherHitScene({
  play,
  pitch,
  cpuSwing,
  batterHand,
  aceOrder = null,
  isFrozen = false,
}: {
  /** 진행기가 세운 수비 판 — 쏜 공이 묶인 임시 결과(`outcome`)와 판정 틀에 미리 굴릴 입력. 사람 수비 판이 아니면 null */
  readonly play: DefensePlayInput | null
  /** 그 판을 낸 공(진행기 `lastPitch`) */
  readonly pitch: Pitch | null
  readonly cpuSwing: CpuSwingPose | null
  /** 친 타자의 손(장면 배치 +0x17e1) — 쏜 공에 손이 안 묶였을 때만 쓴다 */
  readonly batterHand: number
  /** 마운드 마투수 순번 — 공 틱이 오르는 단계(0x3f378). 없으면 평범한 투수 */
  readonly aceOrder?: number | null
  /** 팝업(0x52cc6)이 떠 장면 틱이 멈췄다 */
  readonly isFrozen?: boolean
}): PitcherHitSceneState {
  /** 화면이 설 때 이미 있던 판 */
  const [mountedPlay] = useState(play)
  const [endedPlay, setEndedPlay] = useState<object | null>(null)
  const playRef = useRef(play)
  useMirrorRef(playRef, play)
  // 판 하나 · 공 하나에 한 번 — 타석 자세 · 타자 손은 판이 서는 그림의 값
  const hitScene = useRenderMachine(advanceHitScene, { play, pitch, mountedPlay, cpuSwing, batterHand }).scene
  /** 판정 틀에 굴려 다시 만든 0x13 재료 — 그 판의 것만 쓴다 */
  const [judged, setJudged] = useState<{ readonly play: object; readonly scene: PitcherHitScene } | null>(null)
  const shownScene = hitScene === null ? null : judged !== null && judged.play === play ? judged.scene : hitScene
  const isShowing = shownScene !== null && play !== null && endedPlay !== play
  const end = useCallback(() => setEndedPlay(playRef.current), [])
  const sceneInputsRef = useRef({ pitch, cpuSwing, batterHand })
  useMirrorRef(sceneInputsRef, { pitch, cpuSwing, batterHand })
  const judge = useCallback((): PitcherHitScene | null => {
    const current = playRef.current
    const inputs = sceneInputsRef.current
    if (current === null || inputs.pitch === null) return null
    const contact = contactOfOutcome(current.outcome)
    if (contact === undefined) return null
    const shot = preRollContactMessage(current)
    const scene = pitcherHitSceneOf(contact, inputs.cpuSwing, inputs.pitch.frameCount, inputs.batterHand, shot)
    setJudged({ play: current, scene })
    return scene
  }, [])
  // 안전판 — 0x17 틱 + 1 에 놓는다 (판마다 처음부터 센다). 길이는 지금 재료(판정 틀에 다시 만든 것)로 센다
  const fallbackRef = useRef<{ readonly play: object | null; elapsed: number }>({ play: null, elapsed: 0 })
  const shownSceneRef = useRef(shownScene)
  useMirrorRef(shownSceneRef, shownScene)
  useSceneTick(() => {
    // 새 판이면 처음부터 센다 — 틱은 보이는 동안만 돌므로 그 판의 첫 틱 머리가 곧 판이 선 때다(팝업으로 멈춘 틱은 안 센다)
    if (fallbackRef.current.play !== playRef.current) fallbackRef.current = { play: playRef.current, elapsed: 0 }
    const fallback = fallbackRef.current
    const scene = shownSceneRef.current
    fallback.elapsed += 1
    if (
      scene !== null &&
      fallback.elapsed >= pitchHitSceneTicksOf(scene, aceOrder) + HIT_SCENE_FALLBACK_SLACK_TICKS &&
      fallback.play === playRef.current
    ) {
      setEndedPlay(fallback.play)
    }
  }, isShowing && !isFrozen)
  return { hitScene: isShowing ? shownScene : null, isShowing, end, judge }
}

/** 화면 쪽 안전판이 장면의 0x17 알림보다 늦게 서는 틱 수 */
const HIT_SCENE_FALLBACK_SLACK_TICKS = 1
