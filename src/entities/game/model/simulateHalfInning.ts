import {
  GROUND_OUT_ADVANCE_LIMIT,
  advanceOnGroundOut,
  advanceRunners,
  canAdvanceOnGroundOut,
  EMPTY_BASES,
} from '@/entities/game/model/baseState'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { strikeoutRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'

/**
 * 연출 없는 반 이닝 (원본 0xc2a48 이 하루치 다른 팀 경기를 돌릴 때 쓰는 길).
 * 원본은 점수를 뽑는 공식을 두지 않고 **사람 경기와 같은 타석 엔진**을 3아웃까지 돌려 점수를 읽는다.
 * 여기서도 그렇게 한다 — 이닝 득점 확률표 같은 것은 원본에 없다.
 */
const OUTS_PER_INNING = 3
/** 한 이닝이 끝나지 않는 일은 없지만, 판정이 한쪽으로 쏠릴 때를 대비한 안전망 (원본에는 없다) */
const MAXIMUM_BATTERS = 100

export interface HalfInningResult {
  readonly runs: number
  /** 다음 이닝이 이어받을 타순 */
  readonly nextBattingOrderIndex: number
  /** 이 이닝에 맞은 안타 수 — 완투 계열 기록(0xa7de8)이 state+0x89 로 센다 */
  readonly hits: number
  /** 이 이닝에 내준 볼넷 수 — state+0x88 (투구 판정 0xc1818 에서 나온다) */
  readonly walks: number
  /** 이 이닝에 잡은 아웃 수 — 3아웃으로 끝나지 않는 경우가 없어 보통 3 이다 */
  readonly outs: number
  /** 이 이닝에 잡은 삼진 수 */
  readonly strikeouts: number
  /** 이 이닝에 던진 공 수 — 삼구 삼자범퇴(25) 판정에 쓴다 */
  readonly pitches: number
  /** 이 이닝에 달성한 삼진 계열 기록 id */
  readonly recordIds: readonly number[]
  /** 이닝이 끝났을 때 이어지고 있는 연속 삼진 수 — 다음 이닝이 이어받는다 */
  readonly strikeoutCombo: number
}

export interface HalfInningPitching {
  /** 이 이닝 전까지 이어지던 연속 삼진 수 */
  readonly strikeoutCombo: number
  /** 이 이닝 전까지 우리 투수가 잡은 삼진 수 */
  readonly strikeouts: number
}

export const EMPTY_HALF_INNING_PITCHING: HalfInningPitching = { strikeoutCombo: 0, strikeouts: 0 }

export function simulateHalfInning(
  battingOrderIndex: number,
  batterAt: (battingOrderIndex: number) => QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  inning: number,
  random: RandomPort,
  before: HalfInningPitching = EMPTY_HALF_INNING_PITCHING,
): HalfInningResult {
  let bases = EMPTY_BASES
  let outs = 0
  let runs = 0
  let hits = 0
  let walks = 0
  let strikeouts = 0
  let pitches = 0
  let combo = before.strikeoutCombo
  let order = battingOrderIndex
  const recordIds: number[] = []

  for (let faced = 0; faced < MAXIMUM_BATTERS && outs < OUTS_PER_INNING; faced += 1) {
    const play = playQuickAtBat(batterAt(order), pitcher, { inning }, random)
    const outcome = play.outcome
    pitches += play.pitches
    if (outcome.kind === '안타' || outcome.kind === '홈런') hits += 1
    if (outcome.kind === '볼넷') walks += 1
    if (outcome.kind === '삼진') {
      strikeouts += 1
      combo += 1
      recordIds.push(
        ...strikeoutRecordIdsOf({
          pitches: play.pitches,
          balls: play.balls,
          comboCount: combo,
          pitcherStrikeouts: before.strikeouts + strikeouts,
        }),
      )
    } else {
      // 삼진이 아닌 타석이 하나라도 끼면 콤보가 끊긴다
      combo = 0
    }
    const isGroundOut = outcome.kind === '아웃' && outcome.detail === '땅볼아웃'
    const advanced = advanceRunners(bases, outcome, outs, { quickEngine: true })
    bases = advanced.bases
    // 땅볼 아웃에 60% 로 주자가 한 루 나간다 (0xc15b8).
    // **원본은 아웃 ≤1 이면 주자가 없어도 난수를 먼저 뽑고**, 그 뒤에 주자·3루 조건을 본다 (E 3g).
    // 앞서 웹은 진루 가능할 때만 뽑아서 같은 시드로도 뒤가 어긋났다.
    if (isGroundOut && outs < OUTS_PER_INNING - 1) {
      const rolled = randomIntegerBelow(random, 0, 10_000) <= GROUND_OUT_ADVANCE_LIMIT
      if (rolled && canAdvanceOnGroundOut(bases, outs)) bases = advanceOnGroundOut(bases)
    }
    outs += advanced.outsAdded
    // 3아웃이 되는 순간 들어오던 주자는 득점으로 치지 않는다
    runs += outs >= OUTS_PER_INNING && advanced.outsAdded > 0 ? 0 : advanced.runsScored
    order += 1
  }

  recordIds.push(...threePitchInningRecordIdsOf(pitches, outs))

  return {
    runs,
    nextBattingOrderIndex: order,
    hits,
    walks,
    outs,
    strikeouts,
    pitches,
    recordIds,
    strikeoutCombo: combo,
  }
}
