import { PANEL, SCREEN_WIDTH } from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'

/**
 * slt_frame 프레임 2(꼬리 탭)의 높이 h — 0x2f300~0x2f318 이 `0xba815(slt_frame, 2, 종류 1)` 상자를 [sp+0x140] 에 두고
 * 탭 2 그림이 그 +6(s16 h, 0x2f326 · 0x2f414 · 0x2f456)을 `y0 − h + …` 로 쓴다. 상자는 0x94962~0x9497c 가 (x, y, w, h) 를
 * strh 넷으로 채운다 — 프레임 2 는 91×15 다.
 */
const SKILL_TAB_FRAME_HEIGHT = 15

/** 스킬 설명 — 꼬리 탭 프레임 2 (91×15) + 설명 상자 0xbb28d(120, …, 173, 60) + 글 */
export const SKILL_DESCRIPTION = {
  tabFrame: 2,
  /** 0x2f330~0x2f34e — 0xba759(slt_frame, 2, 종류 1, W/2 − 0x56 = 34, y0 − h + 0x90 = 183) *(정정 r136 — 전에는 176)* */
  tabX: SCREEN_WIDTH / 2 - 86,
  tabY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x90,
  /**
   * 0x2f35e~0x2f36e — 0xbb28d(W/2, y0 + 0x91 = 199, 0xad, 0x3c, 정렬 2). 정렬 2 는 비트 1 만이라 x 만 가운데(bb29c~bb2a6),
   * y 는 그대로다(비트 5·6 이 y 를 옮긴다) *(정정 r136 — 전에는 190)*. 글(202)은 상자 위 3 아래다.
   */
  box: { centerX: 120, y: PANEL.y + 0x91, width: 173, height: 60 },
  /**
   * 글 — 0xba269(글, W/2 − 0x51 = 39, y0 + 0x94 = 202, 폭 −1, 색 −1, 0) (0x2f3a0 · 0x2f4d8 → 0x2f4e6~0x2f4ec 가 **0x2fb8e 로 뛴다**).
   * 0x2fb8c `subs r3, #0xa` 는 뛰어든 자리(0x2fb8e) 앞이라 안 지난다 — 폭은 −1 그대로다 *(정정 r133 — r129 노트의 "폭 −11" 은 이 뜀을 잘못 읽었다)*.
   * 폭 −1 이면 0x6ef4c 가 6efb0~6efd0 에서 0x9c52c 로 날 글 폭(0x0a 줄 중 최댓값)을 재어 폭으로 쓰므로 **줄은 `!N` 에서만 끊긴다**.
   * 글에 `!C` 가 없어 왼쪽 맞춤 · 줄 높이는 글꼴 +0x6c(11) + 줄간 +0x67(3) = 14 (0x6ef90~0x6efa4, R5).
   * 얻은 스킬은 `"%s!N효과 : !cFFFF00%s"`(0xcf978) = StrSKILL[i] · StrSKILL[i + 40](0x702b5) · 못 얻었으면 `"!cffffff아직 획득하지 못한!N스킬입니다."`(0xcf950).
   * 원본 그대로라 네 줄짜리 설명(202 + 56 = 258)은 상자(190~250) 아래로 넘친다.
   */
  text: { x: SCREEN_WIDTH / 2 - 0x51, y: PANEL.y + 0x94 },
} as const

/**
 * **얻은 스킬 그림 두 장** (0x2f3b0~0x2f488, r136 직접 떴다) — 표 [+0x13c + 4i] ≠ −1(얻음)일 때만 상자 위에 그린다.
 * ```
 * 2f3b0  등급 = 칸 ≤ 7 ? 0 : 칸 ≤ 0x17 ? 1 : 2
 * 2f3e4  s = 칸 ≤ 0x27 ? [[this+0x120]+0x13c + 4·칸] : −1 ; 0x5f351(_, s) 비트 1(마이너스) 이면 이미지 0x7d, 아니면 0x7c
 * 2f3fc  0x913e5([0x1552ae8], 0)                                      ; img_text 팔레트 0(흰 글자)
 * 2f444  0xba759(img_text [0x1552aec], 표[sp+0x2a4][등급], 종류 1, W/2 − 0x3d = 59, y0 − h + 0x92 = 185)
 *        표 = 0xced88 [281 공통, 149 타자, 150 투수] (0x2e358~0x2e35e 가 스택에 옮긴다)
 * 2f488  0xba759(slt_frame, 0x7c/0x7d, 종류 0(이미지), W/2 − 0x24 = 84, y0 − h + 0x91 (+1 = [sp+0xa8] 깜박임이 켜졌으면))
 * ```
 * 표 [+0x13c] 는 탭을 고를 때 0x58a3c(0x2b6fc)가 채운다 — 모두 −1 로 두고 칸 0~7 은 스킬 비트 i 가 +0xf4(타자편)·+0xf8(투수편)
 * "한 번이라도 켠 스킬" 중 하나에 있으면 i, 칸 8~23 은 +0xf4 의 비트 k = 칸, 칸 24~39 는 +0xf8 의 비트 k = 칸 − 16 이면 k 를 적는다.
 * 곧 0x5f351 이 받는 값은 칸이 아니라 **스킬 비트 번호**다(투수 칸 33~36 새가슴 · 비겁자 · 깃털 · 더티볼 → 비트 17~20 → 빨간 아래 화살).
 */
export const SKILL_BADGE = {
  gradeFrames: [281, 149, 150],
  gradeX: SCREEN_WIDTH / 2 - 0x3d,
  gradeY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x92,
  /** 0x7c 파란 위 화살 · 0x7d 빨간 아래 화살 (slt_frame 이미지) */
  plusImage: 0x7c,
  minusImage: 0x7d,
  arrowX: SCREEN_WIDTH / 2 - 0x24,
  arrowY: PANEL.y - SKILL_TAB_FRAME_HEIGHT + 0x91,
} as const

/** 스킬 등급 (0x2f3b0~0x2f3c0) — 0 공통 · 1 타자 · 2 투수 */
export const skillGradeOf = (cell: number): 0 | 1 | 2 => (cell <= 7 ? 0 : cell <= 0x17 ? 1 : 2)

/* 칸 → 스킬 비트 번호(표 [+0x13c], 0x58a3c)는 `entities/collection` 의 `annalsSkillOfCell` — 켠 스킬 비트로 −1 도 가른다 */

/** 못 얻은 스킬 설명 `"!cffffff아직 획득하지 못한!N스킬입니다."`(0xcf950) — 0x2f37e~0x2f3ae (칸 > 0x27 이거나 표 [+0x13c + 4i] == −1) */
export const SKILL_NOT_GAINED_TEXT = '!cffffff아직 획득하지 못한!N스킬입니다.'
