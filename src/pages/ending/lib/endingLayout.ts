/**
 * 나만의리그 엔딩 화면 (장면 0x106 상태 141 — 적재 `0x87c7c`, 그리기 `0x168fc`).
 *
 * 장면 그리기 `0x168fc` 가 단계 `[장면+0xd4]` 로 두 함수를 가른다:
 * ```
 * 단계 ≤ 2 → 0x882b4(엔딩판, 단계, n)      ; 단계 0 은 아무것도 안 그린다(0x882c4)
 * 단계 > 2 → 0x88bb4(엔딩판, 단계, n)      ; 제작진
 * ```
 * n = `[장면+0x2c]`(이 상태에 들어와 돈 틀 수). 단계는 배경음 페이드(0xbdae9(…, 1500))가 끝날 때 0→1, 키로 1→2(0x12246),
 * 다시 페이드가 끝나면 2→3 이고 이때 n 을 0 으로 되돌린다(0x1bf54~0x1bfa0).
 *
 * `0x882b4` 는 본 엔딩 e(`[this+0x2e4]`)로 **두 갈래**다 (표 0xd4b28):
 *   - **e 0·1 (부상·방출)** — 0x883b6: 띠 창 + mode_back + 걸어 들어오는 선수(+ e 0 이면 부상 아이콘) + 글.
 *     엔딩 그림·원형 전환은 없다(적재가 ending.pzx 를 안 올리고 `[this+0x2ec]` 를 안 켠다).
 *   - **e 2~9** — 0x886ca: ending.pzx 그림이 미끄러져 서고, 그 뒤 원형 전환이 e 마다 다른 자리로 닫히며,
 *     글 StrENDING[20] + 본 엔딩이 아래에서 올라온다. 띠 창·걸어 들어오는 선수는 없다.
 * 제작진 `0x88bb4` 는 e 2~9 에만 온다(부상·방출은 키가 곧장 이어하기 팝업이다, 0x1220c).
 */

export {
  BAND_BACKGROUND,
  BAND_WINDOW,
  BATTER_EDITION_MODE,
  ENDING_STAGE,
  endingStageZeroCoverOpacityAt,
  endingWalkInAnimationOf,
  endingWalkInPaletteOf,
  INJURY_ENDING,
  LAST_WALK_IN_ENDING,
  SCREEN,
  SHORT_ENDING_TEXT_TOP,
  WALK_IN,
} from '@/pages/ending/lib/endingLayout/endingBand'
export type { EndingWalkInLook } from '@/pages/ending/lib/endingLayout/endingBand'
export {
  CREDITS,
  creditsTopOf,
  creditsWalkersOf,
  ENDING_IMAGE,
  endingImageOffsetOf,
  IRIS_COVER,
  irisCircleOf,
  irisStartTickOf,
  RISING_TEXT,
  risingTextTopOf,
} from '@/pages/ending/lib/endingLayout/endingImage'
export type { CreditsWalker } from '@/pages/ending/lib/endingLayout/endingImage'
