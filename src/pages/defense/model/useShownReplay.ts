import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

/**
 * 재생 칸(`lastDefensePlay`)의 판이 아직 안 그려졌나 — 미리 돌려 재생 칸에 넣은 판(밀어내기 · 견제 · 진루만 하는 판 · 홈런 비행)이
 * 있고, 화면이 그 판을 아직 끝까지 그리지 않았다(틱이 없는 판은 그릴 것이 없다).
 */
export function hasUnshownReplay(play: DefensePlayResult | null, shownPlay: DefensePlayResult | null): boolean {
  return play !== null && play !== shownPlay && play.ticks.length > 0
}

/**
 * **재생 판 뒤의 정산** (r248 — 타자편 세션 `endGame` · `finishReplay` (r244)의 화면 쪽 짝).
 * 원본은 경기를 끝낸 재생 판도 상태 0x17 로 끝까지 그린 뒤에야 판정 B 0xae3e8 이 0xd(ae4e4 · ae510 · ae5a6) → 경기 끝 판 0x18 로 보낸다.
 * 그 그리기 0x43278 이 실책 +0x2e 를 올리므로(모드 게이트 없음 — `fieldingErrors`) 정산 0x4ea0c 에 그 판 실책이 든다.
 * 요약(`summary`)을 진행에서 곧장 읽는 화면(팀 경기 · 투수편)은 재생이 남은 동안 요약을 안 보이게 해 경기 끝 판 · 정산이
 * 재생보다 먼저 서지 않게 한다(밀어내기 판의 0x12 대기 동안은 원본처럼 타석 화면이 남는다).
 *
 * `onShown` — 판을 다 그렸을 때 함께 알릴 곳(세션이 정산을 미루는 타자편 `finishReplay`). 늘 지금 것을 부른다.
 */
export function useShownReplay(play: DefensePlayResult | null, onShown?: (play: DefensePlayResult | null) => void) {
  /** 이미 다 보여 준 플레이 — 같은 플레이를 두 번 재생하지 않는다 */
  const [shownPlay, setShownPlay] = useState<DefensePlayResult | null>(null)
  const onShownRef = useRef(onShown)
  useLayoutEffect(() => {
    onShownRef.current = onShown
  })
  const finishPlayback = useCallback(() => {
    setShownPlay(play)
    onShownRef.current?.(play)
  }, [play])
  return { shownPlay, finishPlayback, isReplayPending: hasUnshownReplay(play, shownPlay) }
}

/** 재생이 남았으면 요약을 아직 안 낸다 — 경기 끝 판 0x18 · 정산 0x19 는 재생(0x17) 뒤다 */
export function summaryAfterReplay<T>(summary: T | null, isReplayPending: boolean): T | null {
  return isReplayPending ? null : summary
}
