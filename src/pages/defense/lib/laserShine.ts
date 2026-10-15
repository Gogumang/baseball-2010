/**
 * **레이저 송구 반짝임 — 그리기 효과 0xc(12) · 인자 = 색** (원본 직접 뜸, 2026-10-14).
 *
 * 부르는 길: 야수 그리기 0x43278 의 0x43406~0x4342c — 이 야수가 공 가진 야수(플레이 +0x130)이고 경기 +0x19ad(반짝임)이 서고
 * +0x1990 == 0 이면 `[sp+0x50] = 12` · `[sp+0x4c] = 0x1400748(255, 0, 0)` 을 0x79b48 의 효과 · 인자로 넘긴다(43480~43490).
 * 0x79b48 은 그것을 그대로 0xbe8d5 → 0xbe810(그리기 목록에 넣기)으로 보내 프레임 그리기의 **효과 번호**가 된다 —
 * 0xbb91d(홈런 글자의 종류 2 · 8) 길이 아니다.
 *
 * 효과 번호마다 픽셀 함수는 시작 코드 0x30b2~0x30c0 에서 등록된다: 효과 0xc = 16비트 0x9af71 · 팔레트 0x98351 / 0x983d1.
 * 셋 다 같은 식이다(0x98394~0x983a8 · 0x9af88~0x9afa8 · 0x98458~0x9846a):
 * ```
 * 그림 픽셀이 투명(16비트판은 [sp+0x28] 투명색과 같으면 · 팔레트판은 칸 수 부호가 투명 칸)이면 건너뜀
 * out = (그림 & 0xf7de) >> 1  +  (색 & 0xf7de) >> 1          ; RGB565 채널마다 반반
 * ```
 * 곧 **화면은 안 보고**, 그림 픽셀과 인자 색을 반씩 섞어 그 자리에 찍는다 — 몸 전체(그림이 있는 모든 칸)가 빨강 쪽으로 반 물든다.
 * 색 (255, 0, 0) → 565 0xf800 → 반은 R5 15. 그러니 R5 = 그림 R5 / 2 + 15 · G6 = 그림 G6 / 2 · B5 = 그림 B5 / 2.
 */
import { DRAW_EFFECT, effectSpriteUrl, halfMixPixel565, recolorRgba } from '@/shared/lib/pixelEffect/pixelEffect'
import { rgbTo565 } from '@/shared/lib/screen565/screen565'

/** 0x1400748(255, 0, 0) — 반짝임 색 (RGB565) */
export const LASER_SHINE_COLOR_565 = rgbTo565(255, 0, 0)

/** 효과 0xc 한 픽셀 — 0x98394~0x983a8 (공용 `halfMixPixel565`) */
export const shinePixel565 = halfMixPixel565

/** RGBA 그림 전체에 효과 0xc 를 입힌다. 알파 0 인 칸(PZX 투명)은 그대로 둔다 (공용 `recolorRgba`) */
export const shinePixels = (rgba: Uint8ClampedArray, color: number = LASER_SHINE_COLOR_565): Uint8ClampedArray =>
  recolorRgba(rgba, DRAW_EFFECT.HALF_MIX, color)

/** 효과 0xc(빨강)를 입힌 그림 주소. 같은 그림은 한 번만 칠한다. 실패하면 원래 주소 (공용 `effectSpriteUrl`) */
export const shinedSpriteUrl = (url: string): Promise<string> => effectSpriteUrl(url, DRAW_EFFECT.HALF_MIX, LASER_SHINE_COLOR_565)
