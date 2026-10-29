import { test } from 'vitest'
import { resolvePitch, type BattingContext } from '@/features/play-at-bat/model/resolvePitch'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { pitchPathOf, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 타격 판정 — 판정 틀에 한 번 도는 `resolvePitch`(스윙 · 안 친 공).
 * 기준 숫자만 남긴다(기계마다 달라 실패 기준은 없다) — `pnpm bench`
 */
const 공: Pitch = {
  type: 'FASTBALL',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 18 * 62,
  frameCount: 18,
  controlTier: 3,
  worldPath: pitchPathOf({ typeNumber: 1, form: 0, speedStage: 0, target: ZONE_CENTERS[1] }),
  stageSide: 1,
}
const 상황: BattingContext = {
  batter: { hit: 300, power: 300, run: 300, defense: 300 },
  pitcher: { control: 30, velocity: 30 },
  mode: '일반',
  batterSkillIds: [],
  situation: {
    inning: 1,
    isLosing: false,
    runnerCount: 0,
    hasSecondBaseRunner: false,
    pitcherSide: 0,
    batterSide: 0,
    balls: 0,
    strikes: 0,
    batterOrderIndex: 0,
    recentAtBatCodes: [],
  },
}
const 덱 = createPatternDeck(createSeededRandom(1))
const 스윙 = { frame: 16, shift: 0, buntKind: 0 }

test('타격 판정', async ({ bench }) => {
  let seed = 0
  await bench.compare(
    bench('스윙한 공 (resolvePitch)', () => {
      seed += 1
      resolvePitch(공, 스윙, 상황, 덱, createSeededRandom(seed))
    }),
    bench('안 친 공 (resolvePitch)', () => {
      seed += 1
      resolvePitch(공, null, 상황, 덱, createSeededRandom(seed))
    }),
  )
})
