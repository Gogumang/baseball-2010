import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 판정 글자 애니메이션 폴더 (game_judge.pzx, 0x393b4) */
export const JUDGE_FRAMES = assetUrl('./sprites/game_judge/frames')

/** 경기 연출 그림 (game_effect.pzx, 게임+0x102c) — 홈런 글자는 이미지 54~60 (R2 3-2) */
export const GAME_EFFECT_IMAGE = (index: number) => assetUrl(`./sprites/game_effect/${String(index).padStart(3, '0')}.png`)

export const GAME_EFFECT_FRAMES = assetUrl('./sprites/game_effect/frames')

export const FIELD_BACKGROUND = assetUrl('./sprites/attack/000.png')

/** 바닥 그림 폴더 — `stadium/attack.mpl` 의 잔디 팔레트가 여기 붙는다 */
export const FIELD_FOLDER = assetUrl('./sprites/attack')

/** 마선수가 아닐 때 마운드에 서는 평범한 투수 */
export const PITCHER_FRAMES = assetUrl('./sprites/pitcher/frames')

/** 타석 배경 폴더 (위치 분석 6차) */
export const CLOUD_FRAMES = assetUrl('./sprites/attack_sky_cloud/frames')

/** 하늘 조명 `effect/sky_effect_light.pzx` — 구장+0x38, 그리기 0x78490 */
export const SKY_LIGHT_FRAMES = assetUrl('./sprites/sky_effect_light/frames')

export const FENCE_FRAMES = assetUrl('./sprites/fence/frames')

export const CROWD_FRAMES = assetUrl('./sprites/ppl/frames')

export const SCOREBOARD_FRAMES = assetUrl('./sprites/board_ani/frames')

export const TEAM_ICON = (index: number) => assetUrl(`./sprites/team_s_icon/${String(index).padStart(3, '0')}.png`)

// ── 시즌 구장 (0x77494) ─────────────────────────────────────────────────────
// 적재 0x76ba4 의 **시즌 쪽 가지**(두 번째 인자 ≠ 0)가 쓰는 파일들이다.
// 일반 경기는 fence.pzf 한 벌만 쓰지만(위 FENCE_FRAMES), 시즌 홈경기·구장 화면은
// 관중석 칸(+0x88)·관중 단계(+0x89)·전광판 칸(+0x8a) 셋으로 그림을 고른다 (R6 1절).

/** 관중석 0~3 — `stadium/fence_season.pzf` (0x76c62). 한 관중석당 5칸씩 20칸 */
export const FENCE_SEASON_FRAMES = assetUrl('./sprites/fence_season/frames')

/** 관중석 4~6 = 히든 — `stadium/hidden_fence_(칸−4).pzx` (0x76ca2, 5칸씩) */
export const HIDDEN_FENCE_FRAMES = (index: number) => assetUrl(`./sprites/hidden_fence_${index}/frames`)

/** 전광판 0~3 — `stadium/fence_board.pzx` (0x76d06), 프레임 번호 = 칸 */
export const FENCE_BOARD_FRAMES = assetUrl('./sprites/fence_board/frames')

/** 전광판 4~6 = 히든 — `stadium/hidden_board_(칸−4).pzx` (0x76d1c), 늘 프레임 0 */
export const HIDDEN_BOARD_FRAMES = (index: number) => assetUrl(`./sprites/hidden_board_${index}/frames`)
