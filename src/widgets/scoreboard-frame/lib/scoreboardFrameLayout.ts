/**
 * **점수판 틀 `0x41440(장면, x, y, 효과, 효과인자, 아래칸밀기)`** — 직접 떴다(0x41440~0x41766).
 *
 * ```
 * 41450  팀 = 0xb6bdd(st, 0) · 0xb6bdd(st, 1)
 * 41466  틀 = game_ui([장면+0x1018]) 프레임 16 → 0xba19d(틀, x, y, 효과, 효과인자, 0)           ; 원점 (x, y)
 * 41490  박스 0: 0xb6c21(st, 0) == 1(CPU) ? img_text 158 "COM" : 157 "PLAYER"
 *        0x913e5([0x1552ae8], 4)(img_text 팔레트 4 — 회색) · 0xb9e05(글, 박스, 정렬 0x22, 효과, 효과인자)
 * 414fe  박스 1: 측 1 의 같은 글자 (팔레트 4)
 * 41572  박스 2: 0xb9d35([장면+0x104c], 박스, 0x22, 효과, 효과인자)  ; team_logo 그림[측 0 팀] (적재 8 0x489f4)
 * 415ba  박스 3: 0xb9d35([장면+0x1050], …)                           ; team_logo 그림[측 1 팀] (0x48a08~0x48a24)
 * 41600  박스 4 (y 에 아래칸밀기를 더한다):
 *          [장면+0x1c] ≠ 0xc  → 0xba0bd(박스, 둥글기 1, RGB(0x24, 0x36, 0x77))
 *          [장면+0x1c] == 0xc → 0xba0bd(박스, 둥글기 1, (s16[장면+0x17e4] << 24) | 0x243677)   ; 인트로만 알파
 *        0x913e5(…, 0)(팔레트 0 — 흰색) · 0xb9e05(img_text 0x41 + 팀0, 박스, 0x22, 효과, 효과인자)
 * 416b2  박스 5: 같은 칠 · img_text 0x41 + 팀1
 * ```
 * 박스 = 0x94a65(out, 틀, 0, k) = game_ui 프레임 16 의 박스 k (`boxes.json` "016") 에 (x, y) 를 더한 것.
 *
 * 부르는 곳 (xref 넷):
 * - 0x4a97a 팀경기 정산 0x4a384 — (W/2 − 120, H/2 − 80, 0, 0, 0) = (0, 80)
 * - 0x4ff12 상태 0x18 그리기 0x4fe9c — (0, 경기 끝 ? 3 : 0, 0, 0, 0). 교대 판은 틱 > 0x45 일 때만, 경기 끝 판은 늘
 * - 0x419f4 인트로 0x417ac — (W/2 − 120, H/2 − 70, [+0x17e6] ≤ 14 ? 1 : 0, 그때 [+0x17e6], 0) = (0, 90)
 * - 0x41b54 0x41a64(수비 장면 0x46c88 의 득점 점수판) — (0, 0x32, 0, 0, 0) · 웹 수비 장면 밖이라 여기서 안 끼운다
 * 아래칸밀기(다섯째 인자)는 네 곳 모두 0 이다.
 *
 * 효과 1 · 인자 L (R6 3a, 확정) = 반투명 겹치기 — 그림 몫 L/16, L 이 0 이거나 16 이상이면 아무것도 안 그린다.
 * 칠 0x6b7d4 의 알파 윗바이트는 0·0xff 면 불투명, 그 밖이면 섞는다(0x6aa64 도 같은 검사) — 웹은 알파/255 불투명도.
 */

export interface ScoreboardBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const box = (x: number, y: number, width: number, height: number): ScoreboardBox => ({ x, y, width, height })

/** game_ui 프레임 16 (192×71, 원점에서 (23, 21)) — 흰 막대 둘과 "VS" */
export const SCOREBOARD_FRAME = 16

/** game_ui 프레임 16 박스 0~5 (`public/sprites/game_ui/frames/boxes.json` "016") */
export const SCOREBOARD_BOXES: readonly ScoreboardBox[] = [
  box(28, 21, 49, 15), box(162, 21, 49, 15),
  box(22, 43, 66, 68), box(153, 43, 66, 68),
  box(14, 120, 82, 15), box(144, 119, 82, 15),
]

