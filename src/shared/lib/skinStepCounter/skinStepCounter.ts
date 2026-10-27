import { trackCellForSnapshot } from '@/shared/lib/dev/snapshotSlots'
import { useEffect, useId, useSyncExternalStore } from 'react'

/**
 * **키·그림 셈 [skin+0x40c]** — 앱에 하나 (r166, 직접 떴다).
 *
 * 스킨은 앱 초기화 0x2ed8 의 new(0 으로 채움) → 0x53b25 로 한 번 만들어 전역 [0x1552cfc] 에 둔다. 이 객체를 장면들이 그대로 든다 —
 * 메인 메뉴 생성자 0x234d4 가 [this+0x120](23620~23634) · 나리 장면 셋업 0xf684 가 [this+0xd8](f6b0~f6be) · 시즌 장면 0x3b14 가
 * [this+0xa8](3b3c~3b4c) 에 같은 [0x1552cfc] 를 적는다. 그래서 편집기 · 목록 · 판 · 경기설정 창의 +0x40c 는 **모두 한 칸**이다.
 * 리터럴 0x40c 를 읽는 LDR 을 전수(re.py xval 0x40c)하면 이 객체 칸은:
 * ```
 * 0x5561c  엔트리 편집기 열기 — = 0 (556c4~556d0)           ; 부르는 곳: 시즌 0x5870 · 0x5980 · 0x5b28 · 0x5cd0 · 0x63dc ·
 *                                                         ;   0x16af8 · 일반 엔트리 0x2648c · 스페셜 에디트 0x2b2e0 ·
 *                                                         ;   목록 0x5761c(첫 인자 ≠ 0 — 나리 124 연도 기록만)
 * 0x55864  편집기 키 — 불릴 때마다 +1 (55868~55874)
 * 0x5787c  순위 판 키 — 불릴 때마다 +1 (5793e~57948, 쪽이 바뀌든 말든 끝에서)
 * 0x5e8bc  명전 몸 그림 한 걸음 — +1 (5e8be~5e8c8)
 * 0x6042c  경기설정 창 그림 — +1 (60440~6044a)
 * 0x56236 · 0x5796c · 0x5c984 — 읽기만 (커서 꼴 · 쪽 화살 · ▲▼ 깜빡)
 * ```
 * (0x1ec90 · 0x1f24c · 0x213c0 · 0x21c54 · 0x22754 · 0x20ac4 … 의 0x40c 는 다른 객체 · 스택 칸이다.)
 * 0 으로 되돌리는 곳은 0x5561c 뿐이다 — 곧 **화면을 건너 이어진다**. 시즌 기록순위 0xdb(0x56fc → 0x5761c 첫 인자 0) 와 나리 124 순위
 * 갈래는 0x5561c 를 안 지나므로 앞 화면들이 남긴 값에서 센다.
 */
const counter = { value: 0 }
// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다)
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') trackCellForSnapshot('skinStepCounter.counter', counter)
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

/** 지금 [skin+0x40c] */
export const skinStepCounterValue = () => counter.value

/** 앱을 새로 띄운 것과 같다 (스킨 new 의 0 채움) — 시험용 */
export const resetSkinStepCounter = () => {
  counter.value = 0
  drawnBy.clear()
  notify()
}

/** 키 한 번 — 0x55864 · 0x5787c 의 머리 +1. 읽는 판이 다시 그리도록 알린다 */
export const addSkinStepCounter = (count = 1) => {
  counter.value += count
  notify()
}

/**
 * 엔트리 편집기가 든 값을 이 칸에 옮긴다 — 웹 편집기는 [ed+0x40c] 를 제 상태(`keyPresses`)로 들고 0x5561c 의 0 에서 센다.
 * 그 값이 곧 이 칸이므로 그릴 때마다 그대로 적어 둔다(편집기가 닫힌 뒤 다음 화면이 이어 센다).
 */
export const setSkinStepCounter = (value: number) => {
  if (counter.value === value) return
  counter.value = value
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 읽기만 하는 판(0x5796c)이 키로 오른 값을 다시 그리도록 */
export const useSkinStepCounterValue = () => useSyncExternalStore(subscribe, skinStepCounterValue, skinStepCounterValue)

/** 편집기의 값 [ed+0x40c] 을 이 칸에 옮긴다 (`setSkinStepCounter`) */
export function useMirrorSkinStepCounter(value: number) {
  useEffect(() => {
    setSkinStepCounter(value)
  }, [value])
}

/** 그린 부품마다 마지막으로 센 그림 — `useSkinBlinkCounter` 와 같은 꼴 */
const drawnBy = new Map<string, { readonly tick: number; readonly value: number }>()

/**
 * 그릴 때마다 [skin+0x40c] 를 1 올리고 올린 **뒤의** 값을 돌려준다 — 경기설정 창 0x6042c(60440~6044a: 읽고 +1 하고 적은 값으로 나머지).
 * 렌더 차례대로 그 자리에서 올리고, 건너뛴 갱신은 그만큼 앞당겨 센다. 같은 틱을 React 가 다시 그리면 다시 올리지 않는다.
 */
export function useSkinStepDrawCounter(tick: number): number {
  const id = useId()
  useEffect(
    () => () => {
      drawnBy.delete(id)
    },
    [id],
  )
  const last = drawnBy.get(id)
  if (last !== undefined && last.tick === tick) return last.value
  const draws = last === undefined ? 1 : Math.max(0, tick - last.tick)
  counter.value += draws
  drawnBy.set(id, { tick, value: counter.value })
  return counter.value
}
