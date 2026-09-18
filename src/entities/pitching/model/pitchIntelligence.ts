import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { PITCH_PATTERNS } from '@/shared/config/original/pitchPatterns'
import type { PitchPatternDifficulty } from '@/shared/config/original/pitchPatterns'

/**
 * CPU 투구 AI (위치 분석 5차, 바이트 확인).
 *   구질 목록 0xb6d2c — 투수 레코드 +0x1c 비트마스크, 칸 표 0xd8920
 *   구질 고르기 0x344dc — 마구 조건 → 목록 rand(0,6) 칸
 *   목표 종류 0x9ede0 · 0x9eeac — pitchpattern_*.arr 행 (난이도는 환경설정 +0x2c)
 * 구질 번호 t 는 pitch.zt1 항목 번호 + 1 (1 FASTBALL … 21 SPECIAL, 22 마구).
 */
const SLOT_OF_TYPE = [6, 0, 1, 1, 2, 2, 3, 3, 4, 4, 1, 1, 2, 2, 3, 3, 4, 4, 1, 2, 3, 4]
const LIST_SIZE = 6
const LAST_ORDINARY_TYPE = 21
const FASTBALL = 1
export const MAGIC_PITCH = 22
const MAGIC_SLOT = 5

export function pitchListOf(pitchMask: number, hasMagic: boolean): number[] {
  const list = new Array<number>(LIST_SIZE).fill(0)
  for (let type = 1; type <= LAST_ORDINARY_TYPE; type += 1) {
    if ((pitchMask >>> (type - 1)) & 1) list[SLOT_OF_TYPE[type]] = type
  }
  if (list[0] === 0) list[0] = FASTBALL
  if (hasMagic) list[MAGIC_SLOT] = MAGIC_PITCH
  return list
}

export interface PitchChoiceSituation {
  readonly list: readonly number[]
  /** 남은 마구 횟수 — 마구 목록이 없으면 0 */
  readonly magicCount: number
  readonly runnerCount: number
  readonly strikes: number
  readonly balls: number
}

/** 홈런더비(모드 7) 분기는 웹에 홈런더비가 없어 뺐다 */
export function computerPitchTypeOf(situation: PitchChoiceSituation, random: RandomPort): number {
  const { list, magicCount, runnerCount, strikes, balls } = situation
  const hasMagic = list[MAGIC_SLOT] === MAGIC_PITCH
  const isMagicMoment = runnerCount > 1 || strikes === 2 || (strikes === 0 && (balls === 0 || balls === 3))
  if (hasMagic && magicCount > 0 && isMagicMoment) return MAGIC_PITCH
  let type = list[randomIntegerBelow(random, 0, LIST_SIZE)] ?? 0
  if (type === MAGIC_PITCH && magicCount < 1) type = 0
  return type || FASTBALL
}

export interface CountSituation {
  readonly strikes: number
  readonly balls: number
  readonly outs: number
  readonly runnerCount: number
}

const TARGET_KIND_COUNT = 5
const PERCENT = 100
const TWO_OUTS = 2
const RUNNER_COLUMN = { none: 3, twoOuts: 2, otherwise: 1 }

export function targetKindOf(difficulty: PitchPatternDifficulty, situation: CountSituation, random: RandomPort): number {
  const column =
    situation.runnerCount === 0
      ? RUNNER_COLUMN.none
      : situation.outs === TWO_OUTS
        ? RUNNER_COLUMN.twoOuts
        : RUNNER_COLUMN.otherwise
  const row = PITCH_PATTERNS[difficulty].find(
    (candidate) =>
      candidate[0] === situation.strikes &&
      candidate[1] === situation.balls &&
      candidate[2] === situation.outs &&
      candidate[8] === column,
  )
  const roll = randomIntegerBelow(random, 0, 10_000)
  if (row === undefined) return 0
  let cumulative = 0
  for (let kind = 0; kind < TARGET_KIND_COUNT; kind += 1) {
    cumulative += row[3 + kind] * PERCENT
    if (roll < cumulative) return kind
  }
  return 0
}
