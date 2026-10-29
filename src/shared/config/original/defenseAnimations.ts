/**
 * 수비 화면 그림 동작 번호 — 원본이 야수 · 주자 · 고리 그림에 넘기는 번호 표 (R3 2-1 · R3 8-1 · 0x43cb0).
 * 진행기(`features/defense-play`)가 스냅샷에 싣고 화면(`pages/defense`)이 프레임으로 바꾼다 — 둘이 같은 표를 보게 여기 둔다.
 */

/** 야수 동작 번호 (R3 2-1, 야수 vt44 = 0xa1234 가 +0xa8 에 넣는 값) */
export const FIELDER_ACTION = {
  stand: 0,
  runDown: 1,
  runUp: 2,
  runLeft: 3,
  runRight: 4,
  throw: 5,
  catchLow: 6,
  catchChest: 7,
  diveDown: 8,
  diveUp: 9,
  diveLeft: 0xa,
  diveRight: 0xb,
  catchStill: 0xc,
  fumble: 0xd,
  jumpCatch: 0xe,
  slideCatchDown: 0xf,
  slideCatchUp: 0x10,
  slideCatchLeft: 0x11,
  slideCatchRight: 0x12,
  /** 원본에 프레임 14 로 남아 있는데 **거는 곳을 못 찾은** 동작 (R3 2-1 마지막 줄) */
  unknown0x78: 0x78,
} as const

/** 주자 동작 번호 (R3 8-1 vt40 = 0xa0070 이 프레임으로 바꾸는 값) */
export const RUNNER_ACTION = {
  stand: 0,
  run: 1,
  run2: 2,
  run3: 3,
  run4: 4,
  run5: 5,
  slide: 6,
} as const

/**
 * 공 가진 야수 고리 (0x43cb0) — game_ui 애니 번호. 0x43cf4~0x43d28:
 * `state[0x31 + state[9]] == 0`(공격이 사람)이면 3, 아니면 1, 그리고 경기+0x19ad(레이저 반짝임)면 2 로 덮는다.
 */
export const HOLDER_MARK_ANIM = { cpuOffense: 1, shining: 2, humanOffense: 3 } as const
