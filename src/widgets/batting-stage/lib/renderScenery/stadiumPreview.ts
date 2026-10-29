/** 구장관리 미리보기 0xb158 — 시즌 구장을 카메라 (−165, −80) 우타 거울 길로 */
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { cloudPaletteRowOf, isCloudVisible, skyColorsOf } from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { CAMERA } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import { drawClouds, drawSkyBands } from '@/widgets/batting-stage/lib/renderScenery/sky'
import { drawSeasonFenceParts } from '@/widgets/batting-stage/lib/renderScenery/fence'
import { drawField } from '@/widgets/batting-stage/lib/renderScenery/field'
import type { SceneryState, SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

/**
 * **구장 미리보기** — 시즌 장면 0x105 상태 0xea(구장관리) 그리기 `0xb158` (직접 떴다):
 * ```
 * b15a  구장 = [this+0x10c] ; 구장+4 = −165 · 구장+8 = −80     ; 틀마다 카메라를 다시 놓는다 (진입 0xe4d0 의 (−84, −80) 을 덮는다)
 * b172  0x77fe8(구장, 0)      ; 하늘·구름 — 구름 흐르기 0x78448 · 전광판 흐르기 0x77fb4 는 이 상태에서 안 부른다
 * b17e  0x77494(구장, 0, 0)   ; 시즌 구장 (관중 ppl 없음)
 * b188  0x7725c(구장, 0)      ; 바닥
 * b196  0x83378(창, 틱)       ; 그 위에 아이템 창 — 하늘 조명 0x78490 은 안 그린다
 * ```
 * 그림 함수는 경기 배경(`drawScenery` 의 시즌 구장 길)과 같고 카메라만 (−120, −70) 대신 (−165, −80) 이다. 하늘 0x77fe8 은 구장+4 에서
 * 폭 480 으로 칠하므로 화면을 다 덮는다.
 *
 * **우타 거울** (2026-10-15 직접 떴다): 이 구장([this+0x10c])은 0x3b14 가 `0x1239(0x94)`(4028 · 할당 0x2ac4 가 0x1400428 memset 으로
 * 0 을 채운다) → 생성자 0x76b24(4032) → 0x76ac8 로 만들고 76ade~76ae2 가 **+0x60 = 0** 으로 둔다. 진입 0xe4d0 은 +0x60 을 안 쓰고
 * (0x78741 관중석 · +0x89 = 0 · +0x8a = 기록+0x1b9 · 0x76b6c · 0x76ba4(1) · 0x783b0 · 0x76fc4 · 카메라 · 0x786c9 잔디), 장면 +0x10c 를
 * 읽는 시즌 장면 함수(0x3b14 · 0x4180 · 0x5f3c · 0x7958 · 0x957c · 0xb158 · 0xb1f8 · 0xe4d0 · 0xe9ac · 0xf684 · 0x10004) 어디도 +0x60 을
 * 안 쓴다. 그래서 시즌 구장 0x77494(774e6 `ldrb [+0x60]` == 0 → 77540 x + 490 · 효과 0x11)와 바닥 0x7725c(77272 == 0 → 772ca
 * x = 구장+4 − 0x21 · 효과 0x11)가 **우타 거울 길**로 그린다. 거울 축은 2·구장+4 + 479 라 카메라 (−165) 에서는 화면 149 − x 다 —
 * 웹은 캔버스를 dx(= −165 + 120) 만큼 옮긴 뒤 경기 우타 길(`RIGHT_HANDED_MIRROR_X`, 바닥 통째)을 그대로 그리면 같은 축이 된다.
 * 바닥 그림(폭 585)은 우타 자리 −198~387 이 화면을 다 덮는다.
 *
 * **전광판 팀 아이콘**(칸 3, 0x77654~0x77722): 구장+0x7c(아이콘 그림)는 적재 0x76ba4 가 76ec2 에서 늘 싣고(0 이 아니다), 아이콘 칸
 * +0x84(박스 0) · +0x80(박스 1)은 위 함수들 어디도 안 쓴다 — 할당 memset 의 **0 그대로**다. 0x77494 는 0x77974 와 달리 모드 5·6 덮기가
 * 없고 14 → 10 · 9 초과 → 11 만 고르므로 두 상자 모두 **아이콘 0** 이 그려진다.
 *
 * 장면 구장 칸 (U-124 닫음):
 * - 하늘 칸 구장+0x18 은 0x783b0 이 `[0x1552d0c]+0x6b`(마지막 경기 상태의 이닝)를 읽는다 — 부르는 쪽이 `liveGameInningIndex()` 로 넘긴다.
 * - 구름 칸 구장+0x1c · +0x20 · +0x24 는 0x76ab0 · 할당 memset 의 0 에서 0x78448 만 옮기는데, 0x78448 을 부르는 곳은 경기 장면
 *   0x3f060 · 0x45c18 · 0x4a384 셋뿐이라(xref 전수) 시즌 장면 0x105 의 이 구장은 **늘 0** 이다 — 웹의 부름 수 0(`cloudCalls` 생략)과 같다.
 * - 전광판 글자 자리(+0x8c)는 부르는 쪽이 장면 구장 칸으로 넘긴다(`scoreboardX`).
 */
export const STADIUM_PREVIEW_CAMERA = { x: -165, y: -80 } as const

export interface StadiumPreviewState {
  readonly skyRow: number
  readonly skyColumn: number
  readonly seasonStadium: SeasonStadium
  /** 환경설정 전광판(+0x3a) — OFF 면 전광판 글자를 안 그린다 (0x77726). 생략하면 켠 것 */
  readonly isScoreboardOn?: boolean
  /** 전광판 글자 x 이동 = 장면 구장 +0x8c (`StadiumPreviewScene`) */
  readonly scoreboardX: number
}

export function drawStadiumPreview(context: CanvasRenderingContext2D, state: StadiumPreviewState): void {
  const dx = STADIUM_PREVIEW_CAMERA.x - CAMERA.x
  const dy = STADIUM_PREVIEW_CAMERA.y - CAMERA.y
  context.fillStyle = ORIGINAL_COLORS.black
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  // 하늘 0x77fe8 — 구장+8 에서 80 단색 · 108 그라데이션 · 60 단색 (가로는 480 이라 화면을 다 덮는다)
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.skyColumn)
  drawSkyBands(context, top, bottom, dy)

  context.save()
  context.translate(dx, dy)
  if (isCloudVisible(colorIndex)) drawClouds(context, 0, cloudPaletteRowOf(colorIndex))
  // 시즌 구장 0x77494 — +0x60 == 0 이라 우타 거울 길(관중석 · 덧그림 · 전광판 그림 뒤집기, 아이콘 · 글자는 잰 박스만큼 옮김)
  drawSeasonFenceParts(context, stadiumPreviewSceneryOf(state), state.seasonStadium, STADIUM_PREVIEW_MIRRORED)
  context.restore()

  // 바닥 0x7725c — +0x60 == 0 이라 772ca 우타 갈래(x = 구장+4 − 0x21, 효과 0x11). 카메라 x 를 따라 dx 만큼 옮긴다
  context.save()
  context.translate(dx, 0)
  drawField(context, state.seasonStadium.grassPalette, dy, STADIUM_PREVIEW_MIRRORED)
  context.restore()
}

/** 구장관리 미리보기 구장 +0x60 == 0 (생성자 76ae2, 위 주석) — 우타 거울 길로 그린다 */
export const STADIUM_PREVIEW_MIRRORED = true
/** 미리보기 구장의 아이콘 칸 +0x84 · +0x80 — 아무도 안 써서 할당 memset 의 0 (위 주석) */
export const STADIUM_PREVIEW_ICON_TEAM = 0

function stadiumPreviewSceneryOf(state: StadiumPreviewState): SceneryState {
  return {
    skyRow: state.skyRow,
    skyColumn: state.skyColumn,
    tick: 0,
    stadium: 0,
    seasonStadium: state.seasonStadium,
    ourTeamId: STADIUM_PREVIEW_ICON_TEAM,
    opponentTeamId: STADIUM_PREVIEW_ICON_TEAM,
    scoreboardX: state.scoreboardX,
    ...(state.isScoreboardOn === undefined ? {} : { isScoreboardOn: state.isScoreboardOn }),
  }
}
