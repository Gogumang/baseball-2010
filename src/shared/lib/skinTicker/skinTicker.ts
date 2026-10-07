import { useEffect, useRef } from 'react'

/**
 * **흐르는 글 0x5a8c8** 과 그 카운터 **[skin+0x284]** — 앱에 하나.
 *
 * ```
 * 0x5a8c8(skin, 글, x, y, w, h, _, 자르기, 올리기)
 *   자르기 ≠ 0 이면 0xbae25(x + 2, y, w − 4, h) 로 자른다
 *   tw = 글 폭(0x9c52d) · 한 바퀴 = tw + w
 *   글 왼쪽 = x + w − (한 바퀴 > 0 ? [skin+0x284] % 한 바퀴 : 0)   ; 0xca911 = 나머지 → 오른쪽에서 흘러 들어온다
 *   0xba269 로 왼쪽 맞춤 한 줄을 그린 **뒤** 올리기 ≠ 0 이면 [skin+0x284] += 3 (0x5a956~0x5a962)
 * ```
 * 부르는 곳은 모두 스킨 전역 [0x1552cfc] 를 넘긴다 — 기록연감 탭 0 설명(0x2ea80) · 메인 메뉴 상태 15 대전(0x27458 의 0x281da) ·
 * 팀 경기 정산(0x4a384 의 0x4aef0) · 선수 정보 창(0x5b798 의 다섯 곳) · 시즌 카드 정보 상자(0x7c450 의 0x7ca7e). 모두 올리기 1 이라
 * **어느 화면이 그리든 같은 칸이 3 씩 오른다.**
 * 0 으로 지우는 곳은 둘뿐이다(직접 떴다): 스킨을 만들 때 0x5390c(0x53a00~0x53a08) · 메인 메뉴 상태 15(대전) 진입 0x31918 의
 * 0x31c60~0x31c6a — 웹은 대전(통신, 🌐)이 없어 `clearSkinTickerCounter` 를 부르는 곳이 아직 없다.
 */
export const SKIN_TICKER_STEP = 3

/** 자르기 칸은 좌우 2px 안쪽 */
export const SKIN_TICKER_CLIP_INSET = 2

const skinTickerCounter = { value: 0 }

/** 지금 [skin+0x284] — 읽기만 (테스트·디버그용) */
export const skinTickerCounterValue = () => skinTickerCounter.value

/** 앱을 새로 띄운 것과 같다 (0x5390c) — 테스트용 */
export const resetSkinTickerCounter = () => {
  skinTickerCounter.value = 0
}

/** 메인 메뉴 상태 15(대전) 진입 0x31c60 — [skin+0x284] = 0 */
export const clearSkinTickerCounter = resetSkinTickerCounter

/** 흐르는 글의 왼쪽 x — 상자 (x, w) · 카운터 c · 글 폭 tw (0x5a91e~0x5a93a) */
export function skinTickerTextXOf(x: number, width: number, counter: number, textWidth: number): number {
  const period = textWidth + width
  return period > 0 ? x + width - (counter % period) : x + width
}

/**
 * 흐르는 글 하나를 갱신마다 그릴 때 쓸 카운터 값. 그린 **뒤** 3 올리므로 올리기는 그림이 나간 뒤(effect)에 한다.
 * 건너뛴 갱신(그림을 못 낸 틱)도 원본에선 한 번씩 그렸다 — 그만큼 앞당겨 센 값을 돌려준다.
 * ⚠️ 한 그림에 흐르는 글이 여럿인 화면(선수 정보 창 0x5b798 은 다섯 곳)은 원본에서 k 번째 글이 c + 3k 로 그려지고
 *    그림마다 3 × 개수만큼 오른다 — 그런 화면을 옮길 때 이 훅을 넓혀야 한다(지금 쓰는 곳은 글 하나뿐이다).
 */
export function useSkinTickerCounter(tick: number): number {
  const lastDrawnTick = useRef(tick - 1)
  useEffect(() => {
    skinTickerCounter.value += SKIN_TICKER_STEP * Math.max(0, tick - lastDrawnTick.current)
    lastDrawnTick.current = tick
  }, [tick])
  return skinTickerCounter.value + SKIN_TICKER_STEP * Math.max(0, tick - lastDrawnTick.current - 1)
}
