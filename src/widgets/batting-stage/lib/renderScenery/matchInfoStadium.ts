/** 경기정보 구장 미리보기 0x5fd04 → 0x581dc — 일반 구장을 카메라 (−120, −68) 우타 거울 길로 */
import { cloudPaletteRowOf, isCloudVisible, skyColorsOf } from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { CAMERA, FLAT_SKY_STADIUM } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import { drawClouds, drawFlatSky, drawSkyBands, drawSkyLight } from '@/widgets/batting-stage/lib/renderScenery/sky'
import { drawFenceParts } from '@/widgets/batting-stage/lib/renderScenery/fence'
import { drawField } from '@/widgets/batting-stage/lib/renderScenery/field'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

/**
 * **경기정보 구장 미리보기** — 도우미 `0x5fd04(스킨, 무대)` 가 무대를 세운 뒤 `0x581dc(스킨, 무대, 1)` 로 화면을 떠 둔다(직접 떴다):
 * ```
 * 5fd0a  0x76b6c(무대)            ; 바닥 stadium/attack 을 무대+0xc 줄로
 * 5fd16  0x76ba4(무대, 0)         ; 일반 구장 그림(펜스 · 관중 · 전광판)
 * 5fd1e  0x783b0(무대)            ; 하늘 줄 +0x10 — 모드 1 측 0 팀 · 2 시즌 +0xb2 · 3·4 나리 +0xb2 (mod 6), 칸 +0x18 = 경기 상태 +0x6b
 * 5fd28  0x76fc4(무대, 1)         ; 하늘 칸 = min(+0x18, 12) · 구름
 * 5fd36  무대+4 = −120 · 무대+8 = −68  ; 카메라 (경기는 −70)
 * 5fd40  0x581dc(스킨, 무대, 1):
 *   581f6  0x6a735(gfx, RGB(255, 255, 255))     ; 화면 흰색
 *   58210  0x78578(무대, 0, 1)                  ; 하늘 0x77fe8 → 일반 구장 0x77974 → 바닥 0x7725c → 하늘 조명 0x78490
 *   58218  0xbdd65(1) · 3줄 선(알파 0x10) · [0x15605d0] 흰 단계 3 · 0xbda01 로 [0x1552ae4] 에 떠 둔다 → [skin+0x450]
 * ```
 * 떠 두면 무대는 버리고(3162a · 683e · 1c888) 그림마다 `0x581dc(스킨, 0, 0)` 이 그 버퍼를 (0, 0) 에 찍는다 — 구름 · 전광판이 안 흐른다.
 * 부르는 곳: 일반모드 22 진입 0x314b0(3161e) · 시즌 0xdd 진입 0x6548(682e) · 나리 142 진입 0x1c46c(1c87c).
 * 그리는 곳: 0xb810(시즌 0xdd · 0xe0 · 0xe1) · 0x16928(나리 142~144) · 0x2e070 · 0x2e0c4(일반모드 22 · 23).
 *
 * 이 함수는 `0x78578` 까지(흐리기 앞)를 그린다. 팀 아이콘 박스 0 = 무대+0x84(측 0 팀) · 박스 1 = +0x80(측 1 팀).
 * 경기 상태 +0x6b 는 세 진입 모두 앞에서 0xb6814 로 지운 뒤라 하늘 칸 0 이다.
 */
export const MATCH_INFO_STADIUM_CAMERA = { x: -120, y: -68 } as const

