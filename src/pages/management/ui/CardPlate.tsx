import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import {
  SEASON_CARD_BOARD,
  SEASON_CARD_LOGO,
  seasonCardLogoPlaceOf,
  steppedBoardLeftEnd,
  steppedBoardLeftRow565,
  steppedBoardPointsOf,
} from '@/pages/season/lib/seasonPlayerCard'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
import { BallPatternTranslucentImage } from '@/pages/special/ui/SkinBackdrops'
import { color565Of } from '@/shared/lib/pixelEffect/pixelEffect'

/** 판 색 셋 (565) — SVG 판과 같은 색 */
const BOARD_COLORS_565 = {
  edge: color565Of(ORIGINAL_COLORS.boardEdge) ?? 0,
  highlight: color565Of(ORIGINAL_COLORS.boardHighlight) ?? 0,
  fill: color565Of(ORIGINAL_COLORS.boardFill) ?? 0,
} as const

/**
 * 합성 캔버스 칸 — team_logo 는 팀마다 크기가 달라(73×33 ~ 78×76) 원본처럼 실제 크기로 가운데를 잡으므로(`seasonCardLogoPlaceOf`)
 * 가장 큰 80×80 까지 덮는 칸을 잡는다
 */
const LOGO_BOX = { ...seasonCardLogoPlaceOf(80, 80), width: 80, height: 80 } as const

/** 로고 칸이 판의 왼쪽 평평한 몫 안에 드는가 — 아니면 줄 색으로 다룰 수 없다 */
const LOGO_IN_BOARD_LEFT = LOGO_BOX.x >= 1 && LOGO_BOX.x + LOGO_BOX.width <= steppedBoardLeftEnd(SEASON_CARD_BOARD.offset)

/** 로고 아래 줄 — 판 위면 null(공 무늬가 그대로), 판이면 그 줄 색 */
const boardRowUnderLogo = (y: number) =>
  LOGO_IN_BOARD_LEFT ? steppedBoardLeftRow565(y, SEASON_CARD_BOARD.top, SEASON_CARD_BOARD.height, BOARD_COLORS_565) : undefined

/**
 * **카드 판 — 0x7ba44 머리 (계단형 판 · 반투명 로고)**. 직접 떴다:
 * ```
 * 7ba4c  [gfx+0x138](mode_ui) == 0 이면 카드를 통째로 건너뛴다(0x7c0c6)
 * 7ba72  0x76725([gfx+0x134])                                   ; 계단형 판
 * 7ba9c  로고 [gfx+0x140] 이 있으면 (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 에 0xba1d5(…, 효과, 인자 12, 0)
 *        시즌(0x7b998)이면 상태 0xd9 · 0xdc 만 효과 1 · 그 밖 0 / 나리(7bb72~7bbc6)는 늘 효과 1 · 인자 12 (반투명 12/16)
 * 7bbca  딱지 [gfx+0x168] 은 시즌 0xca · 0xe4 그리기만 채운다 — 나리는 쓰는 곳이 없어 비어 있다(아래)
 * 7bdce~ mode_ui 8 · img_text 159 "ABILITY" · 레이더 0x5a990 (`AbilityRadar`)
 * ```
 * 나리 장면에서 판 [gfx+0x134] 는 장면의 [this+0xe8] 이다(셋업 0xf8de · 0xfa74~0xfa7c 가 그 값을 gfx+0x134 에 넣는다).
 * - 등록 0x66 · 변화구 고르기 0x67 — 진입 0x17360 · 0x10b18 이 판을 안 고쳐 생성자 0x76610 기본값 (위 0x67, 높이 0x38, 꺾임 0)
 * - 기본정보 119 · 상점 111 · 장비착용 121 — 진입 0x108f8(0x10b0c · 0x115f4 · 0x11594 가 부른다)이 0x10ab4~0x10abc 에서
 *   0x76705(판, 0x67, 0x38, 0) · 로고는 0x10a92 `team_logo 0x6fd9d(0xcc14c, 내 팀, 1)` → [gfx+0x140]
 * - 관리 105 등 다른 상태는 (0x23, 0xbe, 0x1e) 를 쓴다(0x11ac6 · 0x10c00 …) — 카드가 서는 상태는 모두 위 둘이다
 * 로고는 셋업 0x17360 도 내 팀으로 싣는다(0x175fe) — 등록은 팀을 고른 0x65 뒤라 그 팀이다.
 *
 * 딱지 [gfx+0x168] 은 나리에서 0 이다: gfx 생성 0xfa5c 의 0xcaa00 은 `bx r5` 이고 r5 = new 0x1239(0xfa28) → 0x2ac4 가
 * 0x28b8 로 받은 뒤 memset 0x1400428(p, 0, 크기) 로 채운다. `#0xb4 << 1` 꼴로 그 칸을 적는 곳은 시즌 0xe4 · 0xca 진입(0x47b2 · 0x50c8)
 * 뿐이고 나리 쪽 0xfb2a · 0xfeb8 · 0xff5c 는 장면 칸이다.
 * 카드 갈래: 나리 셋업 0xf69c~0xf6ae · 0xfa6a~0xfa72 가 [gfx+0x20] = 전역 모드(3 · 4)라 0x7b998 이 서지 않아
 * 로고는 효과 1 · 12(7bb72~7bbc6) · 레이더는 0x7bfc8 선수 갈래다(0x7beb6~0x7bec0).
 */
export function CardPlate({ teamId, testIdPrefix = '카드' }: { readonly teamId: number; readonly testIdPrefix?: string }) {
  const points = steppedBoardPointsOf(SEASON_CARD_BOARD.top, SEASON_CARD_BOARD.height, SEASON_CARD_BOARD.offset)
  const line = (list: readonly { x: number; y: number }[]) => list.map((point) => `${point.x},${point.y + 1.5}`).join(' ')
  const team = TEAMS[teamId]
  return (
    <>
      {/* 계단형 판 0x76724 — 채움 · 테두리, 위 세 변 y+1 밝은 선 · 아래 세 변 y+1 어두운 선 (관리 화면 판과 같은 그리기) */}
      <svg className={managementStyles.board} viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid={`${testIdPrefix}-판`}>
        <polygon
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          transform="translate(0.5 0.5)"
          fill={ORIGINAL_COLORS.boardFill}
          stroke={ORIGINAL_COLORS.boardEdge}
          strokeWidth={1}
        />
        <polyline points={line(points.slice(0, 4))} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardHighlight} />
        <polyline points={line(points.slice(4).reverse())} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardEdge} />
      </svg>
      {/*
        로고 효과 1 · 12 — 아래(공 무늬 + 판)를 같은 좌표로 다시 그려 원본 식으로 섞는다(Q-03 r301, `BallPatternTranslucentImage`).
        카드가 서는 화면(기본정보 119 · 상점 · 등록 0x66 · 0x67 · 시즌 0xd9 · 0xdc)은 모두 공 무늬 바탕 0x5fd61 위다
      */}
      {team !== undefined && (
        <BallPatternTranslucentImage
          className={managementStyles.layer}
          alt={team.name}
          testId={`${testIdPrefix}-로고`}
          src={team.logoUrl}
          {...LOGO_BOX}
          level={SEASON_CARD_LOGO.level}
          rowOver={boardRowUnderLogo}
          imagePlaceOf={seasonCardLogoPlaceOf}
          fallbackRect={SEASON_CARD_LOGO}
        />
      )}
    </>
  )
}
