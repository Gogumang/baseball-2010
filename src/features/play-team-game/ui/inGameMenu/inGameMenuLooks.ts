import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 경기 중 메뉴의 그림 자리 · 색 · 글 (그리기 0x3cdd0 · StrGAME) */
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
/** ui/num.pzx — 칸 번호 0xba689 의 글꼴 [[[장면+0x1014]+8]+8], 기준 그림 0 */
export const NUM = assetUrl('./sprites/num')
/** num 그림 0~9 의 폭 (public/sprites/num/000~009.png — "1" 만 4, 나머지 8 · 높이 모두 10) */
export const NUM_DIGIT_WIDTHS = [8, 4, 8, 8, 8, 8, 8, 8, 8, 8] as const

/**
 * 판 색 — 0x3ce8c 리터럴 0xc8335fcd(칠) · 0x3ce96 `0xc8 << 24`(테두리). 윗바이트 0xc8 은 알파라 0x6b7d4 · 0x6aa64 가
 * 0x1400698(gc, 4, 알파) 로 반투명을 켠다(F 4절). ⚠️ 근사(남김 — 단말 몫 · 바이너리 밖): 섞기 식은 단말 몫이라 알파/255 로 준다.
 */
const BOX_ALPHA = (0xc8 / 0xff).toFixed(4)
export const BOX_FILL = `rgba(51, 95, 205, ${BOX_ALPHA})`
export const BOX_EDGE = `rgba(0, 0, 0, ${BOX_ALPHA})`
/** 칸 칠 — 고른 칸 0x1400748(0xff, 0xd8, 0) · 아닌 칸 0x1400748(0x33, 0x5f, 0xcd) (0x3cf70 · 0x3cf78 · 0x3cfee · 0x3d040) */
export const PILL_SELECTED = '#FFD800'
export const PILL_NORMAL = '#335FCD'
/** 막힌 자동진행 칸 이름 — 효과 0xb(단색) 0x1400748(0x80, 0x80, 0x80) (0x3cfa4~0x3cfae) */
export const DISABLED_LABEL = '#808080'
/** img_text 팔레트 4 (#7B797B · #525152) — "MENU" 머리. 흰 글자 그림(R=G=B)을 두 색으로 잇는 1차식 */
export const PALETTE4_MATRIX = '2.5625 0 0 0 -2.08015  0 2.5 0 0 -2.02549  0 0 2.5625 0 -2.08015  0 0 0 1 0'

/**
 * StrGAME[3]/[4] — "자동진행을 하시겠습니까? %d G포인트가 소모됩니다" (R10 7절 116행에 원문이 있다).
 * `%d` 는 `sprintf` 로 비용이 들어간다 (0x3c67e = 100 · 0x3c694 = 30).
 */
export const autoProgressConfirmOf = (cost: number) => `!C!cFFFFFF자동진행을 하시겠습니까?!N!cFFFF00${cost} G포인트!cFFFFFF가 소모됩니다`

/** StrGAME[2] — 대전모드 6회 제한 알림 (`base/extracted/StrGAME.json` [2] 원문 그대로) */
export const VERSUS_INNING_LIMIT_NOTICE = '!C!cFFFFFF대전모드는 6회까지만!N자동진행 가능합니다'

/** StrGAME[5] — G포인트 부족 알림 (`0x3c7d8`, `base/extracted/StrGAME.json` [5] 원문 그대로) */
export const NOT_ENOUGH_GAME_POINT =
  '!C!cFFFFFF자동진행을 할 수 없습니다!N!cFF0000G포인트가 부족합니다!cFFFFFF!N!N[!cFFFF00스페셜!cFFFFFF] [!cFFFF00G포인트충전!cFFFFFF]!N에서 충전할 수 있습니다'
