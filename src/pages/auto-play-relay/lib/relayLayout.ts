import type { HalfInningCardsAt } from '@/widgets/game-scene/ui/HalfInningCards'

/** "공격팀(%s)" 의 %s — st[0x31 + st[9]] == 0(사람 칸)이면 "PLAYER"(0xd0724), 아니면 "COM"(0xd072c) */
export const OFFENSE_LABEL = { player: 'PLAYER', computer: 'COM' } as const

/** 화면 240×320 — W · H */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/**
 * **기준 칸** — 425bc `0x94a65(out, game_ui 프레임 19, 0, 4)` = `boxes.json` "019" 상자 4 (14, 213, 212, 57) — 교대 판 0x4fe9c 와 같은
 * 칸(`HALF_INNING_CARDS_SPAN`). 0x4258c 는 그 **폭**(+4)으로 가로 자리를, **높이**(+6 — `ldrsh [sp, #0x92]`)로 띠 · 글의 y 를 잡는다.
 */
const BASE_BOX = { width: 212, height: 57 } as const

/** 두 팀 판 — 0x420dc(경기, W/2 − 폭/2 − 6, H − 0x46) → 0x42364(경기, W/2 + 0x24, H − 0x46) 차례 (4283e~4289a) */
export const RELAY_CARDS_AT: HalfInningCardsAt = {
  pitcherX: SCREEN_WIDTH / 2 - BASE_BOX.width / 2 - 6,
  dueUpX: SCREEN_WIDTH / 2 + 0x24,
  y: SCREEN_HEIGHT - 0x46,
}

/** "공격팀(%s)" 띠 — 0x6b7d4(gfx, W/2 − 폭/2, 높이 + 0xf, 폭, 0x12, 1, 0xB4122352) (428b8~428e2) */
export const OFFENSE_BAND = {
  x: SCREEN_WIDTH / 2 - BASE_BOX.width / 2,
  y: BASE_BOX.height + 0xf,
  width: BASE_BOX.width,
  height: 0x12,
} as const

/** 띠 글 — 0xba269(글, W/2 − 폭/2 + 5, 높이 + 0x13, 폭, −1, 0) 왼쪽 맞춤 노랑 (42974~429aa) */
export const OFFENSE_TEXT_AT = { x: OFFENSE_BAND.x + 5, y: BASE_BOX.height + 0x13 } as const

/**
 * 공격 팀 이름 그림 — img_text 프레임 0xb6bdd(st, st[9]) + 0x41 을 오른쪽 끝 (W/2 + 폭/2 − 그림폭 − 5, 높이 + 0x13) 에
 * (0x913e5 팔레트 0 · 0xba815 크기 · 0xba759, 429ae~42a16)
 */
export const OFFENSE_TEAM_RIGHT = SCREEN_WIDTH / 2 + BASE_BOX.width / 2 - 5
export const TEAM_NAME_BASE_FRAME = 0x41

/**
 * 중계 글 칸 — 0x7c×0x12 칸을 ((W − 0x7c) >> 1, ((H − 0x12) >> 1) + 0x2d) 에 0xba0bd(둥글기 1, 0xB4122352),
 * 글 `"!C!cffff00%s"`(0xd0744) 는 0xba269(글, 칸x, 칸y + 4, 0x7c, −1, 0) 가운데 노랑 (42a1a~42aae, sim+0xc4 ≠ 0 일 때만)
 */
export const RELAY_BOX = {
  x: (SCREEN_WIDTH - 0x7c) >> 1,
  y: ((SCREEN_HEIGHT - 0x12) >> 1) + 0x2d,
  width: 0x7c,
  height: 0x12,
} as const
