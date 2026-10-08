import type { SoundPort } from '@/shared/api/audio/soundPort'

/**
 * **이벤트 명령 6 — 소리** (실행기 0x8cf64 의 갈래 0x8d470~0x8d4be, 직접 떴다):
 * ```
 * 8d47a  n = 명령[4] − 1                                   ; 데이터의 번호는 파일 번호 + 1
 * 8d47e  n ∈ {1, 3, 4, 0x28, 0x21, 0x2e, 0x2f, 0x34, 0x2c} → loop = 1
 * 8d4a6  그 밖은 0x6e438(소리)                              ; 배경음 멈추기 (기억한 번호 = 울리는 번호일 때만)
 * 8d4bc  0x6ea6d(소리, n, −1, loop)                        ; 즉시 재생
 * ```
 * 반복 목록은 메뉴 1 · 준비 3 · 관리 4 · 이벤트 40 · 경기 33 · 엔딩 46 · 47 · 52 · 벤치클리어링 44 — 배경음들이다.
 */
const EVENT_LOOP_FILES: ReadonlySet<number> = new Set([1, 3, 4, 0x28, 0x21, 0x2e, 0x2f, 0x34, 0x2c])

/** 이벤트 데이터의 소리 번호 → 파일 번호와 반복 여부 */
export function eventSoundCueOf(id: number): { readonly file: number; readonly loop: boolean } {
  const file = id - 1
  return { file, loop: EVENT_LOOP_FILES.has(file) }
}

/**
 * 명령 6 을 통로에 넣는다. 원본 0x6ea6c 처럼 같은 배경음이 돌고 있어도 처음부터 다시 튼다(`playBgm`).
 */
export function playEventSound(sound: SoundPort, id: number): void {
  const { file, loop } = eventSoundCueOf(id)
  if (loop) return sound.playBgm(file)
  sound.stopBgm()
  sound.play(file)
}