/** img_text 157 "PLAYER" · 158 "COM" — `0xb6c21(st, 측) == 1` 이면 COM (0x41496 `movs r7, #0x9d` · 0x414a0 `#0x9e`) */
export const SIDE_LABEL_FRAME = { player: 157, computer: 158 } as const
/** 팀 이름 글자 = img_text 0x41 + 팀 (0x41684 `adds r0, #0x41`) */
export const TEAM_NAME_BASE_FRAME = 0x41
/** 이름 칸 칠 RGB(0x24, 0x36, 0x77) (0x41634~0x4163c) */
export const NAME_PLATE_COLOR = '#243677'
/** 0xba0bd 의 둥글기 */
export const NAME_PLATE_ROUND = 1
/** 인트로 장면 상태 (0x4162e `cmp r3, #0xc`) */
export const INTRO_SCENE_STATE = 0xc

/** img_text 프레임 크기 (원점은 모두 (0, 0)) — `img_text/frames/origins.json` */
const IMG_TEXT_SIZES: Readonly<Record<number, readonly [number, number]>> = {
  157: [39, 5], 158: [20, 5],
  65: [65, 10], 66: [53, 10], 67: [53, 10], 68: [54, 10], 69: [64, 10], 70: [63, 10], 71: [54, 10], 72: [64, 10],
  73: [62, 10], 74: [65, 10], 75: [43, 10], 76: [20, 10], 77: [21, 10], 78: [20, 10], 79: [41, 10], 80: [22, 10],
  81: [19, 10],
}

/** team_logo 그림 크기 (PNG 를 읽었다) — 0..16 */
const TEAM_LOGO_SIZES: readonly (readonly [number, number])[] = [
  [77, 76], [76, 77], [76, 77], [78, 76], [76, 78], [75, 76], [77, 76], [76, 77], [76, 76], [76, 76],
  [76, 76], [76, 77], [76, 77], [77, 76], [77, 76], [32, 48], [73, 33],
]

export const imgTextSizeOf = (frame: number) => IMG_TEXT_SIZES[frame] ?? null
export const teamLogoSizeOf = (team: number) => TEAM_LOGO_SIZES[team] ?? null

/**
 * 프레임 가운데(0xb9e05 → 0xb9d74, 정렬 0x22): 가로 `x + ((박스폭 − 폭) >> 1)`, 세로 e = 박스높이 − 높이 →
 * `y + trunc(e/2) + e % 2` (`pages/national-cup/lib/nationalCupLayout.frameCenterOf` 와 같은 식).
 */
export function frameCenterOf(target: ScoreboardBox, width: number, height: number) {
  const dy = target.height - height
  return { x: target.x + ((target.width - width) >> 1), y: target.y + Math.trunc(dy / 2) + (dy % 2) }
}

/** 그림 가운데(0xb9d35 → 0xb9c5c, 정렬 0x22): d = 박스폭 − 폭 → `x + trunc(d/2) + d % 2`, 세로 `y + trunc((박스높이 − 높이)/2)` */
export function imageCenterOf(target: ScoreboardBox, width: number, height: number) {
  const dx = target.width - width
  return { x: target.x + Math.trunc(dx / 2) + (dx % 2), y: target.y + Math.trunc((target.height - height) / 2) }
}

export interface ScoreboardSide {
  /** 0xb6bdd(st, 측) */
  readonly team: number
  /** 0xb6c21(st, 측) == 1 — 그 측을 CPU 가 맡는다 (st[0x31 + 측]) */
  readonly isComputer: boolean
}

export interface ScoreboardPlacement {
  readonly frame: { readonly x: number; readonly y: number }
  readonly labels: readonly { readonly frame: number; readonly x: number; readonly y: number }[]
  readonly logos: readonly { readonly team: number; readonly x: number; readonly y: number }[]
  readonly plates: readonly ScoreboardBox[]
  readonly names: readonly { readonly frame: number; readonly x: number; readonly y: number }[]
}

const moved = (target: ScoreboardBox, x: number, y: number) => box(target.x + x, target.y + y, target.width, target.height)

