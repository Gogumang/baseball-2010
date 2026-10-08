import { SKY_COLOR_PAIRS, SKY_COLOR_ROWS } from '@/shared/config/original/stadiumScene'

/**
 * 타석 화면 배경·투수·판정 연출 (위치 분석 6차 — 바이트 확인, 추정은 표시).
 */
const SKY_LAST_COLUMN = 12

/** 하늘 표 0xd37a4 의 줄 수 — 0x783b0 이 6 으로 나눈 나머지를 쓴다 */
export const SKY_ROW_COUNT = 6

/**
 * 하늘 칸 — 이닝 넘김 0x3ad22 가 구장 +0x18 에 쓰는 **경기 상태 +0x6b(0부터 세는 이닝 인덱스)** 다(E-defense-rules · 0xb6b6c).
 * 웹 `GameState.inning` 은 1부터 세므로 하나 뺀다 — 1회 = 칸 0.
 */
export function skyColumnOfInning(inning: number): number {
  return inning - 1
}

/**
 * **하늘 줄 — 구장 +0x10** `0x783b0(구장)` (2026-10-08 직접 뜸). 구장 준비 0x352e8(354d2)이 경기 적재(상태 8 갱신 0x48658)와
 * 홈런더비 결과 진입(0x4f574)에서 한 번 부른다 — 곧 **경기 장면 하나에 한 번** 고르고 그 경기 내내(정산 0x19 결과 그림까지) 같은 줄이다.
 * ```
 * 783b2  m = 전역 모드 [0x1552d10]
 *        m ∈ {1, 8, 9}(0x302) → 0xb6bdc(경기 상태, 0) = 경기[0x28](측 0 — 선공 팀 번호)
 *        m == 2               → 0x1f55c(앱)(시즌 레코드) +0xb2   ; 리그 날짜 g
 *        m ∈ {3, 4}           → 0x1f8d4(앱)(나리 저장) +0xb2     ; = 리그 +0x32 날짜 g (국가대항전 중엔 대회 날짜)
 *        그 밖(0 · 5 · 6 · 7)  → rand(0, 6)
 * 78404  구장+0x10 = 값 mod 6 (0xca911) · 구장+0x18 = 경기 상태 +0x6b
 * ```
 * 모드 1 · 2 · 3 · 4 · 8 · 9 는 굴림이 없다. 굴리는 모드면 null 을 돌려준다(부르는 쪽이 장면을 세울 때 굴린다).
 */
export function stadiumSkyRowOf(source: {
  readonly mode: number
  /** 리그 날짜 g (시즌 레코드 · 나리 저장 +0xb2) — 모드 2 · 3 · 4 */
  readonly dayCounter?: number
  /** 경기[0x28] — 측 0(선공) 팀 번호 — 모드 1 · 8 · 9 */
  readonly side0TeamId?: number
}): number | null {
  const { mode } = source
  let value: number
  if (mode === 1 || mode === 8 || mode === 9) value = source.side0TeamId ?? 0
  else if (mode === 2 || mode === 3 || mode === 4) value = source.dayCounter ?? 0
  else return null
  // 0xca911 — C 의 나머지(부호는 나뉨수를 따른다). s8 칸이라 음수는 안 온다
  return value % SKY_ROW_COUNT
}

/** 하늘 색 (0x77fe8 · 0x76fc4) — 행은 구장 +0x10(`stadiumSkyRowOf`), 열은 min(칸, 12) — 칸은 `skyColumnOfInning` */
export function skyColorsOf(row: number, skyColumn: number): { top: string; bottom: string; colorIndex: number } {
  const rowIndex = Math.max(0, Math.min(SKY_COLOR_ROWS.length - 1, row))
  const column = Math.max(0, Math.min(SKY_LAST_COLUMN, skyColumn))
  const colorIndex = SKY_COLOR_ROWS[rowIndex][column]
  const [topRed, topGreen, topBlue, bottomRed, bottomGreen, bottomBlue] = SKY_COLOR_PAIRS[colorIndex]
  return {
    top: `rgb(${topRed}, ${topGreen}, ${topBlue})`,
    bottom: `rgb(${bottomRed}, ${bottomGreen}, ${bottomBlue})`,
    colorIndex,
  }
}

