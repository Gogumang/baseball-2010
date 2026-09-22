import { SKY_COLOR_PAIRS, SKY_COLOR_ROWS } from '@/shared/config/original/stadiumScene'

/**
 * 타석 화면 배경·투수·판정 연출 (위치 분석 6차 — 바이트 확인, 추정은 표시).
 */
const SKY_LAST_COLUMN = 12

/** 하늘 색 (0x77fe8) — 행은 구장 팀 데이터 +0xb2 (없으면 rand(0,6)), 열은 min(이닝, 12) */
export function skyColorsOf(row: number, inning: number): { top: string; bottom: string; colorIndex: number } {
  const rowIndex = Math.max(0, Math.min(SKY_COLOR_ROWS.length - 1, row))
  const column = Math.max(0, Math.min(SKY_LAST_COLUMN, inning))
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

/** 색 번호 9 미만일 때만 구름을 그린다. 원본은 팔레트 번호−1 로 색을 바꾸지만 팔레트는 아직 옮기지 않았다 (추정) */
export function isCloudVisible(colorIndex: number): boolean {
  return colorIndex < NIGHT_COLOR_INDEX
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
