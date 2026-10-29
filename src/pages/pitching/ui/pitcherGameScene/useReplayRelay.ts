import { useCallback, useState } from 'react'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { useFreePassPlayStart } from './otherSlices'

interface ReplayRelayInput {
  readonly progress: PitcherGameProgress
  readonly play: PitcherGameProgress['lastDefensePlay']
  readonly shownPlay: PitcherGameProgress['lastDefensePlay']
  readonly isPopupOpen: boolean
}

/**
 * 재생 판 · 자동진행 중계 — 견제 판(또는 홈런 비행)을 재생하는 동안은 원본도 상태 0x17 이라 0xf 키를 안 받는다.
 * 볼넷 · 사구 밀어내기 판(종류 2)은 0x12 대기(0x1f 틱) 뒤 판정 A 가 0x17 로 보낸다 — 그동안 타석 화면을 둔다
 */
export function useReplayRelay({ progress, play, shownPlay, isPopupOpen }: ReplayRelayInput) {
  const unshownPlay = play !== null && play !== shownPlay ? play : null
  const isReplayReady = useFreePassPlayStart(
    unshownPlay,
    progress.pendingBenchClearing !== null,
    isPopupOpen,
    // 0x12 끝 돌발 판정의 결과 창(0x1d)을 닫은 뒤에야 판정 A 의 0x17
    progress.lastBurstResolution !== null,
  )
  const isReplaying = unshownPlay !== null && unshownPlay.ticks.length > 0 && isReplayReady
  /**
   * **자동진행 중계(상태 0x21)** — 사람 장면 사이에 돈 간이 엔진 틱들(우리 공격 · 강판 뒤 수비)을 틱마다 한 칸씩 튼다
   * (`progress.autoRelay`, 그리기는 미션과 같은 몫 — 모드 3 은 키 · 속도 · 배경음 · 연출 대기가 없다). 앞 판의 수비 재생 뒤, 0x18 · 0xe 앞.
   */
  const relay = progress.autoRelay ?? null
  const [shownRelaySerial, setShownRelaySerial] = useState(0)
  const finishRelay = useCallback(() => setShownRelaySerial(relay?.serial ?? 0), [relay])
  return { isReplaying, replayPlay: isReplaying ? unshownPlay : null, relay, shownRelaySerial, finishRelay }
}