/** 구름 (0x78448) — 3틱마다 구름 i 가 i+1 px 이동, −480 미만이면 +480 */
export const CLOUD_WRAP_WIDTH = 480
const CLOUD_TICKS_PER_STEP = 3
const NIGHT_COLOR_INDEX = 9

export function cloudScrollAt(cloudIndex: number, tick: number): number {
  const moved = (cloudIndex + 1) * Math.floor(Math.max(0, tick) / CLOUD_TICKS_PER_STEP)
  const wrapped = moved % CLOUD_WRAP_WIDTH
  return wrapped === 0 ? 0 : -wrapped
}

/**
 * **결과 창 뒤 구장 밀기** — 장면 +0x17e2 (홈런더비 결과 창, 상태 0x1a):
 * ```
 * 진입 0x4f574  4f6b4  +0x17e2 = 0
 * 갱신 0x3c0b8  3c0c0  +0x17e2 += 5 ; > 150(0x96) 이면 150
 * 그리기 0x45c18  45c4c 0x78448(구름 흐르기) · 45c62 0x78578(구장, (s16)+0x17e2, 1)
 * ```
 * 한 틱 안에서 진입 → 갱신 → 그리기 차례라(0x52c50) 들어선 틱의 그림부터 5 다. 값만큼 구장·바닥이 **아래로** 내려간다
 * (0x77974 위 = 구장+8 + 값 + 3 · 0x7725c 위 = 구장+8 + 값 + 0xe2) — 하늘만 남기고 30틱에 걸쳐 가라앉는다.
 */
export const RESULT_BACKDROP_STEP = 5
export const RESULT_BACKDROP_LIMIT = 150

/** 결과 창에 들어선 뒤 틱 t(0 = 들어선 틱)의 그림에 쓰는 +0x17e2 */
export function resultBackdropOffsetAt(tick: number): number {
  return Math.min(RESULT_BACKDROP_LIMIT, RESULT_BACKDROP_STEP * (Math.max(0, tick) + 1))
}

/** 색 번호 9 미만일 때만 구름을 그린다 — 0x76ff6 (`v > 8` 이면 구름 그림을 아예 안 싣는다) · 0x782ea */
export function isCloudVisible(colorIndex: number): boolean {
  return colorIndex < NIGHT_COLOR_INDEX
}

/**
 * 하늘 그림 팔레트 줄 — 구장 배경 적재 `0x76fd0` (R6 6절, 다시 떠서 확인).
 * ```
 * 76fd0: 열 = min(구장+0x18 = 경기[0x6b], 12) ; v = (s8) 표0xd37a4[13·구장+0x10 + 열]   ; = skyColorsOf 의 colorIndex
 * 76ff6: v ≤ 8 → 0xb9719("stadium/attack_sky_cloud.pzx", 1, ".mpl", v − 1)     → 구장+0x34
 * 77028:        0xb9719("effect/sky_effect_light1.pzx", 1, 0, −1)             → 구장+0x3c (늘, 팔레트 없음)
 * 7703e: v ≤ 7 → 0xb9719("effect/sky_effect_light.pzx", 1, ".mpl", v ≤ 1 ? −1 : v − 2) → 구장+0x38
 * ```
 * 줄 −1 은 0xb9719 에 "팔레트 없음" = **구운 벌**이라 웹에서는 null 이다.
 * 같은 하늘(열이 그대로)이면 0x76fd8 이 다시 안 싣는다 — 값이 v 하나로만 정해지므로 웹은 매번 셈해도 같다.
 */
export function cloudPaletteRowOf(colorIndex: number): number | null {
  return colorIndex >= 1 ? colorIndex - 1 : null
}

