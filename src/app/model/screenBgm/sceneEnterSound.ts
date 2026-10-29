import { useEffect, useRef } from 'react'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { Screen } from '@/app/model/screen'

/**
 * 화면에 **들어설 때 한 번** 나는 효과음·음성 (배경음이 아니다). 지금은 없다.
 *
 * 로고 음성 0 은 들어설 때가 아니라 켤 때 로고(하위 2) 객체의 상태 2 끝(0x694c4 `0x6ea6d(소리, 0, −1, 0)`)에 난다 —
 * `LogoScreen` 이 그 갱신에 부른다. 타이틀(하위 3) 진입은 소리를 안 낸다. 앞 화면 `<이용안내>` 에서 한 번 눌렀으니
 * 브라우저 자동 재생 막기(`useSound` 머리 주석)에도 걸리지 않는다.
 */
export const SCREEN_ENTER_SOUND = {} as const satisfies Partial<Record<Screen['kind'], number>>

/**
 * 들어설 때 울리던 소리를 끊는 화면 — 환경설정(하위 8) 진입 0x259fc 의 끝 0x25aac~0x25ab6 `0x6e419(소리)` (= 0x6e418 소리 끊기,
 * 기억한 배경음도 잊는다). 하위 페이지(0x20 · 0x21)에서 돌아오는 진입도 같은 끝을 지나지만 그때는 이미 끊긴 뒤다.
 */
export function stopsSoundOnEnter(screen: Screen): boolean {
  return screen.kind === '환경설정'
}

/** 화면이 바뀌어 `stopsSoundOnEnter` 화면에 들어선 그리기에서 한 번 `sound.stop()` */
export function useSceneEnterStop(sound: SoundPort, screen: Screen): void {
  const lastKindRef = useRef<Screen['kind'] | null>(null)
  const stops = stopsSoundOnEnter(screen)
  useEffect(() => {
    if (lastKindRef.current === screen.kind) return
    lastKindRef.current = screen.kind
    if (stops) sound.stop()
  }, [sound, screen.kind, stops])
}

/**
 * **이어하기 길의 137 앞에서 배경음을 끊는다** — 상태 100 진입 0x1c154 의 머리 1c15e 가 `0x6e439([0x1400058])` = stopBgm 을 부른다.
 * 그 뒤 100 · 1 · 105(한 틀 — 0x1aec4 의 4 는 머문 틀 2 에만) · 115 · 114(내장 연초라 40 안 틂) · 137 · 105(이전 137 은 목록 밖) ·
 * 115 · 114 를 지나 연초 이벤트 뒤 105(이전 114)에서야 4 가 운다 — 그동안 소리가 없다. 웹은 표지가 이어하기 길에서 섰을 때
 * (`fromResume`) 한 번 멈춘다. 다른 이어하기 길(100 → 1 → 105 · 109 · 116 · 128 · 134 · 141 …)의 1c15e 는 세션이 들어서는 때에
 * 끊는다 — 타자편 `continueSaved` · 투수편 화면이 서는 효과(r163). 이 훅은 표지 길에서 한 번 더 끊을 뿐이다(같은 결과)
 */
export function useResumeCoverStop(sound: SoundPort, isResumeCover: boolean): void {
  const wasRef = useRef(false)
  useEffect(() => {
    const was = wasRef.current
    wasRef.current = isResumeCover
    if (isResumeCover && !was) sound.stopBgm()
  }, [sound, isResumeCover])
}

/** 이 화면에 들어설 때 낼 효과음. 없으면 null */
export function screenEnterSoundOf(screen: Screen): number | null {
  const table: Partial<Record<string, number>> = SCREEN_ENTER_SOUND
  return table[screen.kind] ?? null
}
