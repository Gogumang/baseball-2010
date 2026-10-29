import { translucentOpacityOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * **미션 HUD — 원본 `0x36714`** (타자 미션 모드 6 · 투수 미션 모드 5) (2026-10-14 직접 뜸, 0x36714~0x36c90 · 줄 그리기 0x36358 · 숫자 0x3608c · 시계 0x361e4).
 *
 * 부르는 곳은 0x36cb8 하나 — 타석 점수판 `0x373d0` 의 **맨 끝**(0x378f0)에서 모드 5 · 6 일 때만 부른다. 곧 미션 화면의 목표는
 * 웹 껍데기의 띠가 아니라 **타석 캔버스 오른쪽 위 판**에 점수판과 같은 차례로 그린다(점수판 위 · 소개 판 0x44944 아래).
 * ```
 * 3673c  M = [장면+0x178c] (미션) · k = (s8) M+0xbd · R = [장면+0x230] (미션 기록)
 *        모드 6: 행 = 0xa5269(M, k) · 타자 칸 B = R+0xb4      (0xa5485(M, k) 는 꺼내고 버린다)
 *        모드 5: 행 = 0xa5295(M, k) · 투수 칸 P = R+0x124     (0xa54b5 도 버린다)
 * 36798  (w, h) = 0xba815(trainning, 12, 종류 1)          ; 합성 프레임 12 = 83×51
 * 367c6  x0 = W − w − 6 = 151
 * 367e2  0xba759(trainning, 12, 종류 1, x0, 6, …)         ; 판
 * 367fc  0xba759(trainning, 17, 종류 0, W − w − 1, 0x29, …) ; 이미지 17 "달성" (156, 41)
 * 36800  목표 글 줄 — 아래 `goalLineDrawsOf` (0x36358 둘 또는 하나)
 * 369b2  모드 6: 0xba759(trainning, 8, 종류 0, x0 + 7, 8)  ; 이미지 8 방망이 (모드 5 는 이미지 7 공 · y 7)
 * 369f6  행[0xa] & 0xf (타석 한도) ≠ 0 이면:
 *          y = h + 8 = 59 · 0xba759(trainning, 13, 종류 1, x0, y, 효과 1, 10)     ; 띠 83×17 반투명 10/16
 *          img_text 팔레트 0 · 프레임 0x106 "타석" (x0 + 6, h + 0xc)
 *          0x3608c(min(B+0x34 + 1, 한도), 한도, x0 + 0x31, y + 4, 흰 0)          ; 모드 5 는 P+0x14
 * 36b04  모드 6: 행[9] 윗 4비트(스윙 한도) ≠ 0 이면 (모드 5 는 아랫 4비트 = 투구 한도 · 0x107 "투구" · P+0x1c):
 *          y = (앞 띠를 그렸으면 59 + 17 · 아니면 6 + 51)
 *          0xba759(trainning, 13, 종류 1, x0, y + 2, 효과 1, 10) · img_text 0x108 "스윙" (x0 + 6, y + 6)
 *          0x3608c(B+0x3c, 한도, x0 + 0x31, y + 6, 흰 0)                         ; 더하기 · 자르기 없음
 * 36c04  행 +0xb (u16 시간 한도) > 0 이고 남은 초 [0x1552af0] ≠ 0 이면:
 *          0xba759(trainning, 13, 종류 1, 5, h + 7 = 58, 효과 1, 10)              ; 왼쪽 띠
 *          0xba759(trainning, 16, 종류 0, 0xd, h + 10 = 61)                     ; 이미지 16 시계
 *          0x361e4(장면, 남은 초, 5, 58)                                         ; 시계 숫자 — `timerGlyphsOf`
 * ```
 * - W = 240 (0x14008b8), trainning = 장면 +0x19e8(ui/trainning.pzx). 효과 (1, L) 은 반투명 L/16 (R6 3a).
 * - 행 칸은 생성기 이름으로 타석 = `plateAppearanceLimit` · 스윙 = `swingLimit` · 시간 = `timeLimitSeconds` 이다.
 * - 2026-10-06(285fa37)의 "진행 수는 원본 화면에 없다" 는 0x36714 만 보고 0x36358 을 안 따라간 결론이었다 — 0x36358 이 줄 글로
 *   목표를 고르고 **"지금/목표" 를 노란 숫자로** 그린다(`goalCountOf`).
 */

/** 타석 캔버스 폭 W (0x14008b8) */
export const SCREEN_WIDTH = 240

export const TRAINNING_FOLDER = assetUrl('./sprites/trainning')
export const TRAINNING_FRAMES = assetUrl('./sprites/trainning/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')

/** 합성 프레임 12 (83×51, 원점 (0, 0)) — 0xba815 의 상자 */
export const PANEL = { width: 83, height: 51 } as const
/** 합성 프레임 13 (83×17, 원점 (0, 0)) */
export const STRIP_HEIGHT = 17
/** 판 왼쪽 x0 = W − w − 6 */
export const PANEL_X = SCREEN_WIDTH - PANEL.width - 6

/** 0xba759 효과 1 의 인자 — 반투명 10/16 (R6 3a). 띠는 타석 캔버스가 원본 식으로 섞는다(`missionStageStripsOf`, Q-03 r301) */
export const STRIP_LEVEL = 10
/** 띠를 DOM 으로 그릴 때(캔버스 밖 — 시험)의 CSS 근사 (`translucentOpacityOf` 머리) */
export const STRIP_OPACITY = translucentOpacityOf(STRIP_LEVEL)

export interface HudSprite {
  /** 그림 주소 */
  readonly src: string
  readonly left: number
  readonly top: number
  readonly opacity?: number
  readonly testId?: string
}

/** 판 · "달성" · 방망이 — 늘 그린다 */
export const MISSION_HUD_BASE: readonly HudSprite[] = [
  // 367e2 합성 프레임 12
  { src: `${TRAINNING_FRAMES}/012.png`, left: PANEL_X, top: 6, testId: '미션-판' },
  // 367fc 이미지 17 "달성" (W − w − 1, 0x29)
  { src: `${TRAINNING_FOLDER}/017.png`, left: SCREEN_WIDTH - PANEL.width - 1, top: 0x29 },
  // 369c0 모드 6: 이미지 8 방망이 (x0 + 7, 8)
  { src: `${TRAINNING_FOLDER}/008.png`, left: PANEL_X + 7, top: 8 },
]

/** 미션 모드 — 5 투수 미션 · 6 타자 미션 ([장면+0x1104]) */
export type MissionHudMode = 5 | 6

/** 369b2 머리 아이콘 — 모드 6 이미지 8 방망이 (x0 + 7, 8) · 모드 5 이미지 7 공 (x0 + 7, 7) */
export function missionHudIconOf(mode: MissionHudMode): HudSprite {
  return mode === 6 ? MISSION_HUD_BASE[2] : { src: `${TRAINNING_FOLDER}/007.png`, left: PANEL_X + 7, top: 7 }
}