/** 0x41440 의 그림 자리 (크기를 모르는 글자·로고는 뺀다) */
export function scoreboardPlacementOf(x: number, y: number, sides: readonly [ScoreboardSide, ScoreboardSide]): ScoreboardPlacement {
  const labels = sides.flatMap((side, index) => {
    const frame = side.isComputer ? SIDE_LABEL_FRAME.computer : SIDE_LABEL_FRAME.player
    const size = imgTextSizeOf(frame)
    if (size === null) return []
    return [{ frame, ...frameCenterOf(moved(SCOREBOARD_BOXES[index], x, y), size[0], size[1]) }]
  })
  const logos = sides.flatMap((side, index) => {
    const size = teamLogoSizeOf(side.team)
    if (size === null) return []
    return [{ team: side.team, ...imageCenterOf(moved(SCOREBOARD_BOXES[2 + index], x, y), size[0], size[1]) }]
  })
  const plates = [moved(SCOREBOARD_BOXES[4], x, y), moved(SCOREBOARD_BOXES[5], x, y)]
  const names = sides.flatMap((side, index) => {
    const frame = TEAM_NAME_BASE_FRAME + side.team
    const size = imgTextSizeOf(frame)
    if (size === null) return []
    return [{ frame, ...frameCenterOf(plates[index], size[0], size[1]) }]
  })
  return { frame: { x, y }, labels, logos, plates, names }
}

/** 효과 1 · 인자 L 의 그림 불투명도 — L/16, 0 이나 16 이상이면 0 (안 그린다). 효과 0 이면 1 */
export function effectOpacityOf(effectLevel: number | null): number {
  if (effectLevel === null) return 1
  return effectLevel >= 1 && effectLevel <= 15 ? effectLevel / 16 : 0
}

/** 인트로(0x417ac) 의 효과 — `[+0x17e6] ≤ 14` 면 효과 1 · 인자 [+0x17e6], 아니면 효과 0 (0x417ce~0x417d8) */
export const introScoreboardEffectOf = (level: number): number | null => (level <= 14 ? level : null)

/** 이름 칸 칠의 불투명도 — 인트로면 알파 [+0x17e4] (0·255 는 불투명), 그 밖은 불투명 */
export function namePlateOpacityOf(introAlpha: number | null): number {
  if (introAlpha === null) return 1
  const alpha = introAlpha & 0xff
  return alpha === 0 || alpha === 0xff ? 1 : alpha / 255
}

/** 둥근 칠 0x6b7d4(x, y, w, h, 둥글기 ≤ 3) — (w+1)×(h+1) 에서 네 모서리 점이 빠진 꼴. 두 직사각형으로 */
export function roundPlateRectsOf(target: ScoreboardBox): readonly ScoreboardBox[] {
  return [
    box(target.x + 1, target.y, target.width - 1, target.height + 1),
    box(target.x, target.y + 1, target.width + 1, target.height - 1),
  ]
}

/**
 * 부르는 곳별 (x, y) — 화면 240×320.
 * 정산 0x4a97a (W/2 − 120, H/2 − 80) · 교대/경기 끝 판 0x4ff12 (0, 0 / 3) · 인트로 0x419f4 (W/2 − 120, H/2 − 70).
 */
export const SCOREBOARD_AT = {
  settlement: { x: 0, y: 80 },
  halfInning: { x: 0, y: 0 },
  gameEnd: { x: 0, y: 3 },
  intro: { x: 0, y: 90 },
} as const

/** 교대 판은 틱 > 0x45 부터 점수판을 그린다 (0x4ff00 `cmp r3, #0x45; bgt`) — 그 전은 운동장 전경만 */
export const HALF_INNING_SCOREBOARD_FROM_TICK = 0x46

/**
 * 사람 팀이 한 측, CPU 가 다른 측인 경기의 두 측 — st[0x31 + 측] 은 사람 칸이 0 이다
 * (팀경기·나리 모두 내 팀 PLAYER · 상대 COM — `teamMatchupCards` · `gameMatchupCards` 와 같다).
 */
export function humanVsComputerSidesOf(
  playerSide: number, ourTeam: number, opponentTeam: number,
): readonly [ScoreboardSide, ScoreboardSide] {
  const our: ScoreboardSide = { team: ourTeam, isComputer: false }
  const opponent: ScoreboardSide = { team: opponentTeam, isComputer: true }
  return playerSide === 0 ? [our, opponent] : [opponent, our]
}
