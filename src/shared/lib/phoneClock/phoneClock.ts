/**
 * 휴대폰 시계와 시간대 — 경기장 띠 · 엔딩 띠 · 훈련/외출 창 배경(mode_back) · 외출 지도 밤이 쓴다 (직접 떴다).
 *
 * ```
 * 0x6f390(시*, 분*, 초*)  ms = 0x14005c8()(휴대폰 시계, 64비트 밀리초)
 *                         초 = ms / 1000 ; [초*] = 초 mod 60 ; 분 = 초 / 60 ; [분*] = 분 mod 60 ; 시 = 분 / 60
 *                         [시*] = (시 + 9) mod 24                  ; 부호 없는 64비트 나눗셈 — 한국 시각(UTC+9)
 * 0xb8fbc()               시 − 6 ≤ 9 (6~15) → 0 낮 · 시 − 16 ≤ 3 (16~19) → 1 저녁 · 그 밖 → 2 밤
 * 0x7b934(gfx, t)         t ≠ [gfx+0x1c] 이면 [gfx+0x1c] = t ; 0xb9c35("ui/mode_back.mpl", [gfx+0x18], t == 0 ? −1 : t − 1)
 * ```
 * 0x7b934 를 부르는 곳은 나리 장면 상태 100 진입 0x1c154 끝(1c418~1c424, gfx = [장면+0xe0])과 시즌 장면 진입 0xcb 0x4b50 끝
 * (4c7a~4c8a, gfx = [장면+0xc0]) 둘뿐이다 — 시간대는 **장면에 들어설 때 한 번** 잡히고 그 장면이 서 있는 동안 남는다.
 * 그림 0x7b9ac 는 mode_back 의 프레임 [gfx+0x1c] 를 그 팔레트로 그린다.
 */
import { createContext, useContext, useState } from 'react'

/** 0x6f390 의 시 — 밀리초 시계를 시로 내려 9 를 더하고 24 로 나눈 나머지 (기기 지역 시간대를 보지 않는다) */
export function koreanHourOf(epochMilliseconds: number): number {
  const seconds = Math.floor(epochMilliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  return (hours + 9) % 24
}

/** 0xb8fbc 의 시간대 — 0 낮 · 1 저녁 · 2 밤 */
export type TimeSlot = 0 | 1 | 2

export function timeSlotOfHour(hour: number): TimeSlot {
  if (hour - 6 >= 0 && hour - 6 <= 9) return 0
  if (hour - 16 >= 0 && hour - 16 <= 3) return 1
  return 2
}

/** 0x7b934 의 mode_back.mpl 줄 — 시간대 0 은 −1(PZX 기본 팔레트 = 구워 둔 PNG)이라 null */
export function modeBackPaletteOf(slot: TimeSlot): number | null {
  return slot === 0 ? null : slot - 1
}

/** 지금 휴대폰 시계의 한국 시각 */
export function currentKoreanHour(): number {
  return koreanHourOf(Date.now())
}

/**
 * 장면에 들어설 때 잡아 둔 한국 시각 — 나리 · 시즌 라우트가 내려 준다(`useSceneEntryHour`).
 * 라우트 밖(시험 · 따로 그린 화면)은 null 이라 지금 시각을 쓴다.
 */
export const SceneHourContext = createContext<number | null>(null)

/** 이 화면이 속한 장면의 시각 (없으면 지금 시각) */
export function useSceneHour(): number {
  const captured = useContext(SceneHourContext)
  return captured ?? currentKoreanHour()
}

/**
 * 장면 진입 때 시각을 잡는다 — `isInScene` 이 거짓에서 참이 되는 그리기(처음 서는 그리기 포함)에 0x6f390 을 한 번 부르고,
 * 장면 밖(경기 장면 0x104 등)에 있는 동안은 마지막 값을 둔다. 라우트가 내려갔다 다시 서면 새로 잡는다(장면이 새로 선다).
 */
export function useSceneEntryHour(isInScene: boolean): number {
  const [entry, setEntry] = useState(() => ({ isInScene, hour: currentKoreanHour() }))
  if (entry.isInScene !== isInScene) {
    // 그리는 중에 앞 값과 견줘 고친다 — 들어선 그 그리기부터 새 시각이다
    const next = { isInScene, hour: isInScene ? currentKoreanHour() : entry.hour }
    setEntry(next)
    return next.hour
  }
  return entry.hour
}
