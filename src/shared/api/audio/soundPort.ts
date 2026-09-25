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
 * ## 원본 "예약" `0x6e498` 을 여기 안 넣은 까닭 (디스어셈으로 확정, 2026-09)
 *
 * 원본에는 통로가 둘인 것처럼 보이는 `0x6ea6c play` / `0x6e498 request` 가 있는데,
 * **`request` 는 큐가 아니다.** 직접 떠 보면 이렇다:
 * ```
 * 0006e498: push {r4,r5,r6,lr} ; r4=obj ; r0=obj+0x14(미디어 객체 p) ; r5=n ; r6=(u8)loop
 * 0006e49e: ldrb r3,[r0,#0x11] ; lsls r2,r3,#31 ; bmi 0x6e4b8   ; 지금 소리가 loop(배경음)면 멈추러
 * 0006e4aa: ldrb r3,[r4,#5]    ; (기기 표 플래그) 0 이 아니면 멈추러
 * 0006e4b6: beq 0x6e4bc
 * 0006e4b8: bl 0x6e258                                          ; ← 울리던 소리를 **끊는다**
 * 0006e4bc: ldr r3,[r4,#0x30] ; cmp r3,r5 ; beq 0x6e4ca         ; 같은 번호가 이미 예약돼 있으면 끝
 * 0006e4c6: str r5,[r4,#0x30] ; strb r6,[r2,#4]                 ; 아니면 한 칸을 **덮어쓴다**
 * ```
 * - 칸은 **하나**다 (+0x30 번호, +0x34 loop). 쌓이지 않고 늦게 온 번호가 앞 예약을 버린다.
 * - 같은 번호가 이미 들어 있으면 아무것도 안 한다.
 * - `obj[5]` 는 기기별 예외 플래그인데 초기화 0x6e6a4 가 **맨 끝에서 조건 없이 1 로 쓴다**
 *   (0x6e84c~0x6e852, PHONEMODEL 조회가 성공하기만 하면). 곧 실전에서 **예약은 늘 현재 소리를 끊는다.**
 * - 틱 0x6eac8 이 `+0x30 != -1 && +0x20(미디어 클립) == 0` 이면 예약분을 0x6ea6c 로 튼다.
 *   클립은 플랫폼 콜백(0x6e404 → 0x6e3b0 의 이벤트 3)이 0x6e360 으로 부술 때 0 이 된다.
 * - 거꾸로 `play` 도 들어오자마자 예약 칸을 −1 로 지우고(0x6ea7c), 0x6e9d4 가 "이미 파일이 물려 있다"
 *   (`ldr r3,[r0,#0x14]` ≠ 0)고 거절하면 **스스로 `request` 로 떨어진다**(0x6eaba).
 *
 * 정리하면 원본의 두 통로는 "즉시" 와 "끝날 때까지 기다림" 이 아니라 **"지금 끊고 이번 틱" 과
 * "지금 끊고 다음 틱"** 이다. 한 틱 안에서 무엇을 몇 번 부르든 **마지막 번호만 들리고 앞엣것은 잘린다** —
 * 웹의 통로 하나(`playSoundIds` 가 뒤 소리로 앞 소리를 끊는 것)가 이미 그 결과와 같다.
 * 그래서 `request` 를 따로 두면 들리는 것은 그대로면서 API 만 늘어난다. **넣지 않는다.**
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

/**
 * **지금 앱이 쓰는 소리 통로 하나** — 원본 전역 포인터 `[0x1400058]` 자리다.
 *
 * 원본은 사운드 객체를 전역에 하나 두고 경기 코드가 어디서든 `play(전역, n, -1, loop)` 로 부른다.
 * 웹판도 통로는 하나뿐이라(`useSound`) 화면마다 소품으로 물려 내리는 대신 같은 모양으로 둔다 —
 * 경기 화면들(`pages/team-game` · `pages/pitching` · `pages/home-run-derby`)이 자기를 띄운 길
 * (`app/ui` 의 라우트들)을 거치지 않고 바로 소리를 낼 수 있어야 하기 때문이다.
 *
 * 통로가 아직 안 꽂힌 동안(테스트에서 화면만 따로 그릴 때 등)은 **조용한 포트**로 떨어진다.
 */
let activePort: SoundPort | null = null
const fallbackPort = createSilentSound()

/** 소리 통로를 전역 자리에 꽂는다 — `app/model/useSound` 가 앱 하나에 한 번 부른다. */
export function setActiveSound(port: SoundPort | null): void {
  activePort = port
}

/** 지금 꽂혀 있는 통로. 없으면 조용한 포트 (원본에는 없는 웹판 안전장치다). */
export function activeSound(): SoundPort {
  return activePort ?? fallbackPort
}

/**
 * 번호 목록을 통로에 차례로 넣는다. `null`·`undefined` 는 "울릴 것이 없다" 는 뜻이라 건너뛴다.
 *
 * 통로가 하나뿐이라(원본 0x6e9d4) **뒤에 넣은 소리가 앞 소리를 끊는다** — 목록의 순서는
 * 원본이 부르는 순서 그대로여야 한다.
 */
export function playSoundIds(sound: SoundPort, ids: readonly (number | null | undefined)[]): void {
  for (const id of ids) {
    if (id === null || id === undefined) continue
    sound.play(id)
  }
}
