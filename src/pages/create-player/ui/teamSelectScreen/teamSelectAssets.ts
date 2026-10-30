import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { TEAM_COUNT, teamGridOpenShapeOf } from '@/pages/create-player/lib/teamSelectLayout'

/** 이미지 폴더 (128장) — 노트가 "slt_frame 이미지 N" 이라 부르는 막대들이 여기 있다.
 *  프레임 폴더(`slt_frame/frames`, 62장)와 **번호 체계가 다르다** — 116·117 은 프레임 쪽에 없다 */
export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
/** team_logo 이미지 묶음 — 15 = 잠긴 칸 "?" (32×48) */
export const TEAM_LOGO_IMAGE = assetUrl('./sprites/team_logo')
export const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
/** 큰 로고는 A 자리에만 쓴다 (77×76 을 가운데 맞춤) */
export const BIG_LOGO_HALF = { width: 38, height: 38 } as const

/**
 * 격자 칸 바탕 — slt_frame **이미지 0** (39×38, 위아래 두 단으로 나뉜 파란 사각).
 * 해독 노트 `P6-screens.md:127` 이 격자 객체 **+0x94 = slt_frame** 이라 적고 있다.
 */
export const CELL_FRAME_IMAGE = 0
/**
 * 고른 칸 테두리 — slt_frame **이미지 1** (42×42, 속 빈 노란 사각 테두리).
 * ⚠️ 원본 그림이 칸(40px)보다 2px 커서 사방으로 1px 씩 비어져 나온다 — 원본 그림 크기 그대로 둔다.
 */
export const CELL_CURSOR_IMAGE = 1
export const CELL_CURSOR_SIZE = 42
/**
 * 칸 안 로고 — 격자 종류 9 칸 그리기 0x7b2ae (직접 떴다, 0x7b2d4~0x7b33e):
 * 열린 팀은 `0x66431(skin, team_logo, 팀, x + 2, y + 2)` — 스킨 버퍼 +0x4c8 + 팀·16 의 (폭, 높이, 픽셀)을 제 크기로 찍는다.
 * 그 버퍼는 0x663c4 가 팀마다 0x662dc(…, 0x23, 0x22) 로 늘려 둔 **35×34** 다 (P6 4a, r113 직접 뜸).
 * ⚠️ 0x662dc 의 표본 방식(최근접인지)은 안 읽었다 — 웹은 77×76 을 35×34 로 최근접(pixelated) 축소한다.
 */
export const CELL_LOGO = { x: 2, y: 2, width: 35, height: 34 } as const
/**
 * 잠긴 히든 칸 — `0xbb91d(team_logo 이미지 15 "?"(32×48), x + 12, y + 7, 종류 2, a 5, b 0)` (0x7b2f6~0x7b30e):
 * 종류 2 · a 5 = 절반 크기(16×24) 최근접 표본 (R6 3c 확정).
 */
export const CELL_LOCKED_MARK = { image: 15, x: 12, y: 7, width: 16, height: 24 } as const
/** 덮기 크기 — team_logo 이미지(77×76)의 (폭 >> 1, 높이 >> 1) (0x7b35a~0x7b370) */
export const CELL_COVER_SIZE = { width: 38, height: 38 } as const

/** 팀 15칸 격자의 열림 애니 꼴 (k 0·1 — `teamGridOpenShapeOf`) */
export const TEAM_GRID_OPEN = teamGridOpenShapeOf(TEAM_COUNT)

export const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

/**
 * 칸 그리기 0x7a570 의 덮기 칸 (직접 떴다, 0x7b342~0x7b38c): 칸 번호 == 넷째 인자이면 로고(0x66431 이 칸 + (2, 2) 에 그린 것)
 * 뒤에 그 로고 그림의 (폭 >> 1, 높이 >> 1) 를 **칸 자리 (x, y)** 에 검정 덮기 [0x15605d4](x, y, w, h, **7**) — 화면을 7/16 남긴다.
 * 덮기는 로고(35×34, 칸 + (2, 2))보다 크고 칸 왼쪽 위에서 시작한다.
 */
export const TEAM_COVER_STEP = 7
