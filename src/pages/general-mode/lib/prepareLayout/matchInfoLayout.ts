/** k = 4 경기정보 (0x64d30~0x65108) — 줄 딱지 · PLAY BALL · 반원 · 값 칸 · 누름 칸 */
import { FIRST_BAT_LAYOUT } from './firstBatLayout'
import { SCREEN, TEAM_LOGO_HALF } from './prepareCommon'

/** 줄 딱지 img_text 프레임 — 표 0xd1e84 [47 순위, 48 승패, 49 선발, 51 마투수, 50 마타자] */
export const MATCH_INFO_LABEL_FRAMES = [47, 48, 49, 51, 50] as const

/**
 * 줄 i 의 y = `H/2 − 15 + s + 17·i + 38`, **둘째 무리(i ≥ 2)부터 +8** (0x64f2a~0x65074).
 * k = 4 는 s = 0 이라 183·200·225·242·259 가 된다.
 */
export function matchInfoRowY(index: number): number {
  return SCREEN.height / 2 - 15 + 17 * index + 38 + (index >= 2 ? 8 : 0)
}

export const MATCH_INFO_LAYOUT = {
  anchorA: { x: 52, y: 110 },
  anchorB: { x: 188, y: 92 },
  /** slt_frame **프레임 0** "PLAY BALL"(공 46×46) 을 (W/2 − w/2, y0 − 33) */
  playBall: { frame: 0, y: 112 },
  /**
   * 노랑 반원 slt_frame 이미지 6(26×52) — 왼쪽 (W/2 − 26, 109) · 오른쪽 뒤집어 (119, 109).
   * 값 줄 0x5dcc0 이 다 펼쳐졌다고 돌려주고([skin+0xe4] ≠ 0) **깜빡 [sp+0xd4] 일 때만** 그린다 (0x65078~0x65108).
   */
  halfCircle: { image: 6, width: 26, height: 52, leftX: SCREEN.width / 2 - 26, rightX: 119, y: 109 },
  /**
   * 화살 slt_frame 이미지 20 을 (W/2 − d − 7, 98) · 효과 0x11 로 (W/2 + d + 1, 98) — d = 깜빡 [sp+0xd4] (0 · 1) (0x64eba~0x64f08).
   */
  arrow: { image: 20, width: 5, height: 8, y: 98, leftX: SCREEN.width / 2 - 7, rightX: SCREEN.width / 2 + 1 },
  /** 딱지 판 slt_frame 이미지 18(39×15 흰 막대)을 (W/2 − 19, y), 글씨는 그 +2 */
  labelBar: { image: 18, width: 39, height: 15, x: SCREEN.width / 2 - 19, textDy: 2 },
  /**
   * 값 칸 0x5dcc0(skin, W/2 − 104 = 16, H/2 − 15 + 0x2e, …) — 칸 i 를 번갈아 유저 · CPU 로 그린다 (0x5de44~0x5e248, 직접 떴다):
   * 유저 slt_frame 이미지 10(86×15) 을 (16, 줄y + 3) · CPU 는 효과 0x11(좌우 뒤집기)로 (16 + 128 − 6 = 138, 줄y − 3).
   * 글은 칸 가운데(x + 43)에 칸 y + 2 로 놓는다(0x9c068).
   */
  valueCell: { image: 10, width: 86, height: 15, userX: 16, cpuX: 138, userDy: 3, cpuDy: -3, textDy: 2 },
  /** 선공 꼬리표는 k = 3 과 같은 자리를 쓴다 */
  firstBatTag: FIRST_BAT_LAYOUT.firstBatTag,
} as const

/**
 * 경기정보(k 4) 투명 누름 칸 — 가운데 PLAY BALL 공(slt_frame 0, 46×46) = OK.
 * `playBall.y` 는 이미 공의 왼쪽 위(y0 − 33)라 그대로 쓴다 — 예전에는 33 을 한 번 더 빼 칸이 공보다 33px 위에 떠서
 * 공을 눌러도 경기가 안 열렸다 (r157)
 */
export const MATCH_INFO_PLAY_BALL_PRESS_RECT = {
  x: SCREEN.width / 2 - 23,
  y: MATCH_INFO_LAYOUT.playBall.y,
  width: 46,
  height: 46,
} as const

/** 경기정보 투명 누름 칸 — 엠블럼(76×76) 자리 = ←/→ 엔트리 */
export const matchInfoLogoPressRectOf = (anchor: { readonly x: number; readonly y: number }) => ({
  x: anchor.x - TEAM_LOGO_HALF.width,
  y: anchor.y - TEAM_LOGO_HALF.height,
  width: TEAM_LOGO_HALF.width * 2,
  height: TEAM_LOGO_HALF.height * 2,
})
