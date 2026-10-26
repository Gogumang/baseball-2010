import { useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

/**
 * 공 도착 판을 받은 그림(0x12 진입 틀 — 0x3dfac 이 판을 연 틀)에서 0x17 틱 0 까지 — 진입이 0xbcb49(…, 0x17) 로 예약하므로 0x17 은 그 다음
 * 그림이다
 */
export const PITCH_ARRIVAL_PLAY_TICKS = 1

/**
 * **사람이 던진 공의 공 도착 판(도루 종류 5 · 폭투·포일 종류 9)을 0x12 진입 다음 그림까지 미룬다.**
 *
 * 원본은 공이 도착해 0x12 에 드는 틀의 진입 0x3dfac 이 판을 연다 (r174 직접 떴다):
 * ```
 * 3e038  0x35034(장면) — rollPassedBall (모드 7 빼고 매 투구 rand(0,10000))
 * 3e058  0xca9f8(…, 0x9d57d) — 공 도착 판정 · 판 종류 (+0x10ac)
 * 3e062  판이 섰고(r4 ≠ 0) 종류가 3 · 4 가 아니면: 3e070 0x3507c · 3e080 0xb0cb9(플레이, 9) 판 시작 · 3e092 [..+0xb8] = 6
 * 3e09a  0xbcb49(상태기, 0x17) — 0x17 을 예약(다음 그림이 0x17 틱 0)
 * ```
 * 세 진행기(투수편 `startPitch` · 팀경기 `startThrowPitch` · 투수 미션 `handleThrow`)의 화면 갈래는 못 맞힌 공의 공 도착을 놓는 걸음에서
 * 떼어 0x12 진입 틀(놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤)에 돌린다(r293 — `enterPitchResult` 따위). 그래서 판(`pendingRunnerPlay`)은
 * 그 틀에 서고, 이 고리는 그 그림부터 `PITCH_ARRIVAL_PLAY_TICKS` 장면 틱 동안 타석 장면(0x12 틱 0)을 둔 뒤 수비 화면을 띄운다.
 * 셈은 장면 틱이다 — `useSceneTick` 이 틱 머리마다 하나씩 줄이고 공용 창 아래에서는 선다(그림 수가 아니다).
 * 화면이 설 때 이미 있던 판(이어하기 · 수비 화면에서 돌아옴)은 붙들지 않는다. 사람 견제(종류 4) 판은 공이 없어 붙들지 않는다 — 부르는 쪽이
 * 공 도착 판만 넘긴다.
 */
export function usePitchArrivalHold({
  play,
  isFrozen = false,
}: {
  /** 진행기가 세운 공 도착 판(사람 수비 — 사람이 던진 공). 아니면 null */
  readonly play: object | null
  /** 팝업(0x52cc6)이 떠 장면 틱이 멈췄다 */
  readonly isFrozen?: boolean
}): boolean {
  const [mountedPlay] = useState(play)
  const [releasedPlay, setReleasedPlay] = useState<object | null>(null)
  const playRef = useRef(play)
  playRef.current = play
  const isHolding = play !== null && play !== mountedPlay && releasedPlay !== play
  const countRef = useRef<{ readonly play: object | null; left: number }>({ play: null, left: 0 })
  if (isHolding && countRef.current.play !== play) {
    countRef.current = { play, left: PITCH_ARRIVAL_PLAY_TICKS }
  }
  useSceneTick(() => {
    const count = countRef.current
    count.left -= 1
    if (count.left <= 0 && count.play === playRef.current) setReleasedPlay(count.play)
  }, isHolding && !isFrozen)
  return isHolding
}
