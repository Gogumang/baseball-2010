import { useEffect, useRef } from 'react'

/**
 * **깜빡임 카운터 [skin+0x410]** — 앱에 하나 (U-90 닫음, 직접 떴다).
 *
 * 스킨은 앱 초기화 0x2ed8 의 new(0 으로 채움) → 0x53b25 로 한 번 만들어 전역 [0x1552cfc] 에 둔다. +0x410 을 만드는 상수
 * `movs #0x82 ; lsls #3` 를 .text 전체에서 훑으면(리터럴 0x410 을 읽는 LDR 은 없다) 쓰는 곳은 모두 **그리기 머리의 +1** 뿐이고
 * 0 으로 되돌리는 곳은 없다:
 * ```
 * 0x2e2dc  기록연감 그리기 0x2e29c          ; 그 뒤 % 8 ≤ 3
 * 0x553f0  머리띠 0x54d94 — 바닥비트 0x40("0경기설정")일 때만 ; 그 뒤 % 18 ≤ 8
 * 0x58d14  공용 뷰어 0x58d10 (0x639a4 — 도움말 상태 7 · 경기 중 [조작방법]) ; % 8 ≤ 3
 * 0x593ce  공용 설정 페이지 0x593c8 (환경설정 8 · 0x20 · 0x21 · 경기 중 [설정]) ; % 8 ≤ 3
 * 0x5d056  G포인트 충전 0x5d054 (🌐 웹 없음)
 * 0x579ca  순위 판 0x5796c — 읽기만
 * ```
 * 곧 처음 값은 앱을 켤 때 0 이고, 위 화면들이 그릴 때마다 함께 하나씩 올린다 — **화면을 건너 이어진다**. 읽는 값은 올린 뒤의 값이다.
 */
const skinBlinkCounter = { value: 0 }

/** 지금 [skin+0x410] — 읽기만 하는 화면(순위 판 0x5796c) · 시험용 */
export const skinBlinkCounterValue = () => skinBlinkCounter.value

/** 앱을 새로 띄운 것과 같다 — 시험용 */
export const resetSkinBlinkCounter = () => {
  skinBlinkCounter.value = 0
}

/**
 * 그릴 때마다 [skin+0x410] 을 `perDraw` 만큼 올리고 올린 **뒤의** 값을 돌려준다(0x593ce~0x593dc: 읽고 +1 하고 적은 값으로 나머지를 본다).
 * 건너뛴 갱신도 원본에선 한 번씩 그렸으니 그만큼 앞당겨 센다. `perDraw` 0 이면 이 그림에서는 안 올린다(머리띠의 바닥비트 0x40 이 없을 때).
 */
export function useSkinBlinkCounter(tick: number, perDraw = 1): number {
  const lastDrawnTick = useRef(tick - 1)
  useEffect(() => {
    skinBlinkCounter.value += perDraw * Math.max(0, tick - lastDrawnTick.current)
    lastDrawnTick.current = tick
  }, [tick, perDraw])
  return skinBlinkCounter.value + perDraw * Math.max(0, tick - lastDrawnTick.current)
}
