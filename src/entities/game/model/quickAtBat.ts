import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { swingResultOf } from '@/entities/batting/model/swingResult'
import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 원본 간이 타석 (binary.mod 0xc262c 루프 · 0xc11f0 스윙 · 0xc1818 투구 판정 — 전부 디스어셈 대조).
 * 사람이 조작하지 않는 타석은 원본도 이 길로 돌린다: 동료 여덟 타순, 상대 팀 공격,
 * 그리고 하루치 다른 팀 경기(0xc2a48)까지 전부 같다.
 *
 * **투구마다 두 갈래로 나뉜다** (0xc262c): `rand(0,100) <= 59` 면 스윙(0xc11f0), 아니면 투구 판정(0xc1818).
 * 스윙 판정은 사람 타석과 똑같이 0xab214(`swingResultOf`)로 가고, 투구 판정은 볼·스트라이크를 세어
 * 볼넷과 루킹 삼진을 만든다. 14회에는 스윙을 강제해 경기가 끝나게 한다.
 */
const RANDOM_LIMIT = 10_000
/** 코스 오차의 원본 범위 rand(−13, 21) */
const SPREAD_RANGE = BALANCE.quickAtBat.spreadRange
/** 호출자가 넘기는 기본 스윙 세기 (0x4b) */
const BASE_POWER = BALANCE.quickAtBat.basePower
/** 스윙이 약해질지 보는 판정 — rand(0,10000) ≤ 2999 (0xc1584) */
const WEAK_SWING_GATE = BALANCE.quickAtBat.weakSwingGate
/** 코스가 좁혀질지 보는 판정 — rand(0,10000) ≤ 1499 (0xc1590) */
const TIGHT_COURSE_GATE = BALANCE.quickAtBat.tightCourseGate
const TIGHT_COURSE_GAIN = BALANCE.quickAtBat.tightCourseGain
/** d_level.dat 0x10·0x12 — 스윙 세기를 [0, 100] 으로 다시 펼친다 (지금 값으로는 그대로다) */
const POWER_SCALE = BALANCE.quickAtBat.powerScale
/** 연장에 들어가면 이닝마다 세기가 오르고 코스가 좁아져 경기가 끝나게 만든다 */
const EXTRA_INNING_FROM = BALANCE.quickAtBat.extraInningFrom
const EXTRA_INNING_POWER_STEP = BALANCE.quickAtBat.extraInningPowerStep
const EXTRA_INNING_POWER_FLOOR = BALANCE.quickAtBat.extraInningPowerFloor
const EXTRA_INNING_DIVISOR_UNIT = 20
/** 안타를 한 루 더 늘릴지 보는 주력 판정의 상한 (0xc1804) */
const EXTRA_BASE_LIMIT = BALANCE.quickAtBat.extraBaseLimit
const STRIKES_FOR_STRIKEOUT = 3
/**
 * 한 타석 루프 (0xc262c) — 투구마다 두 갈래로 나뉜다.
 * `rand(0,100) <= 59` 면 스윙(0xc11f0), 아니면 투구 판정(0xc1818). 단 14회에는 스윙을 강제한다.
 */
const SWING_PATH_LIMIT = 59
const FORCED_SWING_INNING = 14
/**
 * 스트라이크존에 넣을 확률 (0xc1818).
 *   기준 = 65 − (마선수면 10) − trunc((제구 + 구속) ÷ 50)
 *   `rand(0,100) > 기준` 이면 존 안이다. 투수가 좋을수록 기준이 낮아져 스트라이크가 늘어난다.
 */
const STRIKE_ZONE_BASE = 65
const ACE_STRIKE_BONUS = 10
const PITCHER_STAT_DIVISOR = 50
/** 볼 카운트가 이 값을 넘으면 포볼이다 — 0x9d57c 가 `볼 <= 2` 일 때만 볼을 센다 */
const BALLS_BEFORE_WALK = 3
/** 타석이 끝나지 않는 일은 없지만, 파울이 끝없이 이어질 때를 대비한 안전망 (원본에는 없다) */
const MAXIMUM_PITCHES = 200