/** 하늘 조명 `sky_effect_light` 를 싣는가 — 0x7703e `cmp #7 / bgt` (그리기 0x784d8 도 같은 검사를 다시 한다) */
export const SKY_LIGHT_LAST_COLOR_INDEX = 7

/** 하늘 조명을 안 그리는 모드 — 5 투수 미션 · 6 타자 미션 · 7 홈런더비 (0x784a2~0x784b0) */
const SKY_LIGHT_HIDDEN_MODES: readonly number[] = [5, 6, 7]

/**
 * 이 게임 모드(전역 `0x1552d10`)에서 하늘 조명 0x78490 을 그리는가 — 모드 5·6·7 이면 안 그린다.
 * 모드를 모르면(undefined) 그 셋이 아닌 것으로 본다.
 */
export function isSkyLightModeShown(gameMode: number | undefined): boolean {
  return gameMode === undefined || !SKY_LIGHT_HIDDEN_MODES.includes(gameMode)
}

export function skyLightPaletteRowOf(colorIndex: number): number | null {
  return colorIndex <= 1 ? null : colorIndex - 2
}

/**
 * 하늘 조명 애니 칸 — 0x78490 이 그린 뒤 `0x93d90`(한 칸 넘기기) · `0x93cfc(애니, 1)`(되풀이로 켜기)를
 * 부르므로 **끝나면 처음으로 돌아가는** 되풀이다. 칸 길이는 판정 글자와 같은 `max(1, 지연)` 틱(0x93d90).
 */
export function skyLightFrameAt(
  entries: readonly { frame: number; delay: number }[],
  tick: number,
): number | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
  let remaining = Math.max(0, tick) % total
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries[entries.length - 1].frame
}

/** 투구 단계 → pitcher.pzx 프레임 (0x9e0b8, 폼 k 는 두 개씩 같은 표 — 홀수 폼은 좌우 반전) */
const PITCH_STEP_FRAMES = [
  [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14],
  [1, 3, 4, 5, 6, 7, 15, 16, 10, 11, 12, 13, 14, 14],
  [2, 3, 4, 5, 6, 7, 17, 18, 10, 11, 12, 13, 14, 14],
]
/** 단계 유지 dur (표 0xd73e9) — 한 단계가 dur+1 틱 */
const PITCH_STEP_DURATIONS = [1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]
/** 공을 놓는 단계 — 공 프레임이 이 단계부터 오른다 (위치 분석 3차 릴리스 idx 6, 5차 단계 6~7 추정) */
const RELEASE_STEP = 6
const LAST_STEP = PITCH_STEP_FRAMES[0].length - 1

const stepStartTicks = PITCH_STEP_DURATIONS.reduce<number[]>(
  (starts, duration, index) => [...starts, (starts[index] ?? 0) + duration + 1],
  [0],
)

export const PITCHER_RELEASE_TICKS = stepStartTicks[RELEASE_STEP]

function stepAt(tick: number, starts: readonly number[], lastStep: number): number {
  let step = 0
  while (step < lastStep && tick >= starts[step + 1]) step += 1
  return step
}

export function pitcherFrameAt(form: number, tick: number): number {
  const table = PITCH_STEP_FRAMES[Math.floor(Math.max(0, form) / 2)] ?? PITCH_STEP_FRAMES[0]
  return table[stepAt(Math.max(0, tick), stepStartTicks, LAST_STEP)]
}

/** 대기 상태 (state 2) — 끝나면 처음부터 되풀이한다 (추정) */
const IDLE_FRAMES = [0, 19, 0, 19, 0]
const IDLE_DURATIONS = [1, 1, 3, 4, 4]
const idleStarts = IDLE_DURATIONS.reduce<number[]>((starts, duration, index) => [...starts, (starts[index] ?? 0) + duration + 1], [0])
const IDLE_CYCLE = idleStarts[IDLE_FRAMES.length]

