import { useRef, useState } from 'react'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { pitchResultEntryDelayTicksOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

/**
 * 공을 놓은 틱(0x11 틱 10)에서 공 도착 판의 0x17 틱 0 까지 — 0x12 틱 0(`pitchResultEntryDelayTicksOf`)의 진입 0x3dfac 이 판을 열고
 * 0xbcb49(…, 0x17) 로 예약하므로 0x17 은 그 다음 그림이다
 */
export function pitchArrivalPlayTicksOf(frameCount: number, aceOrder?: number | null): number {
  return pitchResultEntryDelayTicksOf(frameCount, aceOrder) + 1
}

/**
 * **사람이 던진 공의 공 도착 판(도루 종류 5 · 폭투·포일 종류 9)을 0x12 진입 다음 그림까지 미룬다.**
 *
 * 원본은 공이 도착해 0x12 에 드는 틀의 진입 0x3dfac 이 판을 연다 (r174 직접 떴다):
 * ```
 * 3e058  0xca9f8(…, 0x9d57d) — 공 도착 판정 · 판 종류 (+0x10ac)
 * 3e062  판이 섰고(r4 ≠ 0) 종류가 3 · 4 가 아니면: 3e070 0x3507c · 3e080 0xb0cb9(플레이, 9) 판 시작 · 3e092 [..+0xb8] = 6
 * 3e09a  0xbcb49(상태기, 0x17) — 0x17 을 예약(다음 그림이 0x17 틱 0)
 * ```
 * 웹 진행기는 공을 놓는 순간(0x11 틱 10) 판정과 함께 판(`pendingRunnerPlay`, 판 시작 굴림까지 끝낸 것)을 세우므로, 그 판을 받은 그림에서
 * 0x17 틱 0 까지(`pitchArrivalPlayTicksOf`) 장면 틱을 세어 그동안은 타석 장면(0x11 끝 · 0x12 틱 0)을 둔다. 판 시작 굴림은 이미 났으니
 * 미뤄도 난수 차례는 그대로다(⚠️ 근사: 원본은 그 굴림이 0x12 진입에 난다(남김 — 진행기 구조: 웹 진행기는 놓는 순간
 * 판정 · 판 시작 굴림을 한꺼번에 끝내 돌려주므로 장면이 굴림을 0x12 진입까지 미룰 길이 없다) — 그 사이 파티클 관리자 틱이 경기 난수를
 * 굴리면 앞뒤가 바뀐다).
 * 화면이 설 때 이미 있던 판(이어하기 · 수비 화면에서 돌아옴)은 붙들지 않는다. 사람 견제(종류 4) 판은 공이 없어 붙들지 않는다 — 부르는 쪽이
 * 공 도착 판만 넘긴다.
 */
export function usePitchArrivalHold({
  play,
  pitch,
  aceOrder = null,
  isFrozen = false,
}: {
  /** 진행기가 세운 공 도착 판(사람 수비 — 사람이 던진 공). 아니면 null */
  readonly play: object | null
  /** 그 판을 낸 공(진행기 `lastPitch`) */
  readonly pitch: Pitch | null
  /** 마운드 마투수 순번 — 공 틱이 오르는 단계(0x3f378). 없으면 평범한 투수 */
  readonly aceOrder?: number | null
  /** 팝업(0x52cc6)이 떠 장면 틱이 멈췄다 */
  readonly isFrozen?: boolean
}): boolean {
  const [mountedPlay] = useState(play)
  const [releasedPlay, setReleasedPlay] = useState<object | null>(null)
  const playRef = useRef(play)
  playRef.current = play
  const isHolding = play !== null && play !== mountedPlay && pitch !== null && releasedPlay !== play
  const countRef = useRef<{ readonly play: object | null; left: number }>({ play: null, left: 0 })
  if (isHolding && pitch !== null && countRef.current.play !== play) {
    countRef.current = { play, left: pitchArrivalPlayTicksOf(pitch.frameCount, aceOrder) }
  }
  useSceneTick(() => {
    const count = countRef.current
    count.left -= 1
    if (count.left <= 0 && count.play === playRef.current) setReleasedPlay(count.play)
  }, isHolding && !isFrozen)
  return isHolding
}
