/**
 * **판 안의 판정 콜** — 플레이 틱 꼬리 b4540~b4584 가 결과 코드를 메시지 0xbba 로 보내면 그 자리에서 콜이 난다.
 *
 * ```
 * b4540  이번 틱 vt90 결과 ≠ 0 → 코드 13 (b4556, 포구 b4292 의 9 · 6d 절 0x9d5bc 의 코드를 덮는다)
 * b4562  코드 ≠ 0 → vt44 = 0xb2bc4(코드) · vt54 = 0xb2c58(코드) · 0xbfbac([플레이+0x30], 0xbba, 코드, 0)
 * bfbac  → 0xbfb78 → [받는 곳]의 vtable +0xc 를 곧바로 부른다(bfb9a~bfb9c, 큐가 아니다).
 *        경기 장면 vtable 0xcfa30 의 +0xc(0xcfa3c) = 0x509a1 — 메시지 처리기 0x509a0 → 0xbba 갈래 0x51a56
 * 51a56  결과 판 타이머 10 · 코드 · 공 가진 야수 → 51a8c 0x39578 → 51a94 v − 1 ≤ 12 면 점프표 0xd0488[v − 1]
 * ```
 * 표 0xd0488(직접 읽음): 1 0x51aa2 · 2 0x51ac2 · 3 0x51aca · 4 0x51b08 · 5 0x51bf6 · 6 0x51d32 · 7 0x51c5c · 8 0x51c82 ·
 * 9 0x51c14 · 10 0x51d24 · 11 0x51b20 · 12 0x51c82 · 13 0x51b36. 판(상태 0x17)에서 나는 코드는 6~13 이다
 * (포구 b4292 의 9, 0x9d5bc 의 6 · 7 · 8 · 10 · 11 · 12, b4556 의 13). 소리는 모두 즉시 play 0x6ea6c(…, −1, 0):
 * - 6 · 10 (안타 사건 0xa5ffc) — 소리 없음
 * - 7 → **25** "Foul!" (51c5c~51c72, 조건 없음 — 연속 파울 기록 0xa7dbc 도 같은 자리)
 * - 8 · 12 → **11** 홈런 함성 (51c82~51c92, 조건 없음)
 * - 9 → **17** "Safe!" (0x51c14 — 아래 `SAFE_CALL_SOUND` 주석)
 * - 11 → **62** (0x51b20 → 0xa7d0c 아웃 사건 → 51b2e `movs r1,#0x3e`, 조건 없음 — 2스트라이크 번트 파울 아웃)
 * - 13 → state[0x1f](바운드 없이 잡은 아웃) || state[0x87](그 아웃을 낸 판정이 태그) 이면 **62**, 아니면 **20** (0x51b36~0x51b4c)
 *
 * 메시지는 결과 코드가 선 **틱마다** 간다(판 결과 칸은 첫 번째만 적지만) — 한 판에 콜이 여러 번 날 수 있다(포구마다 9 등).
 */
export interface JudgeCallContext {
  /** state[0x1f] — 바운드 없이 잡은 아웃 (쥐기 0xb2774). 주자 판에는 타구가 없어 늘 거짓 */
  readonly caughtOnTheFly: boolean
  /** state[0x87] — 그 틱의 아웃 판정(0xb36d0)이 태그였다 */
  readonly tagOut: boolean
}