export function pitcherIdleFrameAt(tick: number): number {
  const cycleTick = Math.max(0, tick) % IDLE_CYCLE
  return IDLE_FRAMES[stepAt(cycleTick, idleStarts, IDLE_FRAMES.length - 1)]
}

/**
 * 투수 덧그림 — 같은 pitcher.pzx 를 **프레임 f + 22 로 한 번 더** 겹쳐 그린다 (확정).
 *
 * 투수 그림 객체의 그리기 0x79524 는 겹칠 판 6개를 쌓아 두고 한 번에 그린다
 * (0x7961e~0x79692, 칸은 L-sound-effects.md 3절과 같다):
 *   0 바탕 pzx [+0x0c] 프레임 f · 1 머리 아이템 [+0x1c] · 2 몸 아이템 [+0x24]
 *   **3 바탕 pzx 를 다시, 프레임 `f + 0x16`** (0x79662 `adds r3,r6,#0x16` → [sp+0x40], 0x7966a [sp+0x58] = [+0x0c])
 *   4 손 아이템 [+0x20] · 5 다리 아이템 [+0x28]
 * 아이템 칸은 obj+0x3e+부위 가 음수면 건너뛰지만 3번 칸은 **조건 없이** 늘 쌓인다.
 *
 * 그래서 pitcher.pzx 의 22~43 번 프레임은 깨진 그림이 아니라 **덧그림 전용**이다:
 *   대기 0·1·2 → 22·23·24 글러브 안 공 · 와인드업 3·4·5·6 → 25·26·27·28 몸통과 던지는 팔
 *   9 → 31 팔 잔상 · 18 → 40 잔상 · 좌완 대기 19·20·21 → 41·42·43 공
 *   그 밖(7·8·10~17)은 29·32~39 빈 프레임이라 아무것도 안 더해진다.
 * 타자가 쓰는 앞몸통 덧그림(`batterLayers.ts` FRONT_OFFSETS)과 같은 방식이다.
 */
export const PITCHER_OVERLAY_FRAME_OFFSET = 0x16

/**
 * 판정 종류 → game_judge 애니 번호 (0x393b4) — 표 0xcfe90 과 같다 (확정, R2-game-effects.md 7절·9절).
 * 안타·홈런은 원본에서 판정 글자가 아니라 타구 연출로 보여 주므로 글자로 둔다.
 */
const JUDGE_ANIMATIONS: Readonly<Record<string, number>> = {
  스트라이크: 0,
  헛스윙: 0,
  아웃: 1,
  볼: 3,
  파울: 4,
  세이프: 5,
  볼넷: 6,
  '몸에 맞는 공': 7,
  인정2루타: 8,
  삼진: 9,
}

export function judgeAnimationOf(text: string): number | null {
  return JUDGE_ANIMATIONS[text] ?? null
}

/** 팀 아이콘 번호 — 14 는 10, 10 이상은 11 (0x77974) */
const HIDDEN_TEAM_ICON = 10
const OTHER_TEAM_ICON = 11
const HIDDEN_TEAM_ID = 14
const FIRST_SPECIAL_TEAM = 10

export function teamIconOf(teamId: number): number {
  if (teamId === HIDDEN_TEAM_ID) return HIDDEN_TEAM_ICON
  return teamId >= FIRST_SPECIAL_TEAM ? OTHER_TEAM_ICON : teamId
}

/**
 * 판정 글자 애니는 반복하지 않는다 — 끝나면 마지막 칸(빈 그림)에 멈춘다.
 * 칸 길이 = max(1, 지연 + 보정) 틱 (0x93d90, R2-game-effects.md 9절). 보정(correction)은
 * 애니 상태별 s8 값으로 보통 0 이다 — 표에 값이 없으면 0 으로 본다.
 */
export function judgeFrameAt(
  entries: readonly { frame: number; delay: number; correction?: number }[],
  tick: number,
): number | null {
  let remaining = Math.max(0, tick)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay + (entry.correction ?? 0))
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries.length === 0 ? null : entries[entries.length - 1].frame
}
