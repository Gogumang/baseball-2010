import { useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** 수비 판 요소를 짓는 함수 — 창을 주면 판이 끝난 뒤에도 그 판을 이어 그리며 창을 얹는다(`DefensePlayback.burstWindow`) */
export type DefensePlaybackMaker = (burstWindow?: ReactNode) => ReactElement

export interface DefenseUnderBurstWindow {
  /** 수비 판(상태 0x17) 갈래 — 판 요소를 짓는 함수를 기억해 두고 지금 그림(창 없음)을 돌려준다 */
  readonly show: (make: DefensePlaybackMaker) => ReactElement
  /**
   * 수비 판이 아닌 갈래 — 방금 끝난 판의 끝(0x528b0)에서 돌발 판정이 났으면(상태 0x1c) 그 판을 **같은 요소**로 다시 지어 창과 함께
   * 돌려준다. 아니면 null 이고, 지금 판정을 "판 밖에서 본 판정" 으로 적는다.
   */
  readonly held: (burstWindow: ReactNode) => ReactElement | null
}

/**
 * **돌발 결과 창 0x1c 는 수비 화면 위에 선다** (r284 직접 뜸 — `DefensePlayback.burstWindow` 머리말).
 *
 * 0x17 끝 0x528b0 → 0x8f414(52a8e)가 참이면 0x1c(52aa2) — 그리기 0x46ee0 이 수비 화면 0x46c88 을 그린 뒤 창 0x8f3c0 을 얹는다.
 * 0x12 끝 0x4e6d4 → 0x8f414(4e7ca)가 참이면 0x1d(4e7e4) — 그리기 0x4d1e0 은 타석 화면이다(지금처럼 타석 위 덮개).
 *
 * 웹 경기 흐름은 판이 끝나는 걸음(`finishDefensePlay` · `finishRunnerPlay` · 재생 끝)에서 판정을 싣고 판 칸을 비운다. 그래서 화면은
 * "판 갈래가 마지막으로 그린 뒤 판 밖 그림이 아직 못 본 판정" 이면 0x1c 로 보고, 방금 판을 같은 자리 · 같은 요소로 다시 그려
 * (React 가 판 상태를 잇는다) 그 위에 창을 얹는다. 판 밖 그림이 먼저 본 판정(0x12 끝 — 볼넷 · 사구 밀어내기 판 앞 대기 동안 이미 뜬 것)은
 * 그 뒤 판이 끝나도 판 위 창이 아니다. 창을 닫아 판정이 지워지면(`closeBurstResult`) 판도 내린다.
 *
 * 부르는 쪽은 판 갈래마다 `show`, 판 갈래가 아닌 첫 자리에서 `held` 를 부른다 — 두 자리가 화면의 같은 뿌리여야 상태가 이어진다.
 */
export function useDefenseUnderBurstWindow(resolution: object | null): DefenseUnderBurstWindow {
  const makeRef = useRef<DefensePlaybackMaker | null>(null)
  /** 판 밖 그림이 마지막으로 본 판정 */
  const seenRef = useRef<object | null>(resolution)
  return {
    show: (make) => {
      makeRef.current = make
      return make()
    },
    held: (burstWindow) => {
      const make = makeRef.current
      if (make !== null && resolution !== null && resolution !== seenRef.current) return make(burstWindow)
      makeRef.current = null
      seenRef.current = resolution
      return null
    },
  }
}