/**
 * 투수 구위 등급 표 (0xd896c, 0xb74bc 가 읽는다).
 * 줄 = 능력 ÷ 250 (0~3), 값은 누적 백분율이다.
 */
const PITCH_GRADE_TABLE: readonly (readonly number[])[] = BALANCE.quickAtBat.pitchGradeTable
const PITCH_GRADE_BAND = BALANCE.quickAtBat.pitchGradeBand

export interface QuickAtBatBatter {
  readonly hit: number
  readonly power: number
  /** 주력 — 내야안타와 한 루 더 가는 판정에 쓴다 (player_stat kind 3) */
  readonly run: number
  readonly skillIds: readonly number[]
}

export interface QuickAtBatPitcher {
  readonly control: number
  readonly velocity: number
  /** 0 이면 탈진이라 0xab214 가 B·C 에 2000 을 얹는다 */
  readonly stamina: number
  readonly skillIds: readonly number[]
  /** 마선수면 스트라이크존 기준이 10 낮아진다 (0xc1818) */
  readonly isAce?: boolean
}

export interface QuickAtBatSituation {
  /** 1부터. 10회부터 연장 보정이 붙는다 */
  readonly inning: number
}

const trunc = Math.trunc

/**
 * 구위 등급 (0xb74bc → 부르는 쪽에서 다시 1 을 뺀다).
 * 표에서 걸린 칸을 i 라 할 때, 지치지 않았으면 i+1, 지쳤으면 max(i−1, 0) 이고
 * 0xc11f0 이 거기서 1 을 더 빼 0~4 로 만든다.
 */
export function pitchGradeOf(ability: number, stamina: number, random: RandomPort): number {
  const band = Math.min(PITCH_GRADE_TABLE.length - 1, Math.max(0, trunc(ability / PITCH_GRADE_BAND)))
  const row = PITCH_GRADE_TABLE[band]
  const rolled = randomIntegerBelow(random, 0, RANDOM_LIMIT)
  const index = row.findIndex((percent) => rolled < percent * 100)
  const found = index === -1 ? row.length - 1 : index
  const graded = stamina !== 0 ? found + 1 : Math.max(found - 1, 0)
  return Math.max(0, graded - 1)
}

export interface QuickPitch {
  readonly spreadX: number
  readonly spreadY: number
  /** 0xab214 의 param_6 — 웹판 `swingResultOf` 는 이것을 timing 자리에 받는다 */
  readonly power: number
}

/** 한 번 던질 때 정해지는 코스 오차와 스윙 세기 (0xc11f0 앞부분) */
export function quickPitchOf(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
): QuickPitch {
  let spreadX = randomIntegerBelow(random, SPREAD_RANGE.minimum, SPREAD_RANGE.maximumExclusive)
  let spreadY = randomIntegerBelow(random, SPREAD_RANGE.minimum, SPREAD_RANGE.maximumExclusive)
  let power = BASE_POWER

  // 투수 구속이 타자 히트를 누르면 스윙 자체가 힘을 잃는다
  if (randomIntegerBelow(random, 0, RANDOM_LIMIT) <= WEAK_SWING_GATE) {
    const pitcherRoll = randomIntegerBelow(random, 0, pitcher.velocity)
    const batterRoll = randomIntegerBelow(random, 0, batter.hit)
    if (batterRoll < pitcherRoll) power = 0
  }

  // 타자 파워가 투수 제구를 누르면 코스가 가운데로 3 씩 당겨진다
  if (randomIntegerBelow(random, 0, RANDOM_LIMIT) <= TIGHT_COURSE_GATE) {
    const pitcherRoll = randomIntegerBelow(random, 0, pitcher.control)
    const batterRoll = randomIntegerBelow(random, 0, batter.power)
    if (pitcherRoll < batterRoll) {
      spreadX = Math.abs(spreadX) - TIGHT_COURSE_GAIN
      spreadY = Math.abs(spreadY) - TIGHT_COURSE_GAIN
    }
  }

  power = trunc((power * (POWER_SCALE.maximumValue - POWER_SCALE.minimum)) / 100) + POWER_SCALE.minimum

  if (situation.inning > EXTRA_INNING_FROM && power > EXTRA_INNING_POWER_FLOOR) {
    power = Math.min(100, power + (situation.inning - EXTRA_INNING_FROM) * EXTRA_INNING_POWER_STEP)
    const divisor = trunc(power / EXTRA_INNING_DIVISOR_UNIT)
    spreadX = trunc((spreadX * 3) / divisor)
    spreadY = trunc((spreadY * 3) / divisor)
  }

  // 부호를 각각 다시 뽑는다. 원본 호출은 디컴파일에서 인자가 날아가 rand(0,2) 로 본다 (추정)
  if (randomIntegerBelow(random, 0, 2) === 0) spreadX = -spreadX
  if (randomIntegerBelow(random, 0, 2) === 0) spreadY = -spreadY

  return { spreadX, spreadY, power }
}

