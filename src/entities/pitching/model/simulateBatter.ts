import { distanceBetween, isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import { swingResultOf } from '@/entities/batting/model/swingResult'
import { timingOf } from '@/entities/batting/model/swingTiming'
import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { outcomeOfPattern, randomPattern } from '@/entities/batting/model/battedBallOutcome'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { ABILITY_SCALE } from '@/entities/batting/model/batter'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 투수편에서 상대 타자를 대신 판단한다.
 *
 * 타자는 코스를 읽고 휘두를지 정한 뒤, 배트를 공 쪽으로 가져간다.
 * 히트가 높을수록 존 밖 공을 덜 쫓고 커서를 더 정확히 맞춘다 —
 * 원작 능력치 설명("히트 : 공을 맞출 확률을 증가")을 그대로 반영한 것이다.
 */

/** 존 안에 들어온 공을 휘두를 기본 확률 */
const SWING_AT_STRIKE_BASE = 0.62
/** 존 밖 공을 쫓아가는 기본 확률. 히트가 높을수록 줄어든다. */
const CHASE_BASE = 0.42


export function willSwing(pitch: Pitch, ability: BatterAbility, random: RandomPort): boolean {
  const eye = ability.hit / ABILITY_SCALE
  if (isInsideStrikeZone(pitch.plate)) {
    return random.next() < SWING_AT_STRIKE_BASE + eye * 0.25
  }
  // 존에서 멀수록 덜 쫓는다
  const distance = distanceBetween(pitch.plate, { x: 0, y: 0 })
  const chance = Math.max(0, CHASE_BASE * (1 - eye * 0.6) - (distance - 1) * 0.25)
  return random.next() < chance
}

/** 상대 CPU 타자의 타이밍 흔들림(프레임) — 히트 0 이면 ±4, 999 면 ±1 (추정) */
const MAXIMUM_TIMING_SPREAD = 4
const SWEET_FRAME_OFFSET = 2
/** 투수편 투수 능력치를 아직 넘겨받지 않아 쓰는 기본값 (추정) */
const DEFAULT_PITCHER_STATS = { control: 500, velocity: 500 }

/**
 * 투수편 한 구의 결과. 플레이어가 던지고 타자는 자동으로 반응한다.
 * 휘두른 뒤는 타자편과 같은 원본 스윙 결과(0xab214) → 방향 → 타구 패턴 → 대체 근사를 쓴다.
 * CPU 타자의 휘두를지·언제 휘두를지는 원본 AI 를 아직 옮기지 않은 추정 규칙이다.
 */
export function pitchAgainstBatter(
  pitch: Pitch,
  batter: BatterAbility,
  random: RandomPort,
  pitcher: { readonly control: number; readonly velocity: number } = DEFAULT_PITCHER_STATS,
): PitchResolution {
  if (!willSwing(pitch, batter, random)) {
    return isInsideStrikeZone(pitch.plate)
      ? { kind: '스트라이크', isSwinging: false }
      : { kind: '볼' }
  }

  const spread = Math.max(1, Math.round(MAXIMUM_TIMING_SPREAD * (1 - batter.hit / ABILITY_SCALE)))
  const frame = pitch.frameCount - SWEET_FRAME_OFFSET + randomIntegerBelow(random, -spread, spread + 1)
  const result = swingResultOf(
    {
      horizontalError: Math.round(pitch.plate.x * ZONE_HALF_PIXELS),
      verticalError: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
      timing: timingOf(frame, pitch.frameCount, false),
      buntKind: 0,
      controlTier: pitch.controlTier,
      batter,
      pitcher,
      mode: '일반',
      isPitcherExhausted: false,
      batterSkillIds: [],
      pitcherSkillIds: [],
      situation: NEUTRAL_SITUATION,
    },
    random,
  )
  if (result.kind === '헛스윙') return { kind: '스트라이크', isSwinging: true }

  const code = result.code + hitDirectionOf({ code: result.code, frame, frameCount: pitch.frameCount, batterSide: 0 }, random)
  const batted = outcomeOfPattern(code, randomPattern(code, random), random)
  return batted.kind === '파울' ? { kind: '파울' } : { kind: '타구', outcome: batted.outcome }
}

const ZONE_HALF_PIXELS = 16.5
const NEUTRAL_SITUATION = {
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
}
