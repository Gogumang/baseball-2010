import type { AtBatOutcome } from '@/entities/game/model/quickAtBat/otherSlices'
import { START_COUNT, quickAtBatPlayOf } from '@/entities/game/model/quickAtBat/loop/pitchCount'
import type { PitchCount, PitchStep } from '@/entities/game/model/quickAtBat/loop/pitchCount'
import { rollJudgedPitch, rollSwingPitch } from '@/entities/game/model/quickAtBat/loop/pitchSteps'
import type {
  QuickAtBatBatter,
  QuickAtBatHooks,
  QuickAtBatPitcher,
  QuickAtBatPlay,
  QuickAtBatSituation,
} from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 한 타석 루프 (0xc262c) — 투구마다 두 갈래로 나뉜다.
 * `rand(0,100) <= 59` 면 스윙(0xc11f0), 아니면 투구 판정(0xc1818). 단 15회에는 스윙을 강제한다.
 *
 * 원본 이닝은 **0부터** 세서 `이닝 == 0xe` 가 딱 그 한 이닝만 걸린다 (0xc26e0) → 1-기준으로 15회다.
 * 연장 보정도 같은 이유로 `이닝 > 9`(0-기준) = **11회부터**이고, 그래서 `extraInningFrom` 이 10 이다 (0xc13e0).
 */
const SWING_PATH_LIMIT = 59
const FORCED_SWING_INNING = 15

/** 이 공이 스윙 경로로 가나 — 경로 굴림 rand(0,100)(c26d4)은 15회에도 굴린다 */
function rollSwingPath(situation: QuickAtBatSituation, random: RandomPort): boolean {
  const rolled = random.rand(0, 100)
  return rolled <= SWING_PATH_LIMIT || situation.inning === FORCED_SWING_INNING
}

/** 공 하나 — 소모를 먹인 이 공의 투수(c26c8)를 받고, 경로를 굴려 스윙 · 투구 판정 길로 간다 */
function rollPitch(
  batter: QuickAtBatBatter,
  startingPitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  count: PitchCount,
  random: RandomPort,
  hooks: QuickAtBatHooks,
): PitchStep {
  const pitcher = hooks.beforePitch?.() ?? startingPitcher
  if (!rollSwingPath(situation, random)) return rollJudgedPitch(pitcher, count, random, hooks)
  hooks.onSwingPath?.()
  return rollSwingPitch(batter, pitcher, situation, count, random, hooks)
}

/**
 * 타석 하나를 끝까지 돌린다 (0xc262c).
 * 투구마다 스윙 경로(0xc11f0, 60%)와 투구 판정 경로(0xc1818, 40%)로 갈린다 — 14회는 스윙만 한다.
 * 볼넷은 판정 경로에서만 나온다.
 */
export function playQuickAtBat(
  batter: QuickAtBatBatter,
  startingPitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
  hooks: QuickAtBatHooks = {},
): QuickAtBatPlay {
  let count = START_COUNT
  // 0xc262c 의 공 고리(c26be~c271c)는 상한이 없다 — 지금 타자(0xae89c)가 바뀔 때(타석이 끝날 때)까지 돈다.
  // 파울이 이어지는 동안 끝나지 않는 것도 원본 그대로다(파울은 늘 확률이 1 보다 작아 결국 끝난다)
  for (let pitch = 1; ; pitch += 1) {
    const step = rollPitch(batter, startingPitcher, situation, count, random, hooks)
    if (step.ending !== undefined) return quickAtBatPlayOf(step.ending, pitch, step.count)
    count = step.count
  }
}

/** 결과만 필요할 때 쓰는 얇은 껍데기 */
export function simulateQuickAtBat(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
): AtBatOutcome {
  return playQuickAtBat(batter, pitcher, situation, random).outcome
}
