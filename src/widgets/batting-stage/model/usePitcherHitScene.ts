import { useCallback, useMemo, useRef, useState } from 'react'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import { pitchHitSceneTicksOf, pitcherHitSceneOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'

export interface PitcherHitSceneState {
  /** 지금 사람 투구 장면(`PitcherSideStage`)이 그릴 맞은 공 재료 — 그리는 동안만. 아니면 null */
  readonly hitScene: PitcherHitScene | null
  /** 0x11 끝 · 0x13 을 그리는 중이다 — 이 동안은 수비 판(0x17)을 아직 안 띄운다 */
  readonly isShowing: boolean
  /** 장면이 0x17 이 선 틀에 부른다(`PitcherSideStage.onHitSceneEnd`) */
  readonly end: () => void
}

/**
 * **사람이 던진 공을 CPU 타자가 맞혔을 때 수비 판(0x17)을 0x13 끝까지 미룬다.**
 *
 * 웹 진행기는 공을 놓는 순간(0x11 틱 10) 판정까지 내고 수비 판(`pendingDefensePlay`)을 세운다. 원본은 그 공이 판정 틀(스윙 F + 1 ·
 * 번트 N − 1)까지 0x11 을 날고, 0x13(맞은 직후 — 큰 타구면 문턱 + 7 틱)을 지나 0x17 로 간다(`pitcherSideStage.pitcherHitSceneOf`).
 * 이 훅은 새 수비 판이 쏜 공(`contactOfOutcome`)을 들고 있으면 그 판을 붙들어 두고, 장면이 0x17 이 선 틀을 알리면 놓는다.
 * 수비 판 입력은 굴림 없이 세운 값이라(판 시작 굴림은 `DefensePlayback` 이 판이 설 때 한다) 미뤄도 난수 차례는 그대로다.
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
  /** 진행기가 세운 수비 판 — 쏜 공이 묶인 임시 결과(`outcome`)만 본다. 사람 수비 판이 아니면 null */
  readonly play: { readonly outcome: AtBatOutcome } | null
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
  playRef.current = play
  const hitScene = useMemo(() => {
    if (play === null || play === mountedPlay || pitch === null) return null
    const contact = contactOfOutcome(play.outcome)
    return contact === undefined ? null : pitcherHitSceneOf(contact, cpuSwing, pitch.frameCount, batterHand)
    // 판 하나 · 공 하나에 한 번 — 타자 손은 판이 서는 그림의 값
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, pitch, mountedPlay])
  const isShowing = hitScene !== null && play !== null && endedPlay !== play
  const end = useCallback(() => setEndedPlay(playRef.current), [])
  // 안전판 — 0x17 틱 + 1 에 놓는다 (판마다 처음부터 센다)
  const fallbackRef = useRef<{ readonly play: object | null; left: number }>({ play: null, left: 0 })
  if (isShowing && hitScene !== null && fallbackRef.current.play !== play) {
    fallbackRef.current = { play, left: pitchHitSceneTicksOf(hitScene, aceOrder) + HIT_SCENE_FALLBACK_SLACK_TICKS }
  }
  useSceneTick(() => {
    const fallback = fallbackRef.current
    fallback.left -= 1
    if (fallback.left <= 0 && fallback.play === playRef.current) setEndedPlay(fallback.play)
  }, isShowing && !isFrozen)
  return { hitScene: isShowing ? hitScene : null, isShowing, end }
}

/** 화면 쪽 안전판이 장면의 0x17 알림보다 늦게 서는 틱 수 */
const HIT_SCENE_FALLBACK_SLACK_TICKS = 1