/** 투구 판정 결과 (0x9d57c 가 돌려주는 코드 1·2·3·4·5) */
export type PitchJudgement = '스트라이크' | '볼' | '포볼' | '삼진'

/**
 * 스윙하지 않는 투구의 판정 (0xc1818 → 0x9d57c).
 * 원본은 데드볼(코드 4)도 내지만 그 조건인 상태 플래그 +0x12 를 아직 해독하지 못해 넣지 않았다.
 * 마찬가지로 +0x10(존 밖인데도 스트라이크로 치는 플래그)도 0 으로 본다 (추정).
 */
export function judgePitchOf(
  pitcher: QuickAtBatPitcher,
  strikes: number,
  balls: number,
  random: RandomPort,
): PitchJudgement {
  const aceBonus = pitcher.isAce === true ? ACE_STRIKE_BONUS : 0
  const bonus = aceBonus + trunc((pitcher.control + pitcher.velocity) / PITCHER_STAT_DIVISOR)
  const threshold = STRIKE_ZONE_BASE - bonus
  const isInsideZone = randomIntegerBelow(random, 0, 100) > threshold
  if (!isInsideZone) return balls <= BALLS_BEFORE_WALK - 1 ? '볼' : '포볼'
  return strikes <= STRIKES_FOR_STRIKEOUT - 2 ? '스트라이크' : '삼진'
}

/** 0xc11f0 의 결과 코드 분기를 그대로 옮긴 판정 하나 */
type PitchVerdict =
  | { readonly kind: '스트라이크' }
  | { readonly kind: '파울' }
  | { readonly kind: '끝'; readonly outcome: AtBatOutcome }

const GROUND_BALL_CODE = 3
const FOUL_CODE = 9
const OUT_CODE = 0
const HIT_CODES = { single: 15, double: 18, homeRun: 24 } as const