/**
 * 결과 코드 9 의 콜 **17** — 0x51c14 (직접 뜸):
 * ```
 * 51c14  [[r4]+0x118](플레이 종류) == 4 || == 5 → 51c38 곧장 17 (51c3a movs r1,#0x11 → 51b18 → 51c54 play)
 * 51c26  r0 = [0x1400058](소리 객체) ; [r0+5] ≠ 0 → 51c38 17
 * 51c40  [r0+0x14] == 0 → 51c4e 17 (51c50 movs r1,#0x11 → 51c54 play) ; ≠ 0 → 소리 없이 0x51d40
 * ```
 * 소리 객체 두 칸의 뜻(직접 뜸, 2026-10-16):
 * - `+5` — 기기 예외 바이트. 생성자 0x6e8dc 끝 0x6e93a 가 부르는 초기화 0x6e6a4 가 MC_knlGetConfig("PHONEMODEL") 성공(0x6e706 `r0 == 0`)이면
 *   기기 이름 비교를 다 마친 뒤 **조건 없이** `0x6e852 strb #1,[obj,#5]` 로 1 을 쓴다(실패면 0x6e710 → 0x6e854 로 통째로 건너뜀).
 *   이 칸에 쓰는 곳은 그것과 0x6e7b8(기기 갈래, 역시 1) 둘뿐이다(.text 의 `strb …,#5` 전수 중 [0x1400058] 을 읽은 곳). 0 을 쓰는 곳은 없다.
 * - `+0x14` — 미디어 칸 p(obj+0x14, 0x6e204 가 0 으로 시작)의 첫 워드 = **물린 소리 파일 버퍼**. 소리가 실려 있는 동안 ≠ 0 이고,
 *   클립이 끝나면(콜백 이벤트 3 → 0x6e360) 0x6e394 `str 0,[p]` 로 지운다. 0x6e9d4 도 이 칸이 서 있으면 지금 소리를 멈추고 false 를 준다.
 * 곧 "기기 표 조회가 됐으면 늘 17, 안 됐으면 지금 소리가 없을 때만 17" 이다. 실기에서 PHONEMODEL 조회는 성공하므로
 * (같은 스텁을 쓰는 다른 11곳도 모두 0 을 성공으로 읽는다 — L-sound-effects 1-A2) **종류와 상관없이 17** 이다.
 * 웹은 조회가 성공한 기기로 본다 — 예약 0x6e498 의 "늘 끊는다"(obj[5] = 1, `soundPort` 머리 주석)와 같은 전제다.
 */
export const SAFE_CALL_SOUND = 17
/** 13 의 태그·뜬공 아웃 · 11 — 0x51b4c / 0x51b30 `movs r1,#0x3e` */
export const CAUGHT_OUT_CALL_SOUND = 62
/** 13 의 포스 아웃 — 0x51bd8 갈래 */
export const FORCE_OUT_CALL_SOUND = 20
/** 7 — 0x51c6a `movs r1,#0x19` */
export const FOUL_CALL_SOUND = 25
/** 8 · 12 — 0x51c8a `movs r1,#0xb` */
export const HOME_RUN_CALL_SOUND = 11

/** 결과 메시지 0xbba(코드)가 그 자리에서 내는 콜 번호 — 소리가 없는 코드면 null */
export function judgeCallSoundIdOf(messageCode: number, context: JudgeCallContext): number | null {
  switch (messageCode) {
    case 7:
      return FOUL_CALL_SOUND
    case 8:
    case 12:
      return HOME_RUN_CALL_SOUND
    case 9:
      return SAFE_CALL_SOUND
    case 11:
      return CAUGHT_OUT_CALL_SOUND
    case 13:
      return context.caughtOnTheFly || context.tagOut ? CAUGHT_OUT_CALL_SOUND : FORCE_OUT_CALL_SOUND
    default:
      return null
  }
}

/**
 * **미리 돌린 주자 판의 콜을 재생 화면이 내는가** — 판(`played`)이 이번 걸음에 재생 칸(`lastDefensePlay`)에 새로 들어가고 그릴 틱이
 * 있으면 화면(`DefensePlayback` 의 재생 갈래)이 그 판을 재생하며 진행기가 그림에 실은 소리(`tickSoundIds` — 판정 콜 · 자동 슬라이딩)를
 * 기록된 틱에 낸다. 그러면 판을 연 자리(세션)는 콜을 다시 내지 않는다. 재생하지 않는 판(자동으로 넘긴 타석 등)만 세션이 그 자리에서 낸다
 */
export function replayCallsOnScreen(
  beforeReplay: object | null,
  afterReplay: { readonly ticks: readonly unknown[] } | null,
  played: object | null | undefined,
): boolean {
  return played != null && afterReplay === played && beforeReplay !== played && afterReplay.ticks.length > 0
}
