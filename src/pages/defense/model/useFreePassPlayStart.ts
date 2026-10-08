import { useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { isWalkPlayResult, WALK_PLAY_WAIT_TICKS } from '@/features/defense-play/model/walkPlay'

/**
 * **볼넷 · 사구 밀어내기 판(종류 2)을 언제 띄우나** — 원본은 공 도착(0x12 진입 0x3dfac)에서 판 종류를 2 로 두고도 곧장 0x17 로
 * 가지 않는다. 0x12 갱신 0x4e6d4 가 상태 틱 [+0x2c] 를 0x1f(판정 3 · 4)까지 기다린 뒤 판정 A 0xae24c(ae344~ae35c)가 0x17 로 보낸다
 * (도루 · 폭투 판은 0x3e096 · 0x3e114 가 곧장 0x17 — 대기를 안 탄다). 사구가 벤치 클리어링(0x1e)에 들어갔으면 그 대기 끝(0x4e74c)에서
 * 연출로 갔다가 출구 0xae24c 에서 곧장 0x17 이라 연출 뒤에는 기다리지 않는다.
 *
 * 웹 진행기는 공을 판정한 그 걸음에 판을 재생 칸에 넣으므로, 재생 화면을 세우기 전에 그 대기만큼 타석 화면을 둔다.
 * 팝업 등으로 0x12 틱이 멈추는 것(0x52cc6)은 `isFrozen` 으로 받는다.
 *
 * `play` = 아직 안 보여 준 재생거리(없으면 null). `benchClearingPending` = 지금 벤치 클리어링 연출이 붙들고 있나.
 * 돌려주는 값이 참이면 재생 화면을 세워도 된다(밀어내기 판이 아니면 늘 참).
 */
export function useFreePassPlayStart(
  play: DefensePlayResult | null,
  benchClearingPending: boolean,
  isFrozen = false,
): boolean {
  const isWalk = isWalkPlayResult(play)
  /** 대기를 다 채운(또는 안 기다리는) 판 */
  const [readyPlay, setReadyPlay] = useState<DefensePlayResult | null>(null)
  /** 지난 판 뒤로 벤치 클리어링 연출이 섰나 — 섰으면 다음 밀어내기 판은 출구에서 곧장 0x17 */
  const benchClearingSeenRef = useRef(false)
  if (benchClearingPending) benchClearingSeenRef.current = true
  /** 지금 기다리는 판과 지난 틱 수 */
  const waitingRef = useRef<{ readonly play: DefensePlayResult; elapsed: number } | null>(null)
  if (isWalk && play !== readyPlay && waitingRef.current?.play !== play) {
    if (benchClearingSeenRef.current) {
      benchClearingSeenRef.current = false
      waitingRef.current = { play, elapsed: WALK_PLAY_WAIT_TICKS }
    } else {
      waitingRef.current = { play, elapsed: 0 }
    }
  }
  const waiting = waitingRef.current
  const due = isWalk && waiting !== null && waiting.play === play && waiting.elapsed >= WALK_PLAY_WAIT_TICKS

  useSceneTick(() => {
    const current = waitingRef.current
    if (current === null || current.play !== play) return
    current.elapsed += 1
    if (current.elapsed >= WALK_PLAY_WAIT_TICKS) setReadyPlay(play)
  }, isWalk && play !== readyPlay && !due && !isFrozen)

  if (!isWalk) return true
  return play === readyPlay || due
}
