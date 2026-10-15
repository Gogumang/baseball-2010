import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SEASON_CARD_BOARD, SEASON_CARD_LOGO, steppedBoardPointsOf } from '@/pages/season/lib/seasonPlayerCard'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'

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
 * ⚠️ 미확인: 딱지 [gfx+0x168] 이 나리에서 0 이라는 것은 쓰는 곳이 시즌 함수(0x47b2 · 0x50c8)뿐이라는 데서 미루었다
 * (gfx 생성 0xfa5c 의 0xcaa00 이 0 으로 채우는지는 안 읽었다).
 */
export function CardPlate({ teamId, testIdPrefix = '카드' }: { readonly teamId: number; readonly testIdPrefix?: string }) {
  const points = steppedBoardPointsOf(SEASON_CARD_BOARD.top, SEASON_CARD_BOARD.height, SEASON_CARD_BOARD.offset)
  const line = (list: readonly { x: number; y: number }[]) => list.map((point) => `${point.x},${point.y + 1.5}`).join(' ')
  const team = TEAMS[teamId]
  return (
    <>
      {/* 계단형 판 0x76724 — 채움 · 테두리, 위 세 변 y+1 밝은 선 · 아래 세 변 y+1 어두운 선 (관리 화면 판과 같은 그리기) */}
      <svg className={managementStyles.board} viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid={`${testIdPrefix}-판`}>
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} transform="translate(0.5 0.5)"
          fill={ORIGINAL_COLORS.boardFill} stroke={ORIGINAL_COLORS.boardEdge} strokeWidth={1} />
        <polyline points={line(points.slice(0, 4))} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardHighlight} />
        <polyline points={line(points.slice(4).reverse())} transform="translate(0.5 0)" fill="none" stroke={ORIGINAL_COLORS.boardEdge} />
      </svg>
      {team !== undefined && (
        <img className={managementStyles.layer} alt={team.name} data-testid={`${testIdPrefix}-로고`} src={team.logoUrl}
          style={{
            left: SEASON_CARD_LOGO.x, top: SEASON_CARD_LOGO.y, width: SEASON_CARD_LOGO.width, height: SEASON_CARD_LOGO.height,
            opacity: SEASON_CARD_LOGO.opacity,
          }} />
      )}
    </>
  )
}
