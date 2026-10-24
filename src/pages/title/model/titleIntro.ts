import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import type { AnimationEntry } from '@/shared/lib/sprite/useFrameOrigins'

/**
 * 원작 타이틀 — `mainui/main_title.pzx` 의 **애니 0 · 1 을 프레임 그대로** 돌린다 (2026-10-24 직접 뜸).
 *
 * 적재 0x258fc (0x25966~0x259d2):
 * ```
 * 25974  0xb9719("mainui/main_title.pzx") → [this+0x90]
 * 2598e  0x93d31(애니 0, 1) · 259a6 0x93cfd(애니 0, **0**)   ; 한 번만 — 끝나면 마지막 칸에 선다
 * 259be  0x93d31(애니 1, 1) · 259d2 0x93cfd(애니 1, **1**)   ; 되풀이 (0x93cfd 둘째 인자 ≠ 0 → 깃발 0x10)
 * ```
 * 그리기 0x2cbac:
 * ```
 * 2cbbc  0x6a735(화면, 0)                                       ; 화면을 검정으로 지운다
 * 2cbe2  0xba759(main_title, 0, 종류 2(애니), x 0, y 0, 효과 0, …, 진행 1)   ; 애니 0 을 그리고 한 칸 넘긴다
 * 2cbf2  애니 0 의 끝 깃발(+2 의 비트 2)이 안 섰으면 끝
 * 2cc14  0xba759(main_title, 1, 종류 2, 0, 0, 효과 0, …, 진행 1)            ; 애니 1 "PRESS ANY KEY"
 * 2cc78~  저작권 프레임 18 · 판 번호 num 131 · 전체이용가 이미지 7
 * ```
 * 넘기기 0x93d91: 칸마다 max(1, 지연) 번 넘기면 다음 칸, 마지막 칸을 넘기면 끝 깃발(비트 2)을 세우고
 * 되풀이가 아니면 마지막 칸에 멈춘다(93e16~93e30). 그리기가 **그린 뒤 넘기므로** 애니 0(지연 합 20)은 그리기 0~19 에서
 * 칸을 차례로 보이고, 20 번째 그리기(차례 19)가 넘기면서 깃발이 선다 — 그 그리기의 2cbf2 부터 애니 1 · 저작권이 함께 그려진다.
 * (예전 웹은 파서가 못 읽던 시절의 자세 표(16 그리기 · 그림 조각 직접 배치)였다.)
 *
 * 두 애니 모두 부른 쪽 효과 0 이라 프레임 그리기 0xc9f98 이 파트 효과를 따른다 — 흙먼지(그림 4)의 0x67 은 화면에 더하고
 * (겹 `frames/layers.json`), 0x66 반투명 · 0x6E/0x6F 채우기는 구운 프레임대로다.
 *
 * **키를 보는 차례 (r148 직접 뜸 — 장면 0x103 틀 0x32fa0)**:
 * ```
 * 32fb8  0xbc9c9(this+0x18)   ; 예약된 다음 상태를 적용
 * 32fc0  0xbca05(this+0x18)   ; 이번 틱 키 [this+0x40] = 지난 틱 뒤 들어온 키(0xbca04 가 먼저 +0x28 · +0x38 · +0x3c 를 지운다 — 쌓아 두지 않는다)
 * 32fce  상태가 바뀌었으면 진입(0x3299c) · 배경음(0x24ab8)
 * 32fe0  갱신 0x32634 → 하위 3 타이틀 0x245f8   ; 깃발이 섰고 [this+0x40] ≠ 0 이면 0xbcb49(this+0x18, 4) **예약**
 * 32fe6  그리기 0x32dd8 → 0x2cbac               ; 그린 뒤 애니를 넘기며 깃발을 세운다
 * ```
 * 깃발은 그리기 차례 19 가 세우므로 그 틀의 갱신은 아직 못 보고, 차례 20 틀의 갱신이 처음 본다. 그 틀의 키는 차례 19 를
 * 그린 뒤 들어온 키뿐이라 **"PRESS ANY KEY" 가 선 그리기(19) 뒤에 누른 키부터 받는다** — 웹 `isSettled` 판정 그대로다.
 * 받은 키는 예약이라 그 틀의 그리기는 타이틀을 한 번 더 그리고, 다음 틀의 0xbc9c9 가 하위 4 를 세운다 —
 * 곧 그리기 d 가 보이는 동안 누른 키는 d + 1 을 그린 뒤 d + 2 틀에 메뉴로 넘어간다(`TITLE_KEY_FRAMES_TO_MENU`).
 */

export const TITLE_FRAMES = './sprites/main_title/frames'

/** 애니 0 — 인트로 (frames/animations.json [0], 테스트가 맞춰 본다) */
export const INTRO_ANIMATION: readonly AnimationEntry[] = [
  [0, 2], [1, 2], [2, 2], [3, 1], [4, 1], [5, 1], [7, 0], [6, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0],
  [15, 0], [13, 0],
].map(([frame, delay]) => ({ frame, delay }))

/** 애니 1 — PRESS ANY KEY: 13(문구 없음) → 16(흐림) → 17(밝음) → 16 (frames/animations.json [1]) */
export const PROMPT_ANIMATION: readonly AnimationEntry[] = [
  [13, 2], [16, 1], [17, 4], [16, 1],
].map(([frame, delay]) => ({ frame, delay }))

/** 애니 0 을 다 넘기는 데 드는 그리기 수 (지연 0 은 1) */
const INTRO_DRAWS = INTRO_ANIMATION.reduce((total, entry) => total + Math.max(1, entry.delay), 0)

/** 끝 깃발이 서는 그리기 차례 — 이 그리기부터 애니 1 · 저작권 · 판 번호 · 전체이용가를 그리고 키를 받는다 */
export const INTRO_FRAME_COUNT = INTRO_DRAWS - 1

/** 받은 키가 메뉴(하위 4)로 넘기기까지의 틀 수 — 다음 틀 갱신이 키를 보고 예약, 그다음 틀에 적용 (0x32fa0 차례) */
export const TITLE_KEY_FRAMES_TO_MENU = 2

export interface TitleScene {
  /** 그리기 차례 (0 부터) */
  readonly draw: number
  /** 애니 0 의 지금 프레임 (끝나면 마지막 칸 13 에 선다) */
  readonly introFrame: number
  /** 애니 1 의 지금 프레임 — 끝 깃발 전에는 null */
  readonly promptFrame: number | null
  readonly isSettled: boolean
}

export function titleSceneAt(elapsedMilliseconds: number): TitleScene {
  const draw = Math.max(0, Math.floor(elapsedMilliseconds / millisecondsPerFrame()))
  const last = INTRO_ANIMATION[INTRO_ANIMATION.length - 1].frame
  const introFrame = draw < INTRO_DRAWS ? (animationStepAt(INTRO_ANIMATION, draw)?.frame ?? last) : last
  if (draw < INTRO_FRAME_COUNT) return { draw, introFrame, promptFrame: null, isSettled: false }
  const promptFrame = animationStepAt(PROMPT_ANIMATION, draw - INTRO_FRAME_COUNT)?.frame ?? null
  return { draw, introFrame, promptFrame, isSettled: true }
}
