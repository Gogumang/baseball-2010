/**
 * 홈런 글자 연출 (HOMERUN) — 원본 R2-game-effects 3-2.
 *
 * 켜는 곳은 판정 스위치 v = 8·12(홈런, 0x51cd8): 단계 +0x1961 = 0, 켜짐 +0x1960 = 1,
 * 글자별 칸 +0x1964+i = 5+i (i = 0..6). 그리기는 0x40b18 이 경기 틱마다 부른다.
 * 글자는 game_effect **이미지 54~60 = H O M E R U N** (폭 27,27,30,24,27,27,27 · 높이 25).
 *
 * 합성 인자 0xbb91d(그림, x, y, 종류, a, b) 의 뜻은 R6-sprite-leftovers 3c 에서 풀렸다(확정):
 *   종류 1 = 보통 복사 · 종류 2 = 크기 a/10 배 · 종류 8 = 각 채널에 +b 밝게.
 * 그래서 칸 5·4·3 은 2배(a=20), 칸 1 은 +200 흰 번쩍, 유지 단계 반짝임은 +140 이다.
 *
 * 같은 가지에서 **사운드 11(홈런 함성)** 이 울리지만 웹엔 소리 장치가 없어 번호만 남긴다.
 *
 * - 글자 자리 · 칸 모양(`letterLayout`) · 연출 틱으로 센 글자(`tickLetters`)
 * - 원본 칸 그대로의 글자 연출 0x40b18(`homeRunText`) · 부르는 쪽이 모는 글자 창(`homeRunTextWindow`)
 *
 * 여기는 좌표·단계 계산만 한다 — 그리기는 renderHomeRunBanner.ts.
 */

export { HOME_RUN_LETTER_IMAGES, HOME_RUN_LETTER_WIDTHS, HOME_RUN_FLASH_CYCLE_TICKS } from '@/widgets/batting-stage/lib/homeRunBanner/letterLayout'
export {
  HOME_RUN_FLY_IN_END_TICK,
  HOME_RUN_HOLD_START_TICK,
  homeRunSlotAt,
  homeRunPhaseAt,
  homeRunBurstFrameAt,
  homeRunLettersAt,
} from '@/widgets/batting-stage/lib/homeRunBanner/tickLetters'
export {
  HOME_RUN_TEXT_SCENE_START,
  generalHomeRunTextOn,
  derbyHomeRunTextOn,
  drawHomeRunTextOnce,
} from '@/widgets/batting-stage/lib/homeRunBanner/homeRunText'
export type { HomeRunTextState, HomeRunTextFrame } from '@/widgets/batting-stage/lib/homeRunBanner/homeRunText'
export { homeRunTextAfterDraws, homeRunTextFrameAt } from '@/widgets/batting-stage/lib/homeRunBanner/homeRunTextWindow'
export type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner/homeRunTextWindow'
