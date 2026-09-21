/**
 * 소리를 도메인 밖에서 주입받기 위한 포트.
 *
 * 원본(binary.mod)의 사운드 객체 [0x1400058] 를 그대로 옮긴 모양이다:
 * `0x6ea6c play(obj, n, vol, loop)` · `0x6e438 stopBgm` · `0x6eaf0 resumeBgm` · `0x6e4d0 setVolume`.
 *
 * 원본 규칙 중 일부러 옮겨 온 것:
 * - **소리 통로가 하나뿐**이다. 0x6e9d4 는 새 소리를 틀기 전에 울리던 것을 멈춘다(0x6e258).
 *   그래서 효과음 하나가 배경음을 끊고, 팝업이 끝나면 `resumeBgm` 으로 배경음을 되돌린다.
 * - **소리 크기가 0 이면 아무것도 울리지 않는다.** 다만 배경음이면 번호는 기억해 둔다
 *   (0x6ea76 `ldr r3,[r0,#0x40]; cmp r3,#0` → 0x6ea86 `str r6,[r0,#0x28]`).
 *   나중에 소리를 켜고 `resumeBgm` 을 부르면 그 번호가 울린다.
 * - `stopBgm` 은 기억한 번호(+0x28)와 울리는 번호(+0x2c)가 같을 때만 멈춘다.
 *
 * 번호 → 쓰임 표는 `@/shared/config/original/sounds` 에 있다.
 */
export interface SoundPort {
  /** 효과음·음성 1회 재생 (원본 loop=0). */
  play(id: number): void

  /** 배경음 반복 재생 (원본 loop=1). 같은 번호가 이미 돌고 있으면 그대로 둔다. */
  playBgm(id: number): void

  /** 배경음 멈추기 (원본 0x6e438). */
  stopBgm(): void

  /** 기억해 둔 배경음을 다시 튼다 — 팝업·일시정지 뒤 복귀 (원본 0x6eaf0). */
  resumeBgm(): void

  /** 지금 기억하고 있는 배경음 번호. 없으면 null. */
  currentBgm(): number | null

  /** 소리 크기 0~100. 원본 환경설정은 칸 값(0~4) × 25 를 넣는다. */
  setVolume(volume: number): void
  getVolume(): number
}

/** 소리를 내지 않는 포트. 테스트와 소리 없는 환경에서 쓴다. */
export function createSilentSound(): SoundPort {
  let volume = 0
  let bgmId: number | null = null
  return {
    play: () => {},
    playBgm: (id) => {
      bgmId = id
    },
    stopBgm: () => {
      bgmId = null
    },
    resumeBgm: () => {},
    currentBgm: () => bgmId,
    setVolume: (next) => {
      volume = Math.max(0, Math.min(100, Math.round(next)))
    },
    getVolume: () => volume,
  }
}
