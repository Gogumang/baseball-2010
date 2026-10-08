/**
 * **경기 장면 상태 0x16 — 교체 연출** (팀경기 · 나리 타자편 · 투수편 · 미션 공용 그림 — 경기 화면은 `useSubstitutionScene`).
 *
 * 들어오는 길: 교체 화면 0xb 의 OK(0x496f0) · 0xf 진입 0x3d954 의 CPU 대타 0xac228 / CPU 투수 교체 0xac428 이 참일 때
 * (3da88 22 "Time!" → 3da94 상태 0x16). 0x16 은 진입 0x3d458 과 그리기 0x4da30 만 있고 키 · 갱신이 없다(R10 표).
 *
 * ```
 * 3d458  진입: +0x1959 = 0 · +0x195c = 0 · +0x196c = −1(컷인 단계)
 *        대타 예약 [공격 팀+0x291] 이면 +0x195c = 1(마선수면 5) · +0x1959 = 1 · +0x197c = 1 · 0xaebe4 교체 확정
 *        투수 예약 [수비 팀+0x290] 이면 +0x195c = 2(마선수면 6) · +0x1959 = 1 · +0x197c = 2 · 0xaebe4 교체 확정
 * 3d652  game_ui([장면+0x1018]) 애니 9(애니 표 칸 [+0x24]) 를 0x93d31(애니, 1)(멈춤 · 첫 칸 · 끝 비트 지움) →
 *        0x93cfd(애니, 0)(재생 · 반복 없음 · 칸 틱 0) 으로 처음부터 다시 건다
 * 4da30  그리기: 타석 그림 그대로(0x38d1c 배경 · 0x35b94 · 0x49e64 · 파티클 0xbe6a1 · 0x42f2c · 0x4c4bc)
 *        (w, h) = 0xba815(game_ui, 프레임 0x51, 종류 1) — 프레임 81 의 합집합 상자
 *        0xba759(game_ui, 애니 9, 종류 2, W/2 − (w >> 1), H/2 − (h >> 1), …, 진행 1)   ; 그리고 한 칸 진행 0x93d91
 *        +0x195c 비트 2(들어온 선수가 마선수)면 4dafa 0x473f0 마선수 등장 컷인 — 컷인이 단계 22 에 메시지 13 을 보낸다
 *        아니면 애니 끝 비트([[애니+8]+2] & 4) 가 섰을 때 4daf0 0xbcb49(…, 0xd) → 0xd
 * ```
 * 0x93d91(직접 뜸, 0x93d90~0x93e3a): 칸 틱 = (틱 + 1) mod max(1, 지연) — 0 으로 돌면 칸 + 1 · 끝 비트를 내리고, 칸이 0 으로
 * 돌면 끝 비트를 세운다. 반복이 아니면(+2 비트 4 꺼짐) 마지막 칸에 멈춘다(0x93d30(애니, 0)). 그리기가 먼저라 **애니를 다 돈
 * 그림(지연 합 = 17 번째 그림)이 끝 비트를 보고 0xd 를 보낸다** — 마지막 칸(84)을 그린 그림이다.
 *
 * 애니 9 = 프레임 79 · 80 · 81 · 82 · 83 · 84 (지연 2 · 2 · 2 · 7 · 2 · 2) — "CHANGE" 글자가 왼쪽에서 미끄러져 들어와 선다
 * (game_ui/frames/animations.json 그대로, 시험이 맞춰 본다).
 *
 * ⚠️ 미이식: 마선수 등장 컷인 0x473f0(R2 11절 — event_char 초상 · 검붉은 띠 · 사선 쓸기, 단계 22 에 끝). 들어온 선수가 마선수면
 *    원본은 같은 CHANGE 애니 위에 컷인을 그리고 컷인이 끝나야 0xd 로 간다 — 웹은 CHANGE 애니 끝에 넘긴다(근사).
 */

/** game_ui 애니 9 — 0x4da30 이 0xba759(…, 9, 종류 2, …) 로 그린다 */
export const SUBSTITUTION_ANIMATION_INDEX = 9

/** game_ui 애니 9 의 칸 (animations.json [9]) */
export const SUBSTITUTION_ANIMATION: readonly { readonly frame: number; readonly delay: number }[] = [
  { frame: 79, delay: 2 },
  { frame: 80, delay: 2 },
  { frame: 81, delay: 2 },
  { frame: 82, delay: 7 },
  { frame: 83, delay: 2 },
  { frame: 84, delay: 2 },
]

