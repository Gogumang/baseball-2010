import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { STRIKES_FOR_STRIKEOUT } from '@/entities/game/model/quickAtBat/constants'
import { endAtBat, nextPitch } from '@/entities/game/model/quickAtBat/loop/pitchCount'
import type { PitchCount, PitchStep } from '@/entities/game/model/quickAtBat/loop/pitchCount'
import { judgePitchOf } from '@/entities/game/model/quickAtBat/pitch/judgePitch'
import { thirdStrikeContestOf } from '@/entities/game/model/quickAtBat/swing/thirdStrike'
import { rollSwingVerdict } from '@/entities/game/model/quickAtBat/swing/verdict'
import type { PitchVerdict } from '@/entities/game/model/quickAtBat/swing/verdict'
import type {
  PitchJudgement,
  QuickAtBatBatter,
  QuickAtBatHooks,
  QuickAtBatPitcher,
  QuickAtBatSituation,
} from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 판정 → 다음 카운트 (0x9d57c 코드). 삼진 · 포볼은 카운트를 더하지 않고 끝난다 */
const JUDGED_STEP: Readonly<Record<PitchJudgement, (count: PitchCount) => PitchStep>> = {
  삼진: (count) => endAtBat(count, { outcome: { kind: '삼진' } }),
  포볼: (count) => endAtBat(count, { outcome: { kind: '볼넷' } }),
  볼: (count) => nextPitch({ ...count, balls: count.balls + 1 }),
  스트라이크: (count) => nextPitch({ ...count, strikes: count.strikes + 1 }),
}

/**
 * 투구 판정 경로 공 하나 (0xc1818). 볼·스트라이크를 가른 뒤 도루를 굴린다 (0xc1818 안, E-5) — 타석을 끝내는 투구에서도 돈다
 */
export function rollJudgedPitch(pitcher: QuickAtBatPitcher, count: PitchCount, random: RandomPort, hooks: QuickAtBatHooks): PitchStep {
  const judged = judgePitchOf(pitcher, count.strikes, count.balls, random)
  hooks.onPitchJudged?.(judged)
  return JUDGED_STEP[judged](count)
}

/** 파울은 투 스트라이크까지만 센다 */
function foulCountOf(count: PitchCount): PitchCount {
  const strikes = count.strikes < STRIKES_FOR_STRIKEOUT - 1 ? count.strikes + 1 : count.strikes
  return { ...count, strikes, fouled: true }
}

/** 헛스윙 · 나머지 코드 스트라이크 — 세 번째면 c170c(곧장 삼진) · c1748(겨루기)로 끝난다 */
function rollStrike(verdict: PitchVerdict, count: PitchCount, batter: QuickAtBatBatter, pitcher: QuickAtBatPitcher, random: RandomPort): PitchStep {
  const counted = { ...count, strikes: count.strikes + 1 }
  if (counted.strikes < STRIKES_FOR_STRIKEOUT) return nextPitch(counted)
  // c170c — 점프표 나머지 코드의 세 번째 스트라이크는 곧장 삼진(0xa7c4d)
  if (verdict.kind === '스트라이크') return endAtBat(counted, { outcome: { kind: '삼진' } })
  // c1748 — 헛스윙의 세 번째 스트라이크는 겨루기다 (`thirdStrikeContestOf`)
  return thirdStrikeContestOf(batter, pitcher, random)
    ? endAtBat(counted, { outcome: { kind: '삼진' } })
    : endAtBat(counted, { outcome: { kind: '아웃', detail: '뜬공아웃' }, swingingStrikeOutLost: true })
}

/** 스윙 경로 공 하나 (0xc11f0) — 이 공의 루를 묻고 결과 코드로 판정한다 */
export function rollSwingPitch(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  count: PitchCount,
  random: RandomPort,
  hooks: QuickAtBatHooks,
): PitchStep {
  const moment = { strikes: count.strikes, balls: count.balls, bases: hooks.basesAtPitch?.() ?? EMPTY_BASES }
  const verdict = rollSwingVerdict(batter, pitcher, situation, random, moment)
  if (verdict.kind === '끝') return endAtBat(count, { outcome: verdict.outcome })
  if (verdict.kind === '파울') return nextPitch(foulCountOf(count))
  return rollStrike(verdict, count, batter, pitcher, random)
}