function verdictOf(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
): PitchVerdict {
  const pitch = quickPitchOf(batter, pitcher, situation, random)
  const controlTier = pitchGradeOf(pitcher.control, pitcher.stamina, random)
  const swing = swingResultOf(
    {
      horizontalError: pitch.spreadX,
      verticalError: pitch.spreadY,
      timing: pitch.power,
      buntKind: 0,
      controlTier,
      batter,
      pitcher,
      mode: '일반',
      isPitcherExhausted: pitcher.stamina === 0,
      batterSkillIds: batter.skillIds,
      pitcherSkillIds: pitcher.skillIds,
      situation: {
        inning: situation.inning,
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
    },
    random,
  )
  if (swing.kind === '헛스윙') return { kind: '스트라이크' }

  // 땅볼은 주력으로 내야안타를 가른다. 지면 평범한 아웃이다
  if (swing.code === GROUND_BALL_CODE) {
    const rolled = randomIntegerBelow(random, 0, RANDOM_LIMIT)
    const speed = randomIntegerBelow(random, 0, batter.run)
    return rolled < speed
      ? { kind: '끝', outcome: { kind: '안타', bases: 1 } }
      : { kind: '끝', outcome: { kind: '아웃', detail: '땅볼아웃' } }
  }
  if (swing.code === FOUL_CODE) return { kind: '파울' }
  // 원본은 뜬공·직선타를 구분하지 않는다 — 코드 0 하나뿐이라 뜬공으로 적는다 (추정)
  if (swing.code === OUT_CODE) return { kind: '끝', outcome: { kind: '아웃', detail: '뜬공아웃' } }
  if (swing.code === HIT_CODES.homeRun) return { kind: '끝', outcome: { kind: '홈런' } }

  if (swing.code === HIT_CODES.single || swing.code === HIT_CODES.double) {
    // 주력이 이기면 한 루 더 간다 (안타 → 2루타, 2루타 → 3루타)
    const rolled = randomIntegerBelow(random, 0, EXTRA_BASE_LIMIT)
    const speed = randomIntegerBelow(random, 0, batter.run)
    const code = rolled < speed ? swing.code + 3 : swing.code
    const bases = Math.min(3, trunc((code - HIT_CODES.single) / 3) + 1) as 1 | 2 | 3
    return { kind: '끝', outcome: { kind: '안타', bases } }
  }

  // 번트 코드(6·7·8·12)는 간이 타석이 스윙만 하므로 나오지 않는다
  return { kind: '끝', outcome: { kind: '아웃', detail: '땅볼아웃' } }
}

/** 타석 하나의 결과와, 기록달성 판정에 쓰는 투구 내역 */
export interface QuickAtBatPlay {
  readonly outcome: AtBatOutcome
  /** 이 타석에서 던진 공 수 — 삼구 삼진(16) 판정에 쓴다 */
  readonly pitches: number
  /** 끝났을 때의 볼 카운트 — 풀카운트 삼진(17) 판정에 쓴다 */
  readonly balls: number
  readonly strikes: number
}

/**
 * 타석 하나를 끝까지 돌린다 (0xc262c).
 * 투구마다 스윙 경로(0xc11f0, 60%)와 투구 판정 경로(0xc1818, 40%)로 갈린다 — 14회는 스윙만 한다.
 * 볼넷은 판정 경로에서만 나온다.
 */
export function playQuickAtBat(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
): QuickAtBatPlay {
  let strikes = 0
  let balls = 0
  for (let pitch = 1; pitch <= MAXIMUM_PITCHES; pitch += 1) {
    const done = (outcome: AtBatOutcome): QuickAtBatPlay => ({ outcome, pitches: pitch, balls, strikes })
    const isSwing =
      randomIntegerBelow(random, 0, 100) <= SWING_PATH_LIMIT || situation.inning === FORCED_SWING_INNING
    if (!isSwing) {
      const judged = judgePitchOf(pitcher, strikes, balls, random)
      if (judged === '삼진') return done({ kind: '삼진' })
      if (judged === '포볼') return done({ kind: '볼넷' })
      if (judged === '볼') balls += 1
      else strikes += 1
      continue
    }

    const verdict = verdictOf(batter, pitcher, situation, random)
    if (verdict.kind === '끝') return done(verdict.outcome)
    // 파울은 투 스트라이크까지만 센다
    if (verdict.kind === '파울') {
      if (strikes < STRIKES_FOR_STRIKEOUT - 1) strikes += 1
      continue
    }
    strikes += 1
    if (strikes >= STRIKES_FOR_STRIKEOUT) return done({ kind: '삼진' })
  }
  return { outcome: { kind: '삼진' }, pitches: MAXIMUM_PITCHES, balls, strikes }
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