/**
 * **경기정보 무대는 우타 거울로 그린다** (2026-10-14 직접 떴다). 무대는 세 진입이 모두 생성자 0x76b24(0x314b0 315c6 · 0x6548 67dc ·
 * 0x1c46c 1c7ae)로 새로 만들고, 0x76b24 → 0x76ac8 이 76ade~76ae2 에서 **+0x60 = 0** 으로 둔다. 그 뒤 진입이 채우는 칸은 +0x70 · +0x80 ·
 * +0x84 · +0xc 이고 0x5fd04 의 0x76b6c · 0x76ba4 · 0x783b0 · 0x76fc4 도 +0x60 을 안 쓴다 — `adds rN, #0x60 ; strb [rN]` 을 .text
 * 전체에서 훑으면 +0x60 을 쓰는 곳은 0x76ae2(생성자) 와 경기 장면 구장(장면 +0xf10)을 적는 다섯 곳(0x3adbc · 0x3b108 · 0x47d62 ·
 * 0x48890 · 0x516b8 — 모두 `[장면+0xf10]` 에 0xb63c1 타자 손)뿐이다(str/strh 로 +0x5c~+0x60 을 덮는 곳도 구장 클래스 안에 없다).
 * 0x77974 의 [sp+0x48] = 무대+0x60(779a0) 이 0 이므로 펜스 · 바닥은 효과 0x11 로 뒤집히고 팀 아이콘 · 전광판 글자 · 관중 ppl 은
 * 경기 우타와 같이 옮겨진다.
 */
export const MATCH_INFO_STADIUM_MIRRORED = true

export interface MatchInfoStadiumState {
  /** 무대 +0x70 — 펜스 프레임 · 하늘 단색(8) */
  readonly stadium: number
  /** 무대 +0xc — 바닥 팔레트 줄 (null 기본색) */
  readonly fieldPalette: number | null
  /** 하늘 줄 +0x10 (`stadiumSkyRowOf`) */
  readonly skyRow: number
  /** 무대 +0x84 — 측 0(선공) 팀 */
  readonly side0TeamId: number
  /** 무대 +0x80 — 측 1(후공) 팀 */
  readonly side1TeamId: number
  /** 전역 모드 — 하늘 조명 0x78490 이 5 · 6 · 7 이면 안 그린다 */
  readonly gameMode: number
  /** 환경설정 전광판(+0x3a) — OFF 면 전광판 글자를 안 그린다. 생략하면 켠 것 */
  readonly isScoreboardOn?: boolean
}

export function drawMatchInfoStadium(context: CanvasRenderingContext2D, state: MatchInfoStadiumState): void {
  const dy = MATCH_INFO_STADIUM_CAMERA.y - CAMERA.y
  const scenery: SceneryState = {
    skyRow: state.skyRow,
    skyColumn: 0,
    tick: 0,
    stadium: state.stadium,
    fieldPalette: state.fieldPalette,
    ourTeamId: state.side0TeamId,
    opponentTeamId: state.side1TeamId,
    gameMode: state.gameMode,
    ...(state.isScoreboardOn === undefined ? {} : { isScoreboardOn: state.isScoreboardOn }),
  }
  // 0x581dc 581f6 — 화면 흰색
  context.fillStyle = '#fff'
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  // 하늘 0x77fe8 — 구장 8 이면 화면 전체 단색, 그 밖은 구장+8 에서 위 단색 · 그라데이션 · 아래 단색
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, 0)
  const isFlatSky = state.stadium === FLAT_SKY_STADIUM
  if (isFlatSky) drawFlatSky(context)
  else drawSkyBands(context, top, bottom, dy)

  context.save()
  context.translate(0, dy)
  if (!isFlatSky && isCloudVisible(colorIndex)) drawClouds(context, 0, cloudPaletteRowOf(colorIndex))
  // 일반 구장 0x77974 — 펜스 프레임 · 팀 아이콘 · 관중 · 전광판(틱 0). 무대 +0x60 == 0 이라 **우타 거울** 길이다
  // (`MATCH_INFO_STADIUM_MIRRORED` — 펜스 뒤집기 · 아이콘 · 글자 옮김 · 관중 ppl 141 옮김)
  drawFenceParts(context, scenery, MATCH_INFO_STADIUM_MIRRORED)
  context.restore()
  // 바닥 0x7725c — 무대+0xc 줄, +0x60 == 0 이라 772ca 우타 갈래(효과 0x11)
  drawField(context, state.fieldPalette, dy, MATCH_INFO_STADIUM_MIRRORED)
  // 하늘 조명 0x78490(무대, 0, 1)
  drawSkyLight(context, scenery, colorIndex)
}