/** 0xba815(game_ui, 0x51, 종류 1) — 프레임 81 의 상자 (origins.json 081: 98×19) */
export const SUBSTITUTION_FRAME_BOX = { frame: 0x51, width: 98, height: 19 } as const

/** 타석 캔버스 W × H (0x14008b8 · 0x14008c8) */
const SCREEN = { width: 240, height: 320 } as const

/** 애니를 거는 자리 — (W/2 − (w >> 1), H/2 − (h >> 1)) = (71, 151) */
export const SUBSTITUTION_ANCHOR = {
  x: (SCREEN.width >> 1) - (SUBSTITUTION_FRAME_BOX.width >> 1),
  y: (SCREEN.height >> 1) - (SUBSTITUTION_FRAME_BOX.height >> 1),
} as const

/** 0x16 에 머무는 그림 수 — 지연 합(max(1, 지연)). 마지막 그림이 끝 비트를 보고 0xd 를 보낸다 */
export const SUBSTITUTION_SCENE_DRAWS = SUBSTITUTION_ANIMATION.reduce((total, entry) => total + Math.max(1, entry.delay), 0)

/**
 * 0x16 의 `draw` 번째 그림(0 부터)에 그리는 프레임 — 그리기가 진행보다 먼저라 그림 0 이 첫 칸이다.
 * 끝난 뒤(`SUBSTITUTION_SCENE_DRAWS` 이상)는 마지막 칸에 멈춰 있다 (반복 없음).
 */
export function substitutionFrameAt(draw: number): number {
  let remaining = Math.max(0, Math.floor(draw))
  for (const entry of SUBSTITUTION_ANIMATION) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return SUBSTITUTION_ANIMATION[SUBSTITUTION_ANIMATION.length - 1].frame
}

/** `draw` 번째 그림이 끝 비트를 보고 0xd 를 보내는가 */
export function isSubstitutionSceneLastDraw(draw: number): boolean {
  return draw >= SUBSTITUTION_SCENE_DRAWS - 1
}

/**
 * 교체 연출 한 번 — 세션이 0xf 진입에서 교체가 나면 싣는다. `serial` 이 바뀌면 화면이 새로 센다.
 * 들어온 선수의 등판음(0x38b64 — 마선수 26 · 2·3루 주자 15 · 그 밖 14)은 0x16 이 아니라 0xe 그리기(0x38d1c 의 38dc2)가
 * 내므로 0x16 이 끝나고 0xd 두 그림 뒤다.
 */
export interface SubstitutionScene {
  readonly serial: number
  /** 들어온 선수가 마선수인가 — 원본은 컷인 0x473f0 을 더 그린다(⚠️ 미이식) */
  readonly incomingIsAce: boolean
  /** 0xe 에서 낼 등판음 */
  readonly entrySoundId: number
  /**
   * 0x16 에 들어서기 전에 낼 "Time!" 22 (3da88) — 연출을 세우는 화면이 연출 첫 그림에서 낸다. CPU 교체이고 진행기가 22 를
   * 따로 안 낼 때만 싣는다(사람 `#` 교체는 교체 창 진입 0x3ae08 이 이미 냈다). 없으면 안 낸다.
   */
  readonly timeSoundId?: number
  /**
   * 지금 0xe 대기(`SceneConfirmWait`)가 이 연출 **앞에** 받을 OK 수 — 진행기가 OK 뒤 굴림을 0xe 에 들어서는 걸음에서 미리 다 해 둔
   * 경우(나리 타자편 `prepareMyAtBat`: 0xe → OK → 0xf 진입 CPU 교체 → 0x16 → 0xd → 0xe) 첫 OK 를 받은 뒤에 연출이 선다.
   * 없으면 0 — 대기를 세우는 걸음이 곧 연출을 세우는 걸음이다.
   */
  readonly confirmsBefore?: number
}

/** 0x38b64 의 고르기 — 마선수 26 · 2루나 3루 주자 15 · 그 밖 14 (투수 가지 · 타자 가지 같은 번호) */
export function substitutionEntrySoundIdOf(input: {
  readonly isAce: boolean
  readonly bases: { readonly second: boolean; readonly third: boolean }
}): number {
  if (input.isAce) return 26
  return input.bases.second || input.bases.third ? 15 : 14
}

/** 3da88 "Time!" — 0xf 진입 0x3d954 가 CPU 교체를 받자마자 0x6ea6d(소리, 0x16, −1, 0) */
export const SUBSTITUTION_TIME_SOUND = 22
