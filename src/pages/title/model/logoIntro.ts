/**
 * **켤 때 로고 화면** — 장면 0x103 하위 2. 갱신 0x28784 가 로고 객체(0x67989 로 만들고 [this+0x11c] 에 둔다, 진입 0x258c0)의
 * 갱신 `0x69401` 을 부르고, 그 답이 1 이면 하위 3(타이틀)으로 간다. 그리기 0x246b8 은 그 객체의 vtable+0x48 = `0x68c19` 하나다.
 *
 * 로고 객체 갱신 0x69400 (직접 떴다) — 상태 `[+0x94]`, 다음 상태 `[+0x95]`(0x67a74 가 적는다), 상태 틱 `[+0x97]`:
 * ```
 * 머리   [+0x95] ≠ −1 이면 [+0x94] = [+0x95] · [+0x95] = −1 · [+0x97] = 0 (상태는 다음 갱신에 바뀐다)
 * 0      logo.pzx(0xcc154) · certi.pzx(0xd2cbc) 를 올리고 → 1
 * 1      [+0x97] += 2 ; [+0x97] > 그림1 높이 + 10 이면 → 2 · [+0xa4] = 15
 * 2      [+0xa4] −= 1 ; 0 이면 [+0x97] = 0 · → 3 · 0x6ea6d(소리, 0, −1, 0) = 로고 음성 0 한 번
 * 3      [+0xa4] += 1 ; 15 면 지금 시각(ms)을 적고 → 4
 * 4      적은 시각에서 1000ms 를 넘긴 갱신에 → 5
 * 5      인증 0x68280 — 1 이면 객체 답 1(하위 3 타이틀로), 0·−1 이면 인증 창들(6~19)
 * 끝     상태 ≠ 0x14 면 [+0x97] += 1 (상태 1 은 갱신마다 3 씩 오른다)
 * ```
 * 그리기 0x68c18: 상태 ≤ 5 는 흰 바탕(그 밖은 (0xa6,0xe9,0x31)). 그림은 모두 화면 가운데 (W/2, H/2) 에 앵커로 찍는다:
 * ```
 * 1      logo 프레임 0 → 프레임 1 의 사각형을 [+0xa8](x, y, w, h)로 받아(vtable+0x1c) 자르개를
 *        (x, y + h − [+0x97], w, [+0x97]) 로 두고 프레임 1 → 자르개 풀기   ; 아래에서 위로 칠해지는 연출
 * 2      프레임 1 · 효과 1 · 인자 [+0xa4]   ; 반투명 겹치기 L/16 (R6 3a) — 14/16 → 0 으로 빠진다
 * 3      프레임 2 · 효과 1 · 인자 [+0xa4]   ; 1/16 → 15/16 으로 들어온다
 * 4·5    프레임 2 · 효과 0
 * ```
 * ⚠️ 근사: 상태 5 의 인증 0x68280 은 인증 파일(0x681e8)을 폰 고유값(0x14005d8)과 대조하는 폰 전용 절차라 웹은 늘 통과(1)로 둔다 —
 * 인증 창(상태 6~19, certi.pzx 그림 · 키 '1'/'2'·←→)은 옮기지 않았다.
 * ⚠️ 유력: 프레임 1 의 사각형(vtable+0x1c)은 합성 프레임 바운딩 박스(146×118)로 본다 — 그 함수 몸통은 안 읽었다.
 */

/** 로고 그림 경로 — 합성 프레임 0(빈 말풍선) · 1(칠한 말풍선) · 2(GAMEVIL) */
export const LOGO_FRAMES = './sprites/logo/frames'

/** 프레임 1 높이 — 상태 1 의 문턱(높이 + 10)과 자르개 높이가 쓴다 */
export const LOGO_REVEAL_FRAME_HEIGHT = 118

/** 상태 2·3 의 [+0xa4] 시작 값 · 끝 값 */
const FADE_STEPS = 15

/** 상태 4 가 기다리는 시간 (0x69518 `0xfa << 2` = 1000ms, `bhi` — 넘겨야 한다) */
const HOLD_MILLISECONDS = 1000

export type LogoPose =
  /** 아직 아무것도 안 찍었다 (상태 0 — 그리기 표 밖) */
  | { readonly kind: '흰바탕' }
  /** 상태 1 — 프레임 0 위에 프레임 1 을 아래에서 `revealed` 픽셀만큼 */
  | { readonly kind: '칠하기'; readonly revealed: number }
  /** 상태 2·3 — `frame` 을 `weight`/16 로 겹친다 */
  | { readonly kind: '겹치기'; readonly frame: 1 | 2; readonly weight: number }
  /** 상태 4 — 프레임 2 그대로 */
  | { readonly kind: '로고'; readonly frame: 2 }

/** 상태 1 이 끝나는 갱신 번호 k — `3k − 1 > 높이 + 10` 인 가장 작은 k (갱신 #1 부터 3 씩, 검사는 +2 뒤) */
const REVEAL_LAST_UPDATE = (() => {
  let update = 1
  while (3 * update - 1 <= LOGO_REVEAL_FRAME_HEIGHT + 10) update += 1
  return update
})()
/** 상태 2 의 마지막 갱신 — [+0xa4] 가 15 에서 0 이 되는 갱신 (이때 음성 0) */
export const LOGO_VOICE_UPDATE = REVEAL_LAST_UPDATE + FADE_STEPS
/** 상태 3 의 마지막 갱신 — [+0xa4] 가 15 가 되는 갱신 (이때 시각을 적는다) */
const FADE_IN_LAST_UPDATE = LOGO_VOICE_UPDATE + FADE_STEPS

/** 상태 4 를 몇 갱신 머무는가 — 갱신 간격 × j 가 1000ms 를 처음 넘는 j */
function holdUpdatesOf(millisecondsPerUpdate: number): number {
  return Math.floor(HOLD_MILLISECONDS / millisecondsPerUpdate) + 1
}

/** 로고 객체가 답 1 을 내는 갱신 번호 — 상태 4 가 → 5 를 적은 다음 갱신(상태 5 의 인증 통과) */
export function logoDoneUpdateOf(millisecondsPerUpdate: number): number {
  return FADE_IN_LAST_UPDATE + holdUpdatesOf(millisecondsPerUpdate) + 1
}

/**
 * 갱신 `updates` 번을 마친 뒤 그리는 모습 (갱신 #0 이 상태 0). 그리기는 갱신 뒤에 돌아 상태가 바뀐 갱신에서도
 * 아직 앞 상태로 그린다(다음 상태는 다음 갱신 머리에 선다).
 */
export function logoPoseAt(updates: number): LogoPose {
  // 갱신 #k 를 마쳤다 = updates − 1 = k
  const last = updates - 1
  if (last < 1) return { kind: '흰바탕' }
  if (last <= REVEAL_LAST_UPDATE) return { kind: '칠하기', revealed: 3 * last }
  if (last <= LOGO_VOICE_UPDATE) return { kind: '겹치기', frame: 1, weight: LOGO_VOICE_UPDATE - last }
  if (last <= FADE_IN_LAST_UPDATE) return { kind: '겹치기', frame: 2, weight: last - LOGO_VOICE_UPDATE }
  return { kind: '로고', frame: 2 }
}
