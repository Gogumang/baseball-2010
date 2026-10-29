/** 애니 칸 한 줄 — game_judge animations.json 그대로 (dx · dy 는 0x93c45 가 자리에 더한다) */
export interface JudgeAnimationEntry {
  readonly frame: number
  readonly delay: number
  readonly dx?: number
  readonly dy?: number
}

/**
 * game_judge.pzx(게임+0x101c)의 애니 — 판정 코드 v 가 쓰는 것만 (표 0xcfe90, R2 7절).
 * 1 → 0 STRIKE · 2 → 3 BALL · 3 → 6 BASE ON BALLS · 4 → 7 HIT BY THE PITCH · 5 → 9 STRIKE OUT · 7 → 4 FOUL · 9 → 5 SAFE ·
 * 10 → 8 GROUND RULE DOUBLE · 11 · 13 → 1 OUT. 6 · 8 · 12 는 표가 0x394d6(아무것도 안 함)으로 보낸다.
 */
export const JUDGE_TEXT_ANIMATIONS: Readonly<Record<number, readonly JudgeAnimationEntry[]>> = {
  0: [
    { frame: 18, delay: 2 },
    { frame: 19, delay: 2 },
    { frame: 20, delay: 2 },
    { frame: 21, delay: 1 },
    { frame: 22, delay: 5 },
    { frame: 23, delay: 2 },
    { frame: 24, delay: 1 },
    { frame: 39, delay: 0 },
  ],
  1: [
    { frame: 35, delay: 3 },
    { frame: 37, delay: 2 },
    { frame: 38, delay: 1 },
    { frame: 37, delay: 2 },
    { frame: 36, delay: 1 },
    { frame: 39, delay: 0 },
  ],
  3: [
    { frame: 30, delay: 2 },
    { frame: 31, delay: 2 },
    { frame: 32, delay: 2 },
    { frame: 31, delay: 3 },
    { frame: 33, delay: 2 },
    { frame: 34, delay: 2 },
    { frame: 39, delay: 0 },
  ],
  4: [
    { frame: 7, delay: 2 },
    { frame: 6, delay: 2 },
    { frame: 6, delay: 2, dy: 1 },
    { frame: 6, delay: 2, dy: 3 },
    { frame: 39, delay: 0 },
  ],
  5: [
    { frame: 8, delay: 2 },
    { frame: 10, delay: 2 },
    { frame: 10, delay: 5 },
    { frame: 11, delay: 1 },
    { frame: 39, delay: 0 },
  ],
  6: [
    { frame: 14, delay: 2 },
    { frame: 12, delay: 2 },
    { frame: 13, delay: 2 },
    { frame: 14, delay: 2 },
    { frame: 15, delay: 2 },
    { frame: 12, delay: 4 },
    { frame: 39, delay: 2 },
  ],
  7: [
    { frame: 1, delay: 1 },
    { frame: 0, delay: 1 },
    { frame: 2, delay: 1 },
    { frame: 3, delay: 1 },
    { frame: 1, delay: 1 },
    { frame: 0, delay: 4 },
    { frame: 39, delay: 1 },
  ],
  8: [
    { frame: 17, delay: 2 },
    { frame: 16, delay: 2 },
    { frame: 16, delay: 2, dx: -1, dy: 1 },
    { frame: 16, delay: 2, dx: 1, dy: -1 },
    { frame: 16, delay: 2 },
    { frame: 39, delay: 2 },
  ],
  9: [
    { frame: 18, delay: 2 },
    { frame: 19, delay: 2 },
    { frame: 20, delay: 2 },
    { frame: 21, delay: 1 },
    { frame: 22, delay: 2 },
    { frame: 25, delay: 2 },
    { frame: 26, delay: 2 },
    { frame: 27, delay: 4 },
    { frame: 28, delay: 2 },
    { frame: 29, delay: 1 },
    { frame: 39, delay: 0 },
  ],
}

/** 표 0xcfe90 — 판정 코드 v(1~13) → game_judge 애니. 없으면 null (6 · 8 · 12 · 범위 밖) */
const JUDGE_CODE_ANIMATIONS: Readonly<Record<number, number>> = {
  1: 0,
  2: 3,
  3: 6,
  4: 7,
  5: 9,
  7: 4,
  9: 5,
  10: 8,
  11: 1,
  13: 1,
}

export function judgeTextAnimationOf(code: number): number | null {
  return JUDGE_CODE_ANIMATIONS[code] ?? null
}

/**
 * 되감은 뒤 `advances` 번 넘긴(0x93d90) 애니의 지금 칸. 한 칸은 max(1, 지연) 번 넘기면 다음 칸으로 가고, 마지막 칸을 넘기면
 * 되풀이 비트가 없어 마지막 칸에 멈춘다(93e16 → 0x93d30(애니, 0)).
 */
export function judgeAnimationEntryAt(entries: readonly JudgeAnimationEntry[], advances: number): JudgeAnimationEntry {
  let remaining = Math.max(0, advances)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry
    remaining -= length
  }
  return entries[entries.length - 1]
}
